//! "Professional voice" character chain for the voice-type presets: broadcast-style EQ,
//! a gentle compressor and a de-esser. This is what makes a voice sound polished and
//! confident.
//!
//! Mirrors the `Character` section of `web/audio/sanay-processor.js`.
//!
//! * Light (used by Feminine): low cut below 150 Hz (no "grounded" rumble under the voice),
//!   +presence at 3.2 kHz, +air at 10 kHz, de-essing for the extra sparkle.
//! * Crisp (used by Masculine): −boxiness at 250 Hz, +presence at 4.5 kHz, +air at 10 kHz,
//!   and stronger de-essing so the extra brightness never turns harsh on "s" sounds.

use super::dsp::{db_to_lin, lin_to_db};

/// Which character to apply.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Preset {
    Off,
    /// "Clarity boost" for the natural voice: de-mud, presence, de-essing.
    Clear,
    /// Light and clear (Feminine).
    Light,
    /// Crisp and present (Masculine).
    Crisp,
}

/// RBJ "Audio EQ Cookbook" biquad.
#[derive(Clone, Copy)]
pub struct Biquad {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    z1: f32,
    z2: f32,
}

impl Biquad {
    /// Coefficients as in the cookbook (normalised by `a0` here).
    pub fn raw(b0: f32, b1: f32, b2: f32, a0: f32, a1: f32, a2: f32) -> Self {
        Self::from(b0, b1, b2, a0, a1, a2)
    }

    fn from(b0: f32, b1: f32, b2: f32, a0: f32, a1: f32, a2: f32) -> Self {
        Self { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, z1: 0.0, z2: 0.0 }
    }

    fn w(f: f32, sr: f32) -> (f32, f32) {
        let w0 = 2.0 * std::f32::consts::PI * f / sr;
        (w0.sin(), w0.cos())
    }

    pub fn peaking(f: f32, q: f32, gain_db: f32, sr: f32) -> Self {
        let a = 10f32.powf(gain_db / 40.0);
        let (sin, cos) = Self::w(f, sr);
        let alpha = sin / (2.0 * q);
        Self::from(1.0 + alpha * a, -2.0 * cos, 1.0 - alpha * a, 1.0 + alpha / a, -2.0 * cos, 1.0 - alpha / a)
    }

    pub fn low_shelf(f: f32, gain_db: f32, sr: f32) -> Self {
        let a = 10f32.powf(gain_db / 40.0);
        let (sin, cos) = Self::w(f, sr);
        let alpha = sin / 2.0 * std::f32::consts::SQRT_2; // S = 1
        let k = 2.0 * a.sqrt() * alpha;
        Self::from(
            a * ((a + 1.0) - (a - 1.0) * cos + k),
            2.0 * a * ((a - 1.0) - (a + 1.0) * cos),
            a * ((a + 1.0) - (a - 1.0) * cos - k),
            (a + 1.0) + (a - 1.0) * cos + k,
            -2.0 * ((a - 1.0) + (a + 1.0) * cos),
            (a + 1.0) + (a - 1.0) * cos - k,
        )
    }

    pub fn high_shelf(f: f32, gain_db: f32, sr: f32) -> Self {
        let a = 10f32.powf(gain_db / 40.0);
        let (sin, cos) = Self::w(f, sr);
        let alpha = sin / 2.0 * std::f32::consts::SQRT_2;
        let k = 2.0 * a.sqrt() * alpha;
        Self::from(
            a * ((a + 1.0) + (a - 1.0) * cos + k),
            -2.0 * a * ((a - 1.0) + (a + 1.0) * cos),
            a * ((a + 1.0) + (a - 1.0) * cos - k),
            (a + 1.0) - (a - 1.0) * cos + k,
            2.0 * ((a - 1.0) - (a + 1.0) * cos),
            (a + 1.0) - (a - 1.0) * cos - k,
        )
    }

    pub fn high_pass(f: f32, q: f32, sr: f32) -> Self {
        let (sin, cos) = Self::w(f, sr);
        let alpha = sin / (2.0 * q);
        Self::from((1.0 + cos) / 2.0, -(1.0 + cos), (1.0 + cos) / 2.0, 1.0 + alpha, -2.0 * cos, 1.0 - alpha)
    }

    /// Replace the coefficients, keep the filter state (no click on preset changes).
    fn retune(&mut self, other: Biquad) {
        let (z1, z2) = (self.z1, self.z2);
        *self = other;
        self.z1 = z1;
        self.z2 = z2;
    }

    #[inline]
    pub fn tick(&mut self, x: f32) -> f32 {
        let y = self.b0 * x + self.z1;
        self.z1 = self.b1 * x - self.a1 * y + self.z2;
        self.z2 = self.b2 * x - self.a2 * y;
        y
    }
}

/// Gentle feed-forward compressor on an RMS-style detector (follows loudness, not every
/// peak), soft knee. Evens out delivery; overall level is the AGC's job afterwards.
struct Compressor {
    threshold_db: f32,
    ratio: f32,
    knee_db: f32,
    attack: f32,
    release: f32,
    /// Smoothed signal power.
    power: f32,
}

impl Compressor {
    fn new(sr: f32) -> Self {
        Self {
            threshold_db: -24.0,
            ratio: 2.0,
            knee_db: 8.0,
            attack: (-1.0 / (0.010 * sr)).exp(),
            release: (-1.0 / (0.150 * sr)).exp(),
            power: 0.0,
        }
    }

    #[inline]
    fn gain(&mut self, x: f32) -> f32 {
        let p = x * x;
        let c = if p > self.power { self.attack } else { self.release };
        self.power = p + c * (self.power - p);
        let env_db = 10.0 * self.power.max(1e-12).log10();
        let over = env_db - self.threshold_db;
        let gr = if over <= -self.knee_db / 2.0 {
            0.0
        } else if over >= self.knee_db / 2.0 {
            over * (1.0 - 1.0 / self.ratio)
        } else {
            let t = over + self.knee_db / 2.0;
            (1.0 - 1.0 / self.ratio) * t * t / (2.0 * self.knee_db)
        };
        db_to_lin(-gr)
    }
}

/// De-esser as a dynamic high shelf: a detector listens above `freq`; when sibilance is loud
/// the shelf cuts the highs by up to `max_reduction_db`, otherwise it is flat (0 dB).
/// (A subtractive split-band design leaked through because of biquad phase shift.)
struct DeEsser {
    sr: f32,
    freq: f32,
    detector: Biquad,
    shelf: Biquad,
    threshold_db: f32,
    max_reduction_db: f32,
    env: f32,
    attack: f32,
    release: f32,
    counter: u32,
    applied_db: f32,
}

impl DeEsser {
    fn new(freq: f32, sr: f32) -> Self {
        Self {
            sr,
            freq,
            detector: Biquad::high_pass(freq, std::f32::consts::FRAC_1_SQRT_2, sr),
            shelf: Biquad::high_shelf(freq, 0.0, sr),
            threshold_db: -30.0,
            max_reduction_db: 0.0,
            env: 0.0,
            attack: (-1.0 / (0.001 * sr)).exp(),
            release: (-1.0 / (0.06 * sr)).exp(),
            counter: 0,
            applied_db: 0.0,
        }
    }

    fn set_freq(&mut self, freq: f32) {
        self.freq = freq;
        self.detector.retune(Biquad::high_pass(freq, std::f32::consts::FRAC_1_SQRT_2, self.sr));
    }

    #[inline]
    fn tick(&mut self, x: f32) -> f32 {
        let h = self.detector.tick(x);
        let a = h.abs();
        let c = if a > self.env { self.attack } else { self.release };
        self.env = a + c * (self.env - a);
        // Re-tune the shelf every 16 samples (cheap, and smooth enough at 3 kHz control rate).
        self.counter += 1;
        if self.counter >= 16 {
            self.counter = 0;
            let over = lin_to_db(self.env) - self.threshold_db;
            let red = if self.max_reduction_db > 0.0 { (over * 0.6).clamp(0.0, self.max_reduction_db) } else { 0.0 };
            if (red - self.applied_db).abs() > 0.1 {
                self.shelf.retune(Biquad::high_shelf(self.freq, -red, self.sr));
                self.applied_db = red;
            }
        }
        self.shelf.tick(x)
    }
}

/// EQ bands per preset at full amount: (kind, freq, q, gain dB).
#[derive(Clone, Copy)]
enum Band {
    LowShelf(f32, f32),
    Peak(f32, f32, f32),
    HighShelf(f32, f32),
}

fn bands(p: Preset) -> [Band; 3] {
    match p {
        // Cut the low end (a female voice has nothing useful below ~150 Hz), presence, air.
        Preset::Light => [Band::LowShelf(150.0, -6.0), Band::Peak(3200.0, 1.0, 2.5), Band::HighShelf(10_000.0, 3.0)],
        Preset::Crisp => [Band::Peak(250.0, 1.0, -2.0), Band::Peak(4500.0, 0.9, 3.0), Band::HighShelf(10_000.0, 2.5)],
        Preset::Clear => [Band::Peak(300.0, 1.0, -2.0), Band::Peak(3200.0, 1.0, 2.5), Band::HighShelf(9000.0, 1.5)],
        Preset::Off => [Band::Peak(1000.0, 1.0, 0.0); 3],
    }
}

/// De-esser crossover frequency and maximum reduction (dB) per preset.
fn de_ess(p: Preset) -> (f32, f32) {
    match p {
        Preset::Light => (7000.0, 8.0),
        Preset::Crisp => (7000.0, 9.0),
        Preset::Clear => (6800.0, 6.0),
        Preset::Off => (7000.0, 0.0),
    }
}

pub struct Character {
    sr: f32,
    eq: [Biquad; 3],
    comp: Compressor,
    deess: DeEsser,
    current: Option<(Preset, f32)>,
}

impl Character {
    pub fn new(sr: u32) -> Self {
        let sr = sr as f32;
        Self {
            sr,
            eq: [Biquad::peaking(1000.0, 1.0, 0.0, sr); 3],
            comp: Compressor::new(sr),
            deess: DeEsser::new(7000.0, sr),
            current: None,
        }
    }

    fn configure(&mut self, preset: Preset, amount: f32) {
        for (f, b) in self.eq.iter_mut().zip(bands(preset)) {
            let next = match b {
                Band::LowShelf(fr, g) => Biquad::low_shelf(fr, g * amount, self.sr),
                Band::Peak(fr, q, g) => Biquad::peaking(fr, q, g * amount, self.sr),
                Band::HighShelf(fr, g) => Biquad::high_shelf(fr, g * amount, self.sr),
            };
            f.retune(next);
        }
        let (freq, max_red) = de_ess(preset);
        self.deess.set_freq(freq);
        self.deess.max_reduction_db = max_red * amount;
        // Compression ratio grows with amount: 1:1 (off) → 2:1.
        self.comp.ratio = 1.0 + amount;
        self.current = Some((preset, amount));
    }

    /// Processes a frame in place. `Preset::Off` is a true bypass.
    pub fn process(&mut self, frame: &mut [f32], preset: Preset, amount: f32) {
        if preset == Preset::Off {
            self.current = None;
            return;
        }
        let amount = amount.clamp(0.0, 1.0);
        if self.current != Some((preset, amount)) {
            self.configure(preset, amount);
        }
        for x in frame.iter_mut() {
            let mut y = *x;
            for f in self.eq.iter_mut() {
                y = f.tick(y);
            }
            y = self.deess.tick(y);
            y *= self.comp.gain(y);
            *x = y;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SR: u32 = 48_000;

    fn sine(f: f32, amp: f32, n: usize) -> Vec<f32> {
        (0..n).map(|i| amp * (2.0 * std::f32::consts::PI * f * i as f32 / SR as f32).sin()).collect()
    }
    fn rms(x: &[f32]) -> f32 {
        (x.iter().map(|v| v * v).sum::<f32>() / x.len() as f32).sqrt()
    }
    /// Gain (dB) the EQ applies to a quiet sine (below compressor/de-esser thresholds).
    fn eq_gain(voice: Preset, f: f32) -> f32 {
        let mut c = Character::new(SR);
        let mut s = sine(f, 0.01, SR as usize);
        for fr in s.chunks_mut(480) {
            c.process(fr, voice, 1.0);
        }
        lin_to_db(rms(&s[24_000..]) / rms(&sine(f, 0.01, 24_000)))
    }

    #[test]
    fn feminine_cuts_rumble_and_adds_presence_and_air() {
        assert!(eq_gain(Preset::Light, 80.0) < -4.0, "rumble");
        assert!(eq_gain(Preset::Light, 400.0).abs() < 1.0, "voice body stays");
        assert!(eq_gain(Preset::Light, 3200.0) > 1.5, "presence");
        assert!(eq_gain(Preset::Light, 12_000.0) > 2.0, "air");
    }

    #[test]
    fn masculine_cuts_boxiness_adds_presence_and_air() {
        assert!(eq_gain(Preset::Crisp, 250.0) < -1.0, "boxiness");
        assert!(eq_gain(Preset::Crisp, 4500.0) > 2.0, "presence");
        assert!(eq_gain(Preset::Crisp, 12_000.0) > 1.5, "air");
    }

    #[test]
    fn clear_cuts_mud_and_lifts_presence() {
        assert!(eq_gain(Preset::Clear, 300.0) < -1.0, "mud");
        assert!(eq_gain(Preset::Clear, 3200.0) > 1.5, "presence");
        assert!(eq_gain(Preset::Clear, 1000.0).abs() < 1.0, "mids stay put");
    }

    #[test]
    fn natural_is_bypass() {
        let mut c = Character::new(SR);
        let src = sine(440.0, 0.5, 4800);
        let mut s = src.clone();
        c.process(&mut s, Preset::Off, 1.0);
        assert_eq!(s, src);
    }

    /// Gain (dB) applied to a sine at the given amplitude.
    fn gain_at(voice: Preset, f: f32, amp: f32) -> f32 {
        let mut c = Character::new(SR);
        let mut s = sine(f, amp, SR as usize);
        for fr in s.chunks_mut(480) {
            c.process(fr, voice, 1.0);
        }
        lin_to_db(rms(&s[24_000..]) / rms(&sine(f, amp, 24_000)))
    }

    /// Level-dependent reduction (loud minus quiet) isolates the dynamics: the compressor
    /// treats both frequencies alike; only sibilance should get the extra de-esser cut.
    #[test]
    fn de_esser_tames_loud_sibilance_but_not_voice() {
        let extra = |f: f32| gain_at(Preset::Crisp, f, 0.3) - gain_at(Preset::Crisp, f, 0.003);
        let ess = extra(8000.0);
        let vowel = extra(500.0);
        assert!(ess < vowel - 4.0, "loud sibilance {ess:.1} dB vs loud vowel {vowel:.1} dB");
    }

    /// Compression stays gentle: a loud vowel (~ -13.5 dBFS RMS, 10.5 dB over the -24 dB
    /// threshold) gets about half of that taken off at 2:1, plus a little from the soft knee.
    /// Measured at 1 kHz, where every preset's EQ is flat, so only the compressor counts.
    #[test]
    fn compressor_is_gentle() {
        for p in [Preset::Light, Preset::Crisp, Preset::Clear] {
            let extra = gain_at(p, 1000.0, 0.3) - gain_at(p, 1000.0, 0.003);
            assert!(extra > -7.0, "{p:?}: loud vowel squeezed by {extra:.1} dB");
        }
    }
}
