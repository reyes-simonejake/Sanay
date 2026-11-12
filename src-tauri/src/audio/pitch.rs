//! Streaming speaker analysis on a 12 kHz copy of the voice:
//! * pitch (YIN), reported as the median F0 of the last few seconds of voiced speech;
//! * apparent vocal-tract length (VTL) from formant dispersion, the main "voice size" cue.
//!
//! The voice-type stage moves each speaker toward a target pitch *and* a target VTL, so a
//! preset changes both cues people use to hear a man or a woman.
//!
//! VTL (Fitch 1997; Reby & McComb 2003): for a tube closed at the glottis Fi = (2i-1)·c/(4L),
//! so a least-squares fit of F1..F4 against (2i-1)/2 gives the spacing dF = c/(2L).
//! Typical adults: men ~17–18 cm (dF ≈ 1000 Hz), women ~14–15 cm (dF ≈ 1200 Hz).
//! Formants come from 12th-order LPC roots of a 25 ms pre-emphasised frame.
//!
//! Mirrors `web/audio/sanay-pitch.js`.

use std::collections::VecDeque;

const DECIM: usize = 4; // 48 kHz → 12 kHz (plenty for F0 < 500 Hz and formants < 5 kHz)
const RATE: f32 = 12_000.0;
const WIN: usize = 480; // 40 ms analysis window
const HOP: usize = 120; // 10 ms
const TAU_MIN: usize = (RATE / 400.0) as usize; // 400 Hz
const TAU_MAX: usize = (RATE / 60.0) as usize; // 60 Hz
const THRESHOLD: f32 = 0.2;
/// Median over this many voiced frames (~3 s of speech).
const HISTORY: usize = 300;
/// Need at least this many voiced frames (~0.2 s) before trusting the median.
const MIN_VOICED: usize = 20;
/// Ignore frames quieter than this (RMS, linear) — pauses and leftover noise.
const MIN_RMS: f32 = 0.005; // ≈ -46 dBFS

const LPC_ORDER: usize = 12;
const LPC_WIN: usize = 300; // 25 ms
const SPEED_OF_SOUND_CM: f32 = 35_000.0;

pub struct PitchTracker {
    buf: Vec<f32>,
    acc: f32,
    acc_n: usize,
    since_hop: usize,
    diff: Vec<f32>,
    voiced: VecDeque<f32>,
    spacing: VecDeque<f32>,
}

impl Default for PitchTracker {
    fn default() -> Self {
        Self::new()
    }
}

impl PitchTracker {
    pub fn new() -> Self {
        Self {
            buf: Vec::with_capacity(WIN + TAU_MAX + HOP),
            acc: 0.0,
            acc_n: 0,
            since_hop: 0,
            diff: vec![0.0; TAU_MAX + 1],
            voiced: VecDeque::with_capacity(HISTORY + 1),
            spacing: VecDeque::with_capacity(HISTORY + 1),
        }
    }

    /// Feed 48 kHz mono samples.
    pub fn push(&mut self, samples: &[f32]) {
        for &x in samples {
            self.acc += x;
            self.acc_n += 1;
            if self.acc_n < DECIM {
                continue;
            }
            self.buf.push(self.acc / DECIM as f32);
            self.acc = 0.0;
            self.acc_n = 0;
            if self.buf.len() > WIN + TAU_MAX {
                self.buf.remove(0);
            }
            self.since_hop += 1;
            if self.since_hop >= HOP && self.buf.len() == WIN + TAU_MAX {
                self.since_hop = 0;
                if let Some(f) = self.analyse() {
                    push_capped(&mut self.voiced, f);
                    if let Some(d) = formant_spacing(&self.buf[..LPC_WIN]) {
                        push_capped(&mut self.spacing, d);
                    }
                }
            }
        }
    }

    fn analyse(&mut self) -> Option<f32> {
        let y = &self.buf;
        let rms = (y[..WIN].iter().map(|v| v * v).sum::<f32>() / WIN as f32).sqrt();
        if rms < MIN_RMS {
            return None;
        }
        for tau in 1..=TAU_MAX {
            let mut s = 0.0;
            for k in 0..WIN {
                let d = y[k] - y[k + tau];
                s += d * d;
            }
            self.diff[tau] = s;
        }
        // Cumulative-mean-normalised difference; first dip below the threshold.
        let mut running = 0.0;
        for tau in 1..=TAU_MAX {
            running += self.diff[tau];
            let cmnd = self.diff[tau] * tau as f32 / running.max(1e-12);
            if tau >= TAU_MIN && cmnd < THRESHOLD {
                let mut t = tau;
                while t < TAU_MAX && self.diff[t + 1] < self.diff[t] {
                    t += 1;
                }
                return Some(RATE / t as f32);
            }
        }
        None
    }

    /// Median F0 (Hz) of recent voiced speech, once enough has been heard.
    pub fn median(&self) -> Option<f32> {
        median_of(&self.voiced)
    }

    /// Apparent vocal-tract length (cm) of recent voiced speech, once enough has been heard.
    pub fn vtl_cm(&self) -> Option<f32> {
        median_of(&self.spacing).map(|d| SPEED_OF_SOUND_CM / (2.0 * d))
    }
}

fn push_capped(q: &mut VecDeque<f32>, v: f32) {
    q.push_back(v);
    if q.len() > HISTORY {
        q.pop_front();
    }
}

fn median_of(q: &VecDeque<f32>) -> Option<f32> {
    if q.len() < MIN_VOICED {
        return None;
    }
    let mut v: Vec<f32> = q.iter().copied().collect();
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    Some(v[v.len() / 2])
}

/// Formant spacing dF (Hz) of one voiced frame (12 kHz), or None if < 4 clear formants.
pub(crate) fn formant_spacing(frame: &[f32]) -> Option<f32> {
    let n = frame.len();
    // Pre-emphasis + Hamming, in f64 for a well-conditioned LPC.
    let mut x = vec![0.0f64; n];
    for i in 0..n {
        let pre = frame[i] as f64 - if i > 0 { 0.97 * frame[i - 1] as f64 } else { 0.0 };
        x[i] = pre * (0.54 - 0.46 * (2.0 * std::f64::consts::PI * i as f64 / (n - 1) as f64).cos());
    }
    let a = lpc(&x, LPC_ORDER)?;
    let roots = poly_roots(&a);
    let mut f: Vec<f64> = roots
        .iter()
        .filter(|r| r.1 > 0.0)
        .filter_map(|&(re, im)| {
            let hz = im.atan2(re) * RATE as f64 / (2.0 * std::f64::consts::PI);
            let bw = -(re * re + im * im).sqrt().ln() * RATE as f64 / std::f64::consts::PI;
            (hz > 200.0 && hz < 4800.0 && bw < 500.0).then_some(hz)
        })
        .collect();
    if f.len() < 4 {
        return None;
    }
    f.sort_by(|a, b| a.partial_cmp(b).unwrap());
    // Least squares through the origin: Fi ≈ dF·(2i-1)/2.
    let (mut num, mut den) = (0.0, 0.0);
    for (i, &fi) in f.iter().take(4).enumerate() {
        let k = (2 * i + 1) as f64 / 2.0;
        num += fi * k;
        den += k * k;
    }
    Some((num / den) as f32)
}

/// LPC coefficients a[0..=order] (a[0] = 1) by autocorrelation + Levinson–Durbin.
fn lpc(x: &[f64], order: usize) -> Option<Vec<f64>> {
    let r: Vec<f64> = (0..=order).map(|l| (0..x.len() - l).map(|i| x[i] * x[i + l]).sum()).collect();
    if r[0] <= 1e-12 {
        return None;
    }
    let mut a = vec![0.0; order + 1];
    a[0] = 1.0;
    let mut e = r[0];
    for i in 1..=order {
        let mut acc = r[i];
        for j in 1..i {
            acc += a[j] * r[i - j];
        }
        let k = -acc / e;
        let prev = a.clone();
        for j in 1..i {
            a[j] = prev[j] + k * prev[i - j];
        }
        a[i] = k;
        e *= 1.0 - k * k;
        if e <= 0.0 {
            return None;
        }
    }
    Some(a)
}

/// Roots of a[0]·z^n + a[1]·z^(n-1) + … + a[n] (Durand–Kerner), as (re, im).
fn poly_roots(a: &[f64]) -> Vec<(f64, f64)> {
    let n = a.len() - 1;
    let mul = |p: (f64, f64), q: (f64, f64)| (p.0 * q.0 - p.1 * q.1, p.0 * q.1 + p.1 * q.0);
    let div = |p: (f64, f64), q: (f64, f64)| {
        let d = q.0 * q.0 + q.1 * q.1;
        ((p.0 * q.0 + p.1 * q.1) / d, (p.1 * q.0 - p.0 * q.1) / d)
    };
    let eval = |z: (f64, f64)| {
        a.iter().fold((0.0, 0.0), |acc, &c| {
            let m = mul(acc, z);
            (m.0 + c, m.1)
        })
    };
    // Start on a circle of radius 0.9 (LPC roots are inside the unit circle), rotated off-axis.
    let mut z: Vec<(f64, f64)> = (0..n)
        .map(|k| {
            let t = 2.0 * std::f64::consts::PI * k as f64 / n as f64 + 0.4;
            (0.9 * t.cos(), 0.9 * t.sin())
        })
        .collect();
    for _ in 0..200 {
        let mut moved = 0.0f64;
        for i in 0..n {
            let mut den = (a[0], 0.0);
            for j in 0..n {
                if i != j {
                    den = mul(den, (z[i].0 - z[j].0, z[i].1 - z[j].1));
                }
            }
            let step = div(eval(z[i]), den);
            z[i] = (z[i].0 - step.0, z[i].1 - step.1);
            moved = moved.max(step.0.abs() + step.1.abs());
        }
        if moved < 1e-10 {
            break;
        }
    }
    z
}

#[cfg(test)]
mod tests {
    use super::*;

    fn voiced(freq: f32, secs: f32) -> Vec<f32> {
        let n = (48_000.0 * secs) as usize;
        (0..n)
            .map(|i| {
                let t = i as f32 / 48_000.0;
                (1..=8).map(|h| (2.0 * std::f32::consts::PI * freq * h as f32 * t).sin() / h as f32).sum::<f32>() * 0.1
            })
            .collect()
    }

    #[test]
    fn finds_male_and_female_pitch() {
        for f in [95.0, 120.0, 180.0, 230.0] {
            let mut p = PitchTracker::new();
            p.push(&voiced(f, 2.0));
            let m = p.median().expect("estimate");
            assert!((m - f).abs() / f < 0.03, "{f} Hz estimated as {m}");
        }
    }

    #[test]
    fn silence_gives_no_estimate() {
        let mut p = PitchTracker::new();
        p.push(&vec![0.0; 96_000]);
        assert!(p.median().is_none());
        assert!(p.vtl_cm().is_none());
    }

    /// A pulse train through resonators at a uniform tube's formants for length L
    /// (Fi = (2i-1)·c/4L) must come back as L.
    #[test]
    fn measures_vocal_tract_length_of_a_tube() {
        for len_cm in [14.5f32, 17.5] {
            let sr = RATE;
            let formants: Vec<f32> = (1..=4).map(|i| (2 * i - 1) as f32 * SPEED_OF_SOUND_CM / (4.0 * len_cm)).collect();
            let n = 2400;
            let mut x: Vec<f32> = (0..n).map(|i| if i % 100 == 0 { 1.0 } else { 0.0 }).collect(); // 120 Hz pulses
            for &f in &formants {
                // Two-pole resonator, 80 Hz bandwidth.
                let r = (-std::f32::consts::PI * 80.0 / sr).exp();
                let c = 2.0 * r * (2.0 * std::f32::consts::PI * f / sr).cos();
                let (mut y1, mut y2) = (0.0, 0.0);
                for v in x.iter_mut() {
                    let y = *v + c * y1 - r * r * y2;
                    y2 = y1;
                    y1 = y;
                    *v = y;
                }
            }
            let d = formant_spacing(&x[1200..1200 + LPC_WIN]).expect("4 formants");
            let got = SPEED_OF_SOUND_CM / (2.0 * d);
            assert!((got - len_cm).abs() < 0.6, "tube {len_cm} cm measured as {got:.2} cm");
        }
    }
}
