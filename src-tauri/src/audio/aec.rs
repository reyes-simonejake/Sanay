//! Acoustic echo cancellation: removes what the speakers play from the mic, so the other person in a
//! call never hears their own voice coming back.
//!
//! Why Sanay needs its own: call apps cancel echo by recognising their own audio in the mic signal.
//! With an AI voice in between, the leaked far-end speech comes out *converted into the AI voice*,
//! the call app no longer recognises it, and the other person hears their words echoed back in
//! Sanay's voice. So the echo has to go before the denoiser and the voice model.
//!
//! ```text
//! speakers (WASAPI loopback) ─► far-end x ─┐
//! mic d ─► [delay to keep x causal] ─► d − Ŵ·x ─► residual suppressor ─► e (to the denoiser)
//! ```
//!
//! * Linear part: partitioned-block frequency-domain NLMS (overlap-save), 10 ms blocks, 240 ms of
//!   echo path. Two filters as in Speex MDF: a background filter adapts every block; the foreground
//!   filter (the one used) only takes its coefficients when it is clearly better, so double talk
//!   (both people speaking) can't wreck the echo path the canceller has learned.
//! * Residual suppressor: per-bin gain from the coherences mic↔error and mic↔echo estimate
//!   (as in WebRTC's AEC NLP), averaged over the speech band so it doesn't sound watery. It
//!   removes the echo the linear filter misses (speaker distortion, path changes).
//! * Added delay: 20 ms mic delay (keeps the far-end reference ahead of its echo despite loopback
//!   jitter) + 10 ms overlap-add in the suppressor.

use super::dsp::FRAME;
use realfft::num_complex::Complex32;
use realfft::{ComplexToReal, RealFftPlanner, RealToComplex};
use std::collections::VecDeque;
use std::sync::Arc;

const N: usize = FRAME; // block (hop) size, 10 ms at 48 kHz
const M: usize = 2 * N; // FFT size
const K: usize = N + 1; // bins
/// Echo path length in blocks (240 ms): device buffering + room reverb.
const PARTS: usize = 24;
/// Blocks of mic delay. Keeps the far-end reference ahead of its echo even when loopback
/// packets arrive late; must match `RefBuffer::TARGET`.
const MIC_DELAY: usize = 2;
/// Far-end quieter than this (mean square) counts as silence: no adaptation, no suppression.
const FAR_SILENT: f32 = 1e-7;

/// Total delay the canceller adds, in samples.
pub const LATENCY_SAMPLES: usize = MIC_DELAY * N + N;

pub struct EchoCanceller {
    r2c: Arc<dyn RealToComplex<f32>>,
    c2r: Arc<dyn ComplexToReal<f32>>,
    time: Vec<f32>,
    spec: Vec<Complex32>,
    scratch_f: Vec<Complex32>,
    scratch_i: Vec<Complex32>,

    // linear filter
    x_prev: [f32; N],
    xs: VecDeque<Vec<Complex32>>, // far-end spectra, newest first
    pxx: Vec<f32>,                // Σ over partitions of |X|², per bin
    wf: Vec<Vec<Complex32>>,
    wb: Vec<Vec<Complex32>>,
    sf: f32,
    sb: f32,
    better: u32,
    rr: usize,
    mic_delay: VecDeque<[f32; N]>,

    // residual suppressor (sqrt-Hann STFT, hop N)
    win: Vec<f32>,
    d_prev: [f32; N],
    e_prev: [f32; N],
    y_prev: [f32; N],
    sdd: Vec<f32>,
    see: Vec<f32>,
    syy: Vec<f32>,
    sde: Vec<Complex32>,
    sdy: Vec<Complex32>,
    olap: [f32; N],
    far_hold: u32,
    /// Smoothed echo suppression in the speech band (0 = none, 1 = full), for the UI/logs.
    pub suppression: f32,
}

impl EchoCanceller {
    pub fn new() -> Self {
        let mut planner = RealFftPlanner::<f32>::new();
        let r2c = planner.plan_fft_forward(M);
        let c2r = planner.plan_fft_inverse(M);
        let scratch_f = r2c.make_scratch_vec();
        let scratch_i = c2r.make_scratch_vec();
        let z = Complex32::new(0.0, 0.0);
        // periodic sqrt-Hann: analysis × synthesis = Hann, which overlap-adds to 1 at 50% hop
        let win = (0..M).map(|i| (0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / M as f32).cos()).sqrt()).collect();
        Self {
            r2c,
            c2r,
            time: vec![0.0; M],
            spec: vec![z; K],
            scratch_f,
            scratch_i,
            x_prev: [0.0; N],
            xs: (0..PARTS).map(|_| vec![z; K]).collect(),
            pxx: vec![0.0; K],
            wf: vec![vec![z; K]; PARTS],
            wb: vec![vec![z; K]; PARTS],
            sf: 0.0,
            sb: 0.0,
            better: 0,
            rr: 0,
            mic_delay: (0..MIC_DELAY).map(|_| [0.0; N]).collect(),
            win,
            d_prev: [0.0; N],
            e_prev: [0.0; N],
            y_prev: [0.0; N],
            sdd: vec![0.0; K],
            see: vec![0.0; K],
            syy: vec![0.0; K],
            sde: vec![z; K],
            sdy: vec![z; K],
            olap: [0.0; N],
            far_hold: 0,
            suppression: 0.0,
        }
    }

    fn fft(&mut self) {
        let _ = self.r2c.process_with_scratch(&mut self.time, &mut self.spec, &mut self.scratch_f);
    }

    /// Inverse FFT of `self.spec` into `self.time`, scaled so fft→ifft is the identity.
    fn ifft(&mut self) {
        self.spec[0].im = 0.0;
        self.spec[K - 1].im = 0.0;
        let _ = self.c2r.process_with_scratch(&mut self.spec, &mut self.time, &mut self.scratch_i);
        let s = 1.0 / M as f32;
        self.time.iter_mut().for_each(|v| *v *= s);
    }

    /// Echo estimate (time domain, last N of the overlap-save block) for filter `w`.
    fn estimate(&mut self, fg: bool) -> [f32; N] {
        let z = Complex32::new(0.0, 0.0);
        for k in 0..K {
            let mut acc = z;
            for p in 0..PARTS {
                let w = if fg { self.wf[p][k] } else { self.wb[p][k] };
                acc += w * self.xs[p][k];
            }
            self.spec[k] = acc;
        }
        self.ifft();
        let mut y = [0.0; N];
        y.copy_from_slice(&self.time[N..]);
        y
    }

    /// Cancels the echo of `far` (what the speakers played, aligned to the same moment) in `mic`.
    /// `mic` is replaced with the cleaned signal, delayed by `LATENCY_SAMPLES`.
    pub fn process(&mut self, mic: &mut [f32; FRAME], far: &[f32; FRAME]) {
        // Mic delay: the reference must lead its echo.
        self.mic_delay.push_back(*mic);
        let d = self.mic_delay.pop_front().expect("mic delay");

        let far_pow = far.iter().map(|v| v * v).sum::<f32>() / N as f32;
        let far_active = far_pow > FAR_SILENT;
        self.far_hold = if far_active { 30 } else { self.far_hold.saturating_sub(1) }; // echo tail: 300 ms

        // Far-end spectrum (overlap-save: previous block + this block).
        self.time[..N].copy_from_slice(&self.x_prev);
        self.time[N..].copy_from_slice(far);
        self.x_prev.copy_from_slice(far);
        self.fft();
        let mut newest = self.xs.pop_back().expect("partitions");
        for k in 0..K {
            self.pxx[k] -= newest[k].norm_sqr();
            newest[k] = self.spec[k];
            self.pxx[k] = (self.pxx[k] + newest[k].norm_sqr()).max(0.0);
        }
        self.xs.push_front(newest);

        let yf = self.estimate(true);
        let yb = self.estimate(false);
        let mut ef = [0.0; N];
        let mut eb = [0.0; N];
        for i in 0..N {
            ef[i] = d[i] - yf[i];
            eb[i] = d[i] - yb[i];
        }

        if far_active {
            // Background filter: normalised LMS step on all partitions.
            self.time[..N].fill(0.0);
            self.time[N..].copy_from_slice(&eb);
            self.fft();
            let reg = 1e-6 * (M * PARTS) as f32;
            let mu = 0.5;
            for k in 0..K {
                let g = self.spec[k] * (mu / (self.pxx[k] + reg));
                for p in 0..PARTS {
                    let x = self.xs[p][k];
                    self.wb[p][k] += x.conj() * g;
                }
            }
            // Gradient constraint (keeps the filter a linear, not circular, convolution), two
            // partitions per block in turn: cheap and enough to stay stable.
            for _ in 0..2 {
                let p = self.rr;
                self.rr = (self.rr + 1) % PARTS;
                self.spec.copy_from_slice(&self.wb[p]);
                self.ifft();
                self.time[N..].fill(0.0);
                self.fft();
                self.wb[p].copy_from_slice(&self.spec);
            }

            // Foreground/background: take the background only when it is clearly better; throw
            // it away when it diverged (double talk).
            let e_f = ef.iter().map(|v| v * v).sum::<f32>();
            let e_b = eb.iter().map(|v| v * v).sum::<f32>();
            self.sf += 0.2 * (e_f - self.sf);
            self.sb += 0.2 * (e_b - self.sb);
            if self.sb < 0.8 * self.sf {
                self.better += 1;
                if self.better >= 3 {
                    self.wf.clone_from(&self.wb);
                    self.sf = self.sb;
                    self.better = 0;
                }
            } else {
                self.better = 0;
                if self.sb > 4.0 * self.sf + 1e-9 {
                    self.wb.clone_from(&self.wf);
                    self.sb = self.sf;
                }
            }
        }

        // Residual suppressor.
        let d_spec = self.analyse(true, &d);
        let e_spec = self.analyse(false, &ef);
        self.time[..N].copy_from_slice(&self.y_prev);
        self.time[N..].copy_from_slice(&yf);
        self.y_prev = yf;
        for i in 0..M {
            self.time[i] *= self.win[i];
        }
        self.fft();
        let y_spec = self.spec.clone();

        let a = 0.85;
        let mut g = vec![1.0f32; K];
        if self.far_hold > 0 {
            let mut band = 0.0;
            let (lo, hi) = (bin(300.0), bin(4000.0));
            for k in 0..K {
                let (dk, ek, yk) = (d_spec[k], e_spec[k], y_spec[k]);
                self.sdd[k] = a * self.sdd[k] + (1.0 - a) * dk.norm_sqr();
                self.see[k] = a * self.see[k] + (1.0 - a) * ek.norm_sqr();
                self.syy[k] = a * self.syy[k] + (1.0 - a) * yk.norm_sqr();
                self.sde[k] = self.sde[k] * a + dk * ek.conj() * (1.0 - a);
                self.sdy[k] = self.sdy[k] * a + dk * yk.conj() * (1.0 - a);
                let coh_de = self.sde[k].norm_sqr() / (self.sdd[k] * self.see[k] + 1e-12);
                let coh_dy = self.sdy[k].norm_sqr() / (self.sdd[k] * self.syy[k] + 1e-12);
                g[k] = coh_de.min(1.0 - coh_dy).clamp(0.0, 1.0);
                if (lo..hi).contains(&k) {
                    band += g[k];
                }
            }
            let band = band / (hi - lo) as f32;
            // Echo-dominated block: push harder so nothing speech-like is left for the voice model.
            let over = if band < 0.5 { 2.0 } else { 1.0 };
            for gk in g.iter_mut() {
                *gk = (0.5 * *gk + 0.5 * band).powf(over).max(0.03);
            }
            self.suppression += 0.1 * ((1.0 - band) - self.suppression);
        } else {
            self.sdd.iter_mut().for_each(|v| *v = 0.0);
            self.see.iter_mut().for_each(|v| *v = 0.0);
            self.syy.iter_mut().for_each(|v| *v = 0.0);
            self.sde.iter_mut().for_each(|v| *v = Complex32::new(0.0, 0.0));
            self.sdy.iter_mut().for_each(|v| *v = Complex32::new(0.0, 0.0));
            self.suppression *= 0.9;
        }
        for k in 0..K {
            self.spec[k] = e_spec[k] * g[k];
        }
        self.ifft();
        for i in 0..N {
            mic[i] = self.olap[i] + self.time[i] * self.win[i];
            self.olap[i] = self.time[N + i] * self.win[N + i];
        }
    }

    /// Windowed spectrum of [previous block | this block] for the mic (`d`) or error stream.
    fn analyse(&mut self, mic: bool, x: &[f32; N]) -> Vec<Complex32> {
        let prev = if mic { &mut self.d_prev } else { &mut self.e_prev };
        self.time[..N].copy_from_slice(prev);
        self.time[N..].copy_from_slice(x);
        *prev = *x;
        for i in 0..M {
            self.time[i] *= self.win[i];
        }
        self.fft();
        self.spec.clone()
    }
}

fn bin(hz: f32) -> usize {
    ((hz / super::dsp::SAMPLE_RATE as f32 * M as f32).round() as usize).min(K - 1)
}

/// Far-end samples from the loopback capture, handed out one block per mic block at a steady
/// offset: a small jitter backlog, sample-level drift correction, silence when nothing plays.
pub struct RefBuffer {
    buf: VecDeque<f32>,
    primed: bool,
    fill_avg: f32,
}

impl RefBuffer {
    const TARGET: usize = MIC_DELAY * N;

    pub fn new() -> Self {
        Self { buf: VecDeque::with_capacity(N * 16), primed: false, fill_avg: Self::TARGET as f32 }
    }

    pub fn push(&mut self, s: &[f32]) {
        self.buf.extend(s.iter().copied());
        if self.buf.len() > N * 12 {
            // Way behind (e.g. the DSP thread stalled): keep only the target backlog.
            let drop = self.buf.len() - Self::TARGET - N;
            self.buf.drain(..drop);
        }
    }

    pub fn next(&mut self, out: &mut [f32; FRAME]) {
        if !self.primed {
            if self.buf.len() >= Self::TARGET + N {
                self.primed = true;
                self.fill_avg = self.buf.len() as f32;
            } else {
                out.fill(0.0);
                return;
            }
        }
        if self.buf.len() < N {
            // Playback stopped (WASAPI loopback sends nothing during silence).
            self.buf.clear();
            self.primed = false;
            out.fill(0.0);
            return;
        }
        self.fill_avg += 0.02 * (self.buf.len() as f32 - self.fill_avg);
        let target = (Self::TARGET + N) as f32;
        for o in out.iter_mut() {
            *o = self.buf.pop_front().unwrap_or(0.0);
        }
        // Clock drift between speakers and mic: nudge by one sample at a time.
        if self.fill_avg > target + N as f32 / 2.0 && self.buf.len() > N {
            self.buf.pop_front();
            self.fill_avg -= 1.0;
        } else if self.fill_avg < target - N as f32 / 2.0 {
            let last = out[N - 1];
            self.buf.push_front(last);
            self.fill_avg += 1.0;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Deterministic noise with a speech-like (pink-ish) spectrum.
    fn noise(seed: &mut u32, n: usize) -> Vec<f32> {
        let mut prev = 0.0;
        (0..n)
            .map(|_| {
                *seed ^= *seed << 13;
                *seed ^= *seed >> 17;
                *seed ^= *seed << 5;
                let w = (*seed as f32 / u32::MAX as f32) * 2.0 - 1.0;
                prev = 0.9 * prev + 0.1 * w * 3.0;
                prev
            })
            .collect()
    }

    /// Room: 40 ms delay, a decaying reflection tail, a bit of gain.
    fn room(x: &[f32]) -> Vec<f32> {
        let taps: Vec<(usize, f32)> = vec![(1920, 0.6), (2300, -0.3), (2900, 0.2), (4100, 0.12), (6000, -0.06)];
        (0..x.len()).map(|i| taps.iter().filter(|(d, _)| i >= *d).map(|(d, g)| g * x[i - d]).sum()).collect()
    }

    fn energy(x: &[f32]) -> f32 {
        x.iter().map(|v| v * v).sum::<f32>() / x.len() as f32
    }

    fn run(aec: &mut EchoCanceller, mic: &[f32], far: &[f32]) -> Vec<f32> {
        let mut out = Vec::with_capacity(mic.len());
        for (m, f) in mic.chunks_exact(N).zip(far.chunks_exact(N)) {
            let mut fr = [0.0; N];
            fr.copy_from_slice(m);
            let mut ff = [0.0; N];
            ff.copy_from_slice(f);
            aec.process(&mut fr, &ff);
            out.extend_from_slice(&fr);
        }
        out
    }

    #[test]
    fn removes_far_end_echo() {
        let mut s = 7;
        let far = noise(&mut s, 48_000 * 8);
        let mic = room(&far);
        let mut aec = EchoCanceller::new();
        let out = run(&mut aec, &mic, &far);
        let tail = 48_000 * 6..48_000 * 8; // after convergence
        let erle = 10.0 * (energy(&mic[tail.clone()]) / energy(&out[tail]).max(1e-12)).log10();
        eprintln!("ERLE {erle:.1} dB");
        assert!(erle > 25.0, "echo only reduced by {erle:.1} dB");
    }

    #[test]
    fn keeps_near_end_voice_during_double_talk() {
        let mut s = 7;
        let far = noise(&mut s, 48_000 * 10);
        let mut s2 = 99;
        let near = noise(&mut s2, 48_000 * 10);
        let echo = room(&far);
        // near-end talks from 6 s on, while the far end keeps talking
        let mic: Vec<f32> = (0..far.len()).map(|i| echo[i] + if i >= 48_000 * 6 { near[i] } else { 0.0 }).collect();
        let mut aec = EchoCanceller::new();
        let out = run(&mut aec, &mic, &far);
        let lat = LATENCY_SAMPLES;
        let w = 48_000 * 7..48_000 * 10;
        let kept = energy(&out[w.start + lat..w.end]) / energy(&near[w.start..w.end - lat]);
        let kept_db = 10.0 * kept.log10();
        eprintln!("near-end kept {kept_db:.1} dB");
        assert!(kept_db > -8.0, "near-end voice lost {kept_db:.1} dB in double talk");
    }

    #[test]
    fn transparent_without_far_end() {
        let mut s = 3;
        let near = noise(&mut s, 48_000 * 3);
        let far = vec![0.0; near.len()];
        let mut aec = EchoCanceller::new();
        let out = run(&mut aec, &near, &far);
        let lat = LATENCY_SAMPLES;
        let err: f32 = (N * 4..near.len() - lat).map(|i| (out[i + lat] - near[i]).powi(2)).sum::<f32>() / near.len() as f32;
        assert!(err < 1e-8 * energy(&near).max(1.0) + 1e-9, "not transparent: {err}");
    }

    #[test]
    fn ref_buffer_is_steady_and_silent_when_idle() {
        let mut r = RefBuffer::new();
        let mut out = [1.0; N];
        r.next(&mut out);
        assert!(out.iter().all(|v| *v == 0.0));
        for i in 0..50 {
            r.push(&vec![i as f32; N]);
            r.next(&mut out);
        }
        assert!(out[0] > 0.0);
    }
}

#[cfg(test)]
mod headphone_tests {
    use super::*;

    #[test]
    fn no_ducking_when_nothing_leaks() {
        // Headphones: the far end plays, but none of it reaches the mic.
        let mut seed = 5u32;
        let mut next = |n: usize, s: &mut u32| -> Vec<f32> {
            let mut prev = 0.0;
            (0..n)
                .map(|_| {
                    *s ^= *s << 13;
                    *s ^= *s >> 17;
                    *s ^= *s << 5;
                    prev = 0.9 * prev + 0.3 * ((*s as f32 / u32::MAX as f32) * 2.0 - 1.0);
                    prev
                })
                .collect()
        };
        let far = next(48_000 * 6, &mut seed);
        let mut s2 = 1234u32;
        let near = next(48_000 * 6, &mut s2);
        let mut aec = EchoCanceller::new();
        let mut out = Vec::new();
        for (m, f) in near.chunks_exact(N).zip(far.chunks_exact(N)) {
            let (mut a, mut b) = ([0.0; N], [0.0; N]);
            a.copy_from_slice(m);
            b.copy_from_slice(f);
            aec.process(&mut a, &b);
            out.extend_from_slice(&a);
        }
        let e = |x: &[f32]| x.iter().map(|v| v * v).sum::<f32>();
        let lat = LATENCY_SAMPLES;
        let w = 48_000 * 2..48_000 * 6 - lat;
        let kept = 10.0 * (e(&out[w.start + lat..w.end + lat]) / e(&near[w.clone()])).log10();
        eprintln!("headphones: near-end kept {kept:.1} dB");
        assert!(kept > -1.5, "voice ducked by {kept:.1} dB with nothing leaking");
    }
}

#[cfg(test)]
mod bench {
    use super::*;

    #[test]
    #[ignore]
    fn time_per_block() {
        let mut aec = EchoCanceller::new();
        let far: [f32; N] = std::array::from_fn(|i| ((i * 7919) % 97) as f32 / 97.0 - 0.5);
        let t = std::time::Instant::now();
        for _ in 0..500 {
            let mut m = far;
            aec.process(&mut m, &far);
        }
        eprintln!("aec: {:.2} ms per 10 ms block", t.elapsed().as_secs_f64() * 1000.0 / 500.0);
    }
}
