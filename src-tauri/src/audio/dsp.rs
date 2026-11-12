//! Per-frame DSP that runs after the denoiser: high-pass filter, AGC and a soft limiter.
//!
//! Everything here is allocation-free after construction and operates on 48 kHz mono
//! frames of `FRAME` samples in the usual [-1.0, 1.0] float range.

pub const SAMPLE_RATE: u32 = 48_000;
/// 10 ms at 48 kHz.
pub const FRAME: usize = 480;

#[inline]
pub fn db_to_lin(db: f32) -> f32 {
    10f32.powf(db / 20.0)
}

#[inline]
pub fn lin_to_db(lin: f32) -> f32 {
    20.0 * lin.max(1e-9).log10()
}

/// RBJ biquad, used as a 2nd-order Butterworth high-pass (removes rumble, fan hum, desk thumps).
pub struct HighPass {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    z1: f32,
    z2: f32,
}

impl HighPass {
    pub fn new(cutoff_hz: f32, sample_rate: f32) -> Self {
        let q = std::f32::consts::FRAC_1_SQRT_2;
        let w0 = 2.0 * std::f32::consts::PI * cutoff_hz / sample_rate;
        let (sin, cos) = w0.sin_cos();
        let alpha = sin / (2.0 * q);
        let a0 = 1.0 + alpha;
        Self {
            b0: ((1.0 + cos) / 2.0) / a0,
            b1: (-(1.0 + cos)) / a0,
            b2: ((1.0 + cos) / 2.0) / a0,
            a1: (-2.0 * cos) / a0,
            a2: (1.0 - alpha) / a0,
            z1: 0.0,
            z2: 0.0,
        }
    }

    /// Transposed direct form II.
    pub fn process(&mut self, buf: &mut [f32]) {
        for x in buf.iter_mut() {
            let y = self.b0 * *x + self.z1;
            self.z1 = self.b1 * *x - self.a1 * y + self.z2;
            self.z2 = self.b2 * *x - self.a2 * y;
            *x = y;
        }
    }
}

/// Slow automatic gain control aimed at a speech level of about -18 dBFS.
///
/// Gain only adapts on frames that stand clearly above the background (speech comes in
/// bursts; noise is steady), so pauses and whatever noise the denoiser left behind are
/// never pumped up, even in a loud room.
pub struct Agc {
    target_db: f32,
    gate_db: f32,
    /// A frame must be this far above the noise floor to count as speech.
    speech_margin_db: f32,
    /// Background level: follows dips quickly, rises slowly (min-statistics style).
    floor_db: Option<f32>,
    min_gain_db: f32,
    max_gain_db: f32,
    /// Smoothed speech level estimate.
    level_db: f32,
    /// Current applied gain (linear), ramped per sample.
    gain: f32,
}

impl Agc {
    pub fn new() -> Self {
        Self {
            target_db: -18.0,
            gate_db: -45.0,
            speech_margin_db: 10.0,
            floor_db: None,
            min_gain_db: -12.0,
            max_gain_db: 18.0,
            level_db: -18.0,
            gain: 1.0,
        }
    }

    pub fn process(&mut self, buf: &mut [f32]) {
        let rms = (buf.iter().map(|x| x * x).sum::<f32>() / buf.len() as f32).sqrt();
        let frame_db = lin_to_db(rms);
        let floor = match self.floor_db {
            None => frame_db,
            // Fall fast toward quieter frames; rise at most 0.1 dB per 10 ms (10 dB/s).
            Some(f) if frame_db < f => f + 0.3 * (frame_db - f),
            Some(f) => (f + 0.1).min(frame_db),
        };
        self.floor_db = Some(floor);
        if frame_db > self.gate_db.max(floor + self.speech_margin_db) {
            // Faster when getting louder (avoid shouting blasts), slower when quieter.
            let coeff = if frame_db > self.level_db { 0.25 } else { 0.03 };
            self.level_db += coeff * (frame_db - self.level_db);
        }
        let want_db = (self.target_db - self.level_db).clamp(self.min_gain_db, self.max_gain_db);
        let want = db_to_lin(want_db);
        // Ramp linearly across the frame: no zipper noise.
        let step = (want - self.gain) / buf.len() as f32;
        for x in buf.iter_mut() {
            self.gain += step;
            *x *= self.gain;
        }
    }
}

/// Peak limiter with instant attack and smooth release, followed by a soft clipper so the
/// output can never exceed the ceiling (-1 dBFS).
pub struct Limiter {
    ceiling: f32,
    env: f32,
    release: f32,
}

impl Limiter {
    pub fn new(ceiling_db: f32, release_ms: f32, sample_rate: f32) -> Self {
        Self {
            ceiling: db_to_lin(ceiling_db),
            env: 0.0,
            release: (-1.0 / (release_ms * 0.001 * sample_rate)).exp(),
        }
    }

    pub fn process(&mut self, buf: &mut [f32]) {
        let c = self.ceiling;
        for x in buf.iter_mut() {
            let a = x.abs();
            self.env = if a > self.env { a } else { a + self.release * (self.env - a) };
            if self.env > c {
                *x *= c / self.env;
            }
            // Safety net for anything the envelope missed.
            *x = c * (*x / c).tanh();
        }
    }
}

/// Smoothed RMS/peak meter values for one frame.
#[derive(Clone, Copy, Debug, Default)]
pub struct FrameLevel {
    pub rms: f32,
    pub peak: f32,
}

pub fn measure(buf: &[f32]) -> FrameLevel {
    let mut peak = 0f32;
    let mut sum = 0f32;
    for &x in buf {
        peak = peak.max(x.abs());
        sum += x * x;
    }
    FrameLevel { rms: (sum / buf.len() as f32).sqrt(), peak }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sine(freq: f32, amp: f32, n: usize) -> Vec<f32> {
        (0..n)
            .map(|i| amp * (2.0 * std::f32::consts::PI * freq * i as f32 / SAMPLE_RATE as f32).sin())
            .collect()
    }

    fn rms(b: &[f32]) -> f32 {
        (b.iter().map(|x| x * x).sum::<f32>() / b.len() as f32).sqrt()
    }

    #[test]
    fn highpass_kills_rumble_keeps_voice() {
        let mut hp = HighPass::new(80.0, SAMPLE_RATE as f32);
        let mut low = sine(20.0, 0.5, 48_000);
        hp.process(&mut low);
        let mut hp = HighPass::new(80.0, SAMPLE_RATE as f32);
        let mut voice = sine(1000.0, 0.5, 48_000);
        hp.process(&mut voice);
        // Skip the first 100 ms of filter settling.
        assert!(rms(&low[4800..]) < 0.5 * 0.1, "20 Hz should drop > 20 dB");
        assert!((rms(&voice[4800..]) / rms(&sine(1000.0, 0.5, 48_000))) > 0.97);
    }

    #[test]
    fn agc_does_not_boost_silence() {
        let mut agc = Agc::new();
        let hiss = sine(5000.0, db_to_lin(-60.0), FRAME);
        let mut f = hiss.clone();
        for _ in 0..500 {
            f = hiss.clone();
            agc.process(&mut f);
        }
        // Level estimate starts at target, so gain should stay ~unity.
        assert!(rms(&f) < db_to_lin(-55.0));
    }

    /// Pseudo-random noise at a given RMS level.
    fn noise(rms_db: f32, n: usize, seed: &mut u32) -> Vec<f32> {
        let amp = db_to_lin(rms_db) * 3f32.sqrt() * 2.0; // uniform(-.5,.5)·amp has this RMS
        (0..n)
            .map(|_| {
                *seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                ((*seed >> 8) as f32 / (1u32 << 24) as f32 - 0.5) * amp
            })
            .collect()
    }

    /// Leftover noise in a loud room (above the old fixed -45 dBFS gate) must not be boosted
    /// in pauses: that would undo the noise cancellation.
    #[test]
    fn agc_does_not_boost_steady_background_noise() {
        let mut agc = Agc::new();
        let mut seed = 7;
        let mut out = vec![];
        for _ in 0..1000 {
            // 10 s of noise only, at -35 dBFS
            let mut f = noise(-35.0, FRAME, &mut seed);
            agc.process(&mut f);
            out = f;
        }
        let out_db = lin_to_db(rms(&out));
        assert!(out_db < -33.0, "background noise was boosted to {out_db:.1} dBFS");
    }

    /// Syllable-like bursts over a noise floor: the AGC must still lift quiet speech.
    #[test]
    fn agc_lifts_quiet_speech_over_noise() {
        let mut agc = Agc::new();
        let mut seed = 9;
        let mut speech_db = vec![];
        for i in 0..1000 {
            let talking = (i % 30) < 20; // 200 ms syllable, 100 ms gap
            let mut f = noise(-55.0, FRAME, &mut seed);
            if talking {
                let s = sine(300.0, db_to_lin(-30.0) * std::f32::consts::SQRT_2, FRAME);
                for (x, y) in f.iter_mut().zip(&s) {
                    *x += y;
                }
            }
            agc.process(&mut f);
            if talking && i > 800 {
                speech_db.push(lin_to_db(rms(&f)));
            }
        }
        let avg = speech_db.iter().sum::<f32>() / speech_db.len() as f32;
        assert!((avg - -18.0).abs() < 2.0, "speech at {avg:.1} dBFS, want about -18");
    }

    #[test]
    fn limiter_respects_ceiling() {
        let mut lim = Limiter::new(-1.0, 50.0, SAMPLE_RATE as f32);
        let mut loud = sine(440.0, 3.0, 48_000);
        lim.process(&mut loud);
        let peak = loud.iter().fold(0f32, |m, x| m.max(x.abs()));
        assert!(peak <= db_to_lin(-1.0) + 1e-6, "peak {peak}");
    }
}
