//! Cleanup stages for a "studio-quiet" result:
//!
//! * [`HumRemover`] — electrical hum / ground-loop buzz. It listens during pauses, detects
//!   mains hum (50 or 60 Hz and harmonics) and engages very narrow notch filters (≈4 Hz wide)
//!   on it, plus a 70 Hz high-pass for rumble. Runs *before* the denoiser so both RNNoise and
//!   GTCRN get a cleaner signal (RNNoise alone left 60 Hz hum only ~10 dB down).
//! * [`Expander`] — pause cleanup. Between words, whatever the denoiser left is pushed further
//!   down (depth follows the NC strength), so pauses sound silent instead of "grounded".
//!
//! Mirrors `web/audio/sanay-prefilter.js` and the expander in `web/audio/sanay-processor.js`.

use super::character::Biquad;
use super::dsp::{db_to_lin, lin_to_db};

const HARMONICS: usize = 8;
/// Analyse 0.25 s of *unbroken* pause audio at a time (4 Hz resolution; pauses are short).
const ANALYSIS_SAMPLES: usize = 12_000;

/// Goertzel power (linear) of `x` at `f`, Hann-windowed (keeps strong hum from leaking into
/// the neighbouring frequencies used as reference).
fn goertzel(x: &[f32], f: f32, sr: f32) -> f32 {
    let w = 2.0 * std::f32::consts::PI * f / sr;
    let c = 2.0 * w.cos();
    let n = x.len() as f32;
    let (mut s1, mut s2) = (0.0f32, 0.0f32);
    for (i, &v) in x.iter().enumerate() {
        let hann = 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / n).cos();
        let v = v * hann;
        let s0 = v + c * s1 - s2;
        s2 = s1;
        s1 = s0;
    }
    (s1 * s1 + s2 * s2 - c * s1 * s2) / (x.len() * x.len()) as f32
}

pub struct HumRemover {
    sr: f32,
    rumble: Biquad,
    notches: Vec<Biquad>,
    /// Detected mains frequency (50 or 60), once confirmed.
    mains: Option<f32>,
    quiet: Vec<f32>,
    floor_db: Option<f32>,
    /// ~50 ms smoothed level, for deciding what counts as a pause.
    level_db: Option<f32>,
    hits: u32,
    misses: u32,
}

impl HumRemover {
    pub fn new(sr: u32) -> Self {
        let sr = sr as f32;
        Self {
            sr,
            rumble: Biquad::high_pass(70.0, std::f32::consts::FRAC_1_SQRT_2, sr),
            notches: Vec::new(),
            mains: None,
            quiet: Vec::with_capacity(ANALYSIS_SAMPLES),
            floor_db: None,
            level_db: None,
            hits: 0,
            misses: 0,
        }
    }

    pub fn mains(&self) -> Option<f32> {
        self.mains
    }

    /// Hum strength score for a mains frequency: how many of the first 4 harmonics stand
    /// ≥ 8 dB above their ±8 Hz neighbours.
    fn score(x: &[f32], mains: f32, sr: f32) -> usize {
        (1..=4)
            .filter(|&k| {
                let f = mains * k as f32;
                let p = lin_to_db(goertzel(x, f, sr).sqrt());
                let n = lin_to_db(((goertzel(x, f - 12.0, sr) + goertzel(x, f + 12.0, sr)) / 2.0).sqrt());
                p - n >= 8.0 && p > -95.0
            })
            .count()
    }

    fn analyse(&mut self) {
        let s50 = Self::score(&self.quiet, 50.0, self.sr);
        let s60 = Self::score(&self.quiet, 60.0, self.sr);
        let found = if s60 >= 2 && s60 >= s50 {
            Some(60.0)
        } else if s50 >= 2 {
            Some(50.0)
        } else {
            None
        };
        match found {
            Some(m) => {
                self.misses = 0;
                self.hits += 1;
                // Three analyses in a row (≈0.75 s of pauses) before switching notches on.
                if self.hits >= 3 && self.mains != Some(m) {
                    log::info!("hum remover: {m} Hz mains hum detected, notching {HARMONICS} harmonics");
                    self.mains = Some(m);
                    self.notches = (1..=HARMONICS)
                        .map(|k| {
                            let f = m * k as f32;
                            notch(f, f / 4.0, self.sr) // ≈4 Hz wide
                        })
                        .collect();
                }
            }
            None => {
                self.hits = 0;
                self.misses += 1;
                // Hum gone for ~5 s of pauses (e.g. charger unplugged): stop notching.
                if self.misses >= 20 && self.mains.is_some() {
                    log::info!("hum remover: hum gone, notches off");
                    self.mains = None;
                    self.notches.clear();
                }
            }
        }
        self.quiet.clear();
    }

    pub fn process(&mut self, frame: &mut [f32]) {
        // Collect unbroken pause audio (smoothed level near the background) for detection.
        // Gluing non-adjacent pieces together would smear the hum and fool the detector.
        let rms = (frame.iter().map(|v| v * v).sum::<f32>() / frame.len() as f32).sqrt();
        let now = lin_to_db(rms);
        let db = match self.level_db {
            None => now,
            Some(l) => l + 0.2 * (now - l), // ~50 ms
        };
        self.level_db = Some(db);
        let floor = match self.floor_db {
            None => db,
            Some(f) if db < f => f + 0.3 * (db - f),
            Some(f) => (f + 0.1).min(db),
        };
        self.floor_db = Some(floor);
        if db < floor + 8.0 {
            let room = ANALYSIS_SAMPLES - self.quiet.len();
            self.quiet.extend_from_slice(&frame[..frame.len().min(room)]);
            if self.quiet.len() >= ANALYSIS_SAMPLES {
                self.analyse();
            }
        } else {
            self.quiet.clear(); // speech: start a fresh stretch
        }
        for x in frame.iter_mut() {
            let mut y = self.rumble.tick(*x);
            for n in self.notches.iter_mut() {
                y = n.tick(y);
            }
            *x = y;
        }
    }
}

/// RBJ notch.
fn notch(f: f32, q: f32, sr: f32) -> Biquad {
    let w0 = 2.0 * std::f32::consts::PI * f / sr;
    let (sin, cos) = w0.sin_cos();
    let alpha = sin / (2.0 * q);
    Biquad::raw(1.0, -2.0 * cos, 1.0, 1.0 + alpha, -2.0 * cos, 1.0 - alpha)
}

/// Downward expander for pauses: when the signal falls back to the background level, ease
/// it down by `depth_db`; open instantly-ish when speech returns, close gently after a hold.
pub struct Expander {
    floor_db: Option<f32>,
    open: bool,
    hold_frames: u32,
    gain: f32,
}

impl Expander {
    pub fn new() -> Self {
        Self { floor_db: None, open: true, hold_frames: 0, gain: 1.0 }
    }

    /// `depth_db` = 0 disables it.
    pub fn process(&mut self, frame: &mut [f32], depth_db: f32) {
        let n = frame.len();
        let db = lin_to_db((frame.iter().map(|v| v * v).sum::<f32>() / n as f32).sqrt());
        let floor = match self.floor_db {
            None => db,
            Some(f) if db < f => f + 0.3 * (db - f),
            Some(f) => (f + 0.1).min(db),
        };
        self.floor_db = Some(floor);

        // Hysteresis: open 8 dB above the floor, close below 4 dB, hold 200 ms.
        let frames_per_200ms = (0.2 * 48_000.0 / n as f32) as u32;
        if db > floor + 8.0 {
            self.open = true;
            self.hold_frames = frames_per_200ms;
        } else if db < floor + 4.0 {
            if self.hold_frames > 0 {
                self.hold_frames -= 1;
            } else {
                self.open = false;
            }
        }
        let target = if self.open || depth_db <= 0.0 { 1.0 } else { db_to_lin(-depth_db) };
        // Open in ~5 ms, close over ~80 ms.
        let per_sample = if target > self.gain { 1.0 - (-1.0 / (0.005 * 48_000.0f32)).exp() } else { 1.0 - (-1.0 / (0.08 * 48_000.0f32)).exp() };
        for x in frame.iter_mut() {
            self.gain += per_sample * (target - self.gain);
            *x *= self.gain;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::dsp::{FRAME, SAMPLE_RATE};

    fn rms(x: &[f32]) -> f32 {
        (x.iter().map(|v| v * v).sum::<f32>() / x.len() as f32).sqrt()
    }

    fn hum(mains: f32, n: usize) -> Vec<f32> {
        (0..n)
            .map(|i| {
                let t = i as f32 / SAMPLE_RATE as f32;
                0.02 * ((2.0 * std::f32::consts::PI * mains * t).sin()
                    + 0.7 * (2.0 * std::f32::consts::PI * 2.0 * mains * t).sin()
                    + 0.5 * (2.0 * std::f32::consts::PI * 3.0 * mains * t).sin())
            })
            .collect()
    }

    fn run(h: &mut HumRemover, mut x: Vec<f32>) -> Vec<f32> {
        for f in x.chunks_mut(FRAME) {
            h.process(f);
        }
        x
    }

    #[test]
    fn detects_and_removes_60hz_hum() {
        let mut h = HumRemover::new(SAMPLE_RATE);
        let out = run(&mut h, hum(60.0, SAMPLE_RATE as usize * 4));
        assert_eq!(h.mains(), Some(60.0));
        let tail = &out[3 * SAMPLE_RATE as usize..];
        let reduction = lin_to_db(rms(tail) / rms(&hum(60.0, tail.len())));
        assert!(reduction < -20.0, "hum only reduced {reduction:.1} dB");
    }

    #[test]
    fn detects_50hz_too() {
        let mut h = HumRemover::new(SAMPLE_RATE);
        run(&mut h, hum(50.0, SAMPLE_RATE as usize * 4));
        assert_eq!(h.mains(), Some(50.0));
    }

    #[test]
    fn no_hum_no_notches_and_voice_band_untouched() {
        let mut h = HumRemover::new(SAMPLE_RATE);
        let tone: Vec<f32> = (0..SAMPLE_RATE as usize * 4)
            .map(|i| 0.1 * (2.0 * std::f32::consts::PI * 1000.0 * i as f32 / SAMPLE_RATE as f32).sin())
            .collect();
        let out = run(&mut h, tone.clone());
        assert_eq!(h.mains(), None);
        let g = lin_to_db(rms(&out[SAMPLE_RATE as usize..]) / rms(&tone[SAMPLE_RATE as usize..]));
        assert!(g.abs() < 0.2, "1 kHz changed by {g:.2} dB");
    }

    #[test]
    fn expander_quiets_pauses_but_keeps_speech() {
        let mut e = Expander::new();
        let mut seed = 3u32;
        let mut noise = |amp: f32| -> Vec<f32> {
            (0..FRAME)
                .map(|_| {
                    seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                    ((seed >> 8) as f32 / (1u32 << 24) as f32 - 0.5) * amp
                })
                .collect()
        };
        let (mut pause, mut speech) = (vec![], vec![]);
        for i in 0..600 {
            let talking = (i / 50) % 2 == 1; // 0.5 s on / 0.5 s off
            let mut f = noise(if talking { 0.3 } else { 0.01 });
            let before = rms(&f);
            e.process(&mut f, 18.0);
            let g = lin_to_db(rms(&f) / before);
            if i > 200 && i % 50 > 30 {
                if talking { speech.push(g) } else { pause.push(g) }
            }
        }
        let avg = |v: &Vec<f32>| v.iter().sum::<f32>() / v.len() as f32;
        assert!(avg(&pause) < -12.0, "pauses only {:.1} dB down", avg(&pause));
        assert!(avg(&speech) > -0.5, "speech changed by {:.1} dB", avg(&speech));
    }
}

/// `cargo test --release --lib real_speech_hum -- --ignored --nocapture`
#[cfg(test)]
mod real_speech_hum {
    use super::*;
    use crate::audio::dsp::{FRAME, SAMPLE_RATE};
    use crate::audio::voice::real_speech::read_wav;

    #[test]
    #[ignore]
    fn real_speech_with_60hz_hum() {
        let Some(speech) = read_wav("../tests/audio_samples/speech_male.wav") else { return };
        let sr = SAMPLE_RATE as f32;
        let hum: Vec<f32> = (0..speech.len())
            .map(|i| {
                let t = i as f32 / sr;
                0.01 * ((2.0 * std::f32::consts::PI * 60.0 * t).sin() + 0.7 * (2.0 * std::f32::consts::PI * 120.0 * t).sin() + 0.5 * (2.0 * std::f32::consts::PI * 180.0 * t).sin())
            })
            .collect();
        let x: Vec<f32> = speech.iter().zip(&hum).map(|(s, h)| s * 0.5 + h).collect();
        let mut h = HumRemover::new(SAMPLE_RATE);
        let mut y = x.clone();
        let mut detected_at = None;
        for (i, f) in y.chunks_mut(FRAME).enumerate() {
            h.process(f);
            if detected_at.is_none() && h.mains().is_some() {
                detected_at = Some(i as f32 * FRAME as f32 / sr);
            }
        }
        // Hum level left: Goertzel at each harmonic over the second half, output vs input.
        let half = x.len() / 2;
        for f in [60.0, 120.0, 180.0] {
            let before = lin_to_db(goertzel(&x[half..], f, sr).sqrt());
            let after = lin_to_db(goertzel(&y[half..], f, sr).sqrt());
            println!("{f} Hz: {:+.1} dB", after - before);
        }
        // Voice band untouched? 1–3 kHz energy ratio.
        let band = |v: &[f32]| v.iter().map(|a| a * a).sum::<f32>();
        println!("detected {:?} at {:?} s, overall level change {:+.2} dB", h.mains(), detected_at, 10.0 * (band(&y[half..]) / band(&x[half..])).log10());
    }
}
