//! "Voice enhancement": Masculine and Feminine presets that clearly change the voice while
//! keeping it a believable, professional human voice. "Natural" keeps the speaker's own voice.
//!
//! Each preset moves the two cues people hear as male/female (pitch and voice size, i.e. the
//! apparent vocal-tract length from `pitch.rs`), each with a guaranteed minimum change:
//! * **Masculine** (deep & crisp): pitch toward 100 Hz (either way, max 10 st), voice size
//!   toward an 18.5 cm "broadcast chest" (at least 2 st bigger), crisp EQ.
//! * **Feminine** (light & clear): pitch up toward 210 Hz (at least +1.5 st, never above 250 Hz,
//!   never down: lowering sounded "grounded" and doubled), voice size toward 13.6 cm (at least
//!   1.5 st smaller), light EQ.
//! Measured on the sample voices (`real_speech_render`, tests/voice-e2e.js for the web): every
//! input reads as the chosen preset, with no extra smearing after words.
//!
//! Pitch shifting: Signalsmith Stretch (MIT, vendored in `vendor/signalsmith`). Tuning measured
//! in the Voice Lab (web/lab/) by round-trip log-spectral distance:
//! * small shifts are far cleaner (≈4–5 vs 7–9 for ±6 semitones);
//! * a 60 ms window is cleanest for large shifts both ways (`real_speech_window` test);
//! * formants move 0.4x the pitch shift (max +/-3 st), pinned to the speaker's measured pitch;
//! * tonality limit 3 kHz keeps breath and "s" sounds from turning metallic.
//!
//! Same tuning as the web version (web/audio/webEngine.ts, web/audio/sanay-processor.js).

use super::character::{Character, Preset};
use super::pitch::PitchTracker;
use serde::{Deserialize, Serialize};
use std::ffi::c_void;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum VoiceType {
    #[default]
    Natural,
    Masculine,
    Feminine,
}

impl VoiceType {
    pub fn to_u8(self) -> u8 {
        self as u8
    }
    pub fn from_u8(v: u8) -> Self {
        match v {
            1 => VoiceType::Masculine,
            2 => VoiceType::Feminine,
            _ => VoiceType::Natural,
        }
    }
}

/// Per-preset tuning: a pitch target and a "voice size" (vocal-tract length) target, each with
/// a guaranteed minimum change so a preset never sounds like the natural voice.
struct PitchPreset {
    target_hz: f32,
    max_semis: f32,
    /// Feminine: never lower the voice (a downward shift sounds "grounded" and doubled), always
    /// raise it at least `min_semis`, but never above `ceiling_hz` (no squeaky voice).
    up_only: bool,
    min_semis: f32,
    ceiling_hz: f32,
    /// Target apparent vocal-tract length (cm): the "voice size" people hear as male/female.
    target_vtl_cm: f32,
    /// Always move the voice size at least this much in the preset's direction (semitones).
    min_formant_semis: f32,
    block_ms: f32,
}

const MASCULINE: PitchPreset = PitchPreset {
    target_hz: 100.0,
    max_semis: 10.0,
    up_only: false,
    min_semis: 0.0,
    ceiling_hz: f32::INFINITY,
    target_vtl_cm: 18.5, // a big "broadcast chest"
    min_formant_semis: 2.0,
    block_ms: 60.0,
};
const FEMININE: PitchPreset = PitchPreset {
    target_hz: 210.0,
    max_semis: 10.0,
    up_only: true,
    min_semis: 1.5,
    ceiling_hz: 250.0,
    target_vtl_cm: 13.6,
    min_formant_semis: 1.5,
    block_ms: 60.0,
};
/// Below this (pitch and formants), don't run the shifter at all (EQ only).
const MIN_SEMIS: f32 = 0.15;
/// Until the speaker's vocal tract is measured, formants follow 0.4x the pitch shift.
const FORMANT_RATIO: f32 = 0.4;
/// Largest formant move (semitones): a bit more than the average man/woman difference (~3.5 st).
const FORMANT_MAX_SEMIS: f32 = 4.0;
const TONALITY_HZ: f32 = 3000.0;
/// Fraction of a requested formant shift Signalsmith actually delivers on real speech, measured
/// by spectral-envelope alignment (`real_speech_formant_fx` + scratch envshift analysis):
/// −3 st → −2.35 st, +3 st → +2.65…2.85 st. The request is divided by this so it lands.
const FORMANT_DELIVERY_DOWN: f32 = 0.78;
const FORMANT_DELIVERY_UP: f32 = 0.9;

/// Formant amount to request from the shifter so that `formants` semitones are delivered.
fn formant_request(formants: f32) -> f32 {
    formants / if formants < 0.0 { FORMANT_DELIVERY_DOWN } else { FORMANT_DELIVERY_UP }
}

fn preset(voice: VoiceType) -> Option<&'static PitchPreset> {
    match voice {
        VoiceType::Natural => None,
        VoiceType::Masculine => Some(&MASCULINE),
        VoiceType::Feminine => Some(&FEMININE),
    }
}

/// Pitch shift (semitones) to apply, given the speaker's median pitch if known.
pub fn plan_semitones(voice: VoiceType, amount: f32, median_hz: Option<f32>) -> f32 {
    let Some(p) = preset(voice) else { return 0.0 };
    // Until the speaker's pitch is known (~0.2 s of voiced speech) the direction is unknown: EQ only.
    let Some(m) = median_hz.filter(|&m| m > 0.0) else { return 0.0 };
    let to_target = 12.0 * (p.target_hz / m).log2();
    let semis = if p.up_only {
        let room = (12.0 * (p.ceiling_hz / m).log2()).max(0.0);
        to_target.max(p.min_semis).min(p.max_semis).min(room)
    } else {
        to_target.clamp(-p.max_semis, p.max_semis)
    };
    semis * amount.clamp(0.0, 1.0)
}

/// Formant shift (semitones) for a preset: moves the speaker's vocal tract toward the target
/// size, always at least the preset's minimum and only in its direction (Masculine bigger =
/// formants down, Feminine smaller = formants up).
pub fn plan_formants(voice: VoiceType, amount: f32, semis: f32, vtl_cm: Option<f32>) -> f32 {
    let Some(p) = preset(voice) else { return 0.0 };
    let dir = if voice == VoiceType::Masculine { -1.0 } else { 1.0 };
    let full = match vtl_cm.filter(|&l| l > 0.0) {
        // Shorter tract → higher formants: shift = 12·log2(L_speaker / L_target).
        Some(l) => 12.0 * (l / p.target_vtl_cm).log2(),
        None => semis * FORMANT_RATIO,
    };
    let size = (dir * full).max(p.min_formant_semis).min(FORMANT_MAX_SEMIS);
    dir * size * amount.clamp(0.0, 1.0)
}

extern "C" {
    fn sanay_stretch_create(sample_rate: f32, block_samples: i32, interval_samples: i32) -> *mut c_void;
    fn sanay_stretch_destroy(h: *mut c_void);
    fn sanay_stretch_reset(h: *mut c_void);
    fn sanay_stretch_latency(h: *mut c_void) -> i32;
    fn sanay_stretch_set(h: *mut c_void, semitones: f32, formant_semitones: f32, tonality_hz: f32, formant_base_hz: f32);
    fn sanay_stretch_process(h: *mut c_void, input: *mut f32, output: *mut f32, samples: i32);
}

/// One Signalsmith Stretch instance.
struct Shifter {
    h: *mut c_void,
    latency: usize,
    /// (semitones, formant semitones, formant base Hz) last applied.
    applied: Option<(f32, f32, f32)>,
}

// The handle is only ever used from one thread at a time (the DSP thread).
unsafe impl Send for Shifter {}

impl Shifter {
    fn new(sample_rate: u32, block_ms: f32) -> Self {
        let block = (sample_rate as f32 * block_ms / 1000.0) as i32;
        let h = unsafe { sanay_stretch_create(sample_rate as f32, block, block / 4) };
        assert!(!h.is_null(), "stretch allocation failed");
        let latency = unsafe { sanay_stretch_latency(h) } as usize;
        Self { h, latency, applied: None }
    }

    fn tune(&mut self, semis: f32, formants: f32, base_hz: f32) {
        let changed = match self.applied {
            None => true,
            // Ignore tiny wobbles of the estimates.
            Some((s, f, b)) => (s - semis).abs() > 0.2 || (f - formants).abs() > 0.2 || (b == 0.0) != (base_hz == 0.0),
        };
        if changed {
            unsafe { sanay_stretch_set(self.h, semis, formant_request(formants), TONALITY_HZ, base_hz) };
            self.applied = Some((semis, formants, base_hz));
        }
    }

    fn reset(&mut self) {
        unsafe { sanay_stretch_reset(self.h) };
        self.applied = None;
    }

    fn process(&mut self, input: &mut [f32], output: &mut [f32]) {
        unsafe { sanay_stretch_process(self.h, input.as_mut_ptr(), output.as_mut_ptr(), input.len() as i32) };
    }
}

impl Drop for Shifter {
    fn drop(&mut self) {
        unsafe { sanay_stretch_destroy(self.h) }
    }
}

/// The voice stage: optional small pitch nudge (crossfaded, skipped when not needed),
/// then the preset's professional EQ / de-esser / compressor.
pub struct VoiceStage {
    deep: Shifter,
    bright: Shifter,
    /// Which shifter is currently feeding the output (None = untouched voice).
    running: Option<VoiceType>,
    input: Vec<f32>,
    shifted: Vec<f32>,
    pitch: PitchTracker,
    character: Character,
    /// 0 = untouched voice, 1 = shifted voice.
    mix: f32,
}

impl VoiceStage {
    pub fn new(sample_rate: u32, max_frame: usize) -> Self {
        Self {
            deep: Shifter::new(sample_rate, MASCULINE.block_ms),
            bright: Shifter::new(sample_rate, FEMININE.block_ms),
            running: None,
            input: vec![0.0; max_frame],
            shifted: vec![0.0; max_frame],
            pitch: PitchTracker::new(),
            character: Character::new(sample_rate),
            mix: 0.0,
        }
    }

    /// Delay currently added by the pitch nudge, in samples (0 when not shifting).
    pub fn latency_samples(&self) -> usize {
        match self.running {
            Some(VoiceType::Masculine) => self.deep.latency,
            Some(VoiceType::Feminine) => self.bright.latency,
            _ => 0,
        }
    }

    pub fn is_active(&self) -> bool {
        self.running.is_some()
    }

    /// The speaker's median pitch, once known.
    pub fn speaker_pitch(&self) -> Option<f32> {
        self.pitch.median()
    }

    /// The speaker's apparent vocal-tract length (cm), once known.
    pub fn speaker_vtl(&self) -> Option<f32> {
        self.pitch.vtl_cm()
    }

    /// `clarity`: apply the clarity boost when the voice type is "natural".
    pub fn process(&mut self, frame: &mut [f32], voice: VoiceType, amount: f32, clarity: bool) {
        // Always listen (cheap), so the estimate is ready the moment a preset is chosen.
        self.pitch.push(frame);
        let median = self.pitch.median();
        let semis = plan_semitones(voice, amount, median);
        let formants = if median.is_some() { plan_formants(voice, amount, semis, self.pitch.vtl_cm()) } else { 0.0 };
        let want = if voice != VoiceType::Natural && (semis.abs() >= MIN_SEMIS || formants.abs() >= MIN_SEMIS) {
            Some(voice)
        } else {
            None
        };

        // Switch shifter only once the previous one has faded out.
        if want.is_some() && want != self.running && self.mix == 0.0 {
            self.running = want;
            match want {
                Some(VoiceType::Masculine) => self.deep.reset(),
                Some(VoiceType::Feminine) => self.bright.reset(),
                _ => {}
            }
        }
        let target = if want.is_some() && want == self.running { 1.0 } else { 0.0 };

        if let Some(v) = self.running {
            let sh = if v == VoiceType::Masculine { &mut self.deep } else { &mut self.bright };
            if want == Some(v) {
                sh.tune(semis, formants, median.unwrap_or(0.0));
            }
            let n = frame.len();
            self.input[..n].copy_from_slice(frame);
            sh.process(&mut self.input[..n], &mut self.shifted[..n]);
            let step = 1.0 / 480.0; // ~10 ms fade
            for (i, x) in frame.iter_mut().enumerate() {
                self.mix = if self.mix < target { (self.mix + step).min(target) } else { (self.mix - step).max(target) };
                *x = self.mix * self.shifted[i] + (1.0 - self.mix) * *x;
            }
            if target == 0.0 && self.mix == 0.0 {
                self.running = None; // faded out: stop spending CPU
            }
        }

        let (preset, strength) = match voice {
            VoiceType::Masculine => (Preset::Crisp, amount),
            VoiceType::Feminine => (Preset::Light, amount),
            VoiceType::Natural if clarity => (Preset::Clear, 1.0),
            VoiceType::Natural => (Preset::Off, 0.0),
        };
        self.character.process(frame, preset, strength);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::dsp::{FRAME, SAMPLE_RATE};

    /// Autocorrelation pitch estimate (60–400 Hz). Takes the shortest lag whose correlation is
    /// within 10% of the best, so multiples of the true period (octave errors) aren't chosen.
    fn f0(x: &[f32]) -> f32 {
        let sr = SAMPLE_RATE as f32;
        let lags: Vec<(usize, f32)> = ((sr / 400.0) as usize..(sr / 60.0) as usize)
            .map(|lag| (lag, (0..4096).map(|k| x[k] * x[k + lag]).sum()))
            .collect();
        let max = lags.iter().map(|&(_, c)| c).fold(f32::MIN, f32::max);
        // First local peak that is near the global maximum.
        let lag = lags
            .windows(3)
            .find(|w| w[1].1 >= w[0].1 && w[1].1 >= w[2].1 && w[1].1 > 0.9 * max)
            .map(|w| w[1].0)
            .unwrap();
        sr / lag as f32
    }

    fn voiced(freq: f32, n: usize) -> Vec<f32> {
        (0..n)
            .map(|i| {
                let t = i as f32 / SAMPLE_RATE as f32;
                (1..=10)
                    .map(|h| {
                        let w = (-(h as f32 * freq - 700.0).abs() / 600.0).exp();
                        (2.0 * std::f32::consts::PI * freq * h as f32 * t).sin() * w
                    })
                    .sum::<f32>()
                    * 0.1
            })
            .collect()
    }

    /// 3 s of a 150 Hz voice; the first second lets the pitch tracker learn the speaker.
    fn run(voice: VoiceType, freq: f32) -> Vec<f32> {
        let mut st = VoiceStage::new(SAMPLE_RATE, FRAME);
        let mut sig = voiced(freq, SAMPLE_RATE as usize * 3);
        for f in sig.chunks_mut(FRAME) {
            st.process(f, voice, 1.0, false);
        }
        sig
    }

    #[test]
    fn natural_is_untouched() {
        let out = run(VoiceType::Natural, 150.0);
        assert_eq!(out, voiced(150.0, SAMPLE_RATE as usize * 3));
    }

    /// 150 Hz → −6.7 st → ~102 Hz.
    #[test]
    fn masculine_moves_pitch_to_target() {
        let out = run(VoiceType::Masculine, 150.0);
        let p = f0(&out[2 * SAMPLE_RATE as usize..]);
        assert!((p - MASCULINE.target_hz).abs() < 4.0, "pitch {p:.1} Hz, want ~{}", MASCULINE.target_hz);
    }

    /// 150 Hz → +4.98 st → ~200 Hz.
    #[test]
    fn feminine_moves_pitch_up_to_target() {
        let out = run(VoiceType::Feminine, 150.0);
        let p = f0(&out[2 * SAMPLE_RATE as usize..]);
        assert!((p - FEMININE.target_hz).abs() < 6.0, "pitch {p:.1} Hz, want ~{}", FEMININE.target_hz);
    }

    /// A higher voice choosing "feminine" is never lowered (no grounded, doubled sound).
    #[test]
    fn feminine_never_lowers_a_voice() {
        // 230 Hz: +1.5 st minimum would be 251 Hz, so it stops at the 250 Hz ceiling.
        let out = run(VoiceType::Feminine, 230.0);
        let p = f0(&out[2 * SAMPLE_RATE as usize..]);
        assert!((p - FEMININE.ceiling_hz).abs() < 7.0, "pitch {p:.1} Hz, want ~{}", FEMININE.ceiling_hz);
    }

    /// A deep voice choosing "masculine" is lifted to the crisp ~100 Hz target (not muddier).
    #[test]
    fn masculine_lifts_a_very_deep_voice() {
        let out = run(VoiceType::Masculine, 85.0);
        let p = f0(&out[2 * SAMPLE_RATE as usize..]);
        assert!((p - MASCULINE.target_hz).abs() < 4.0, "pitch {p:.1} Hz, want ~{}", MASCULINE.target_hz);
    }

    /// A voice already at the target gets EQ only: no shifter, no shift delay.
    /// A voice already at a preset's target still changes (the guaranteed minimum), so a preset
    /// never sounds like the natural voice. Natural never runs the shifter.
    #[test]
    fn presets_always_change_the_voice_natural_never_does() {
        for (voice, hz) in [(VoiceType::Feminine, 210.0), (VoiceType::Masculine, 100.0)] {
            let mut st = VoiceStage::new(SAMPLE_RATE, FRAME);
            let mut sig = voiced(hz, SAMPLE_RATE as usize * 3);
            for f in sig.chunks_mut(FRAME) {
                st.process(f, voice, 1.0, false);
            }
            assert!(st.is_active(), "{voice:?} at its target should still be shifted");
        }
        let mut st = VoiceStage::new(SAMPLE_RATE, FRAME);
        let mut sig = voiced(150.0, SAMPLE_RATE as usize * 3);
        for f in sig.chunks_mut(FRAME) {
            st.process(f, VoiceType::Natural, 1.0, true);
        }
        assert!(!st.is_active());
        assert_eq!(st.latency_samples(), 0);
    }

    #[test]
    fn plan_pitch() {
        // Masculine: toward 100 Hz both ways, max 10 st.
        assert!((plan_semitones(VoiceType::Masculine, 1.0, Some(89.0)) - 2.02).abs() < 0.05);
        assert!((plan_semitones(VoiceType::Masculine, 1.0, Some(130.0)) + 4.54).abs() < 0.05);
        assert_eq!(plan_semitones(VoiceType::Masculine, 1.0, Some(300.0)), -MASCULINE.max_semis);
        // Feminine: up toward 210 Hz, at least +1.5 st, never above 250 Hz, never down.
        assert!((plan_semitones(VoiceType::Feminine, 1.0, Some(174.0)) - 3.26).abs() < 0.05);
        assert!((plan_semitones(VoiceType::Feminine, 1.0, Some(210.0)) - 1.5).abs() < 1e-4);
        assert!((plan_semitones(VoiceType::Feminine, 1.0, Some(240.0)) - 0.71).abs() < 0.05);
        assert_eq!(plan_semitones(VoiceType::Feminine, 1.0, Some(260.0)), 0.0);
        assert_eq!(plan_semitones(VoiceType::Feminine, 1.0, Some(60.0)), FEMININE.max_semis);
        // Pitch not known yet: no shift. Intensity scales.
        assert_eq!(plan_semitones(VoiceType::Feminine, 1.0, None), 0.0);
        assert!((plan_semitones(VoiceType::Masculine, 0.5, Some(89.0)) - 1.01).abs() < 0.05);
    }

    #[test]
    fn plan_voice_size() {
        // Woman (14.3 cm) → masculine 18.5 cm: −4.5 st, capped at −4.
        assert_eq!(plan_formants(VoiceType::Masculine, 1.0, -8.0, Some(14.3)), -FORMANT_MAX_SEMIS);
        // Man (17.8 cm) → masculine: only −0.67 st to target, so the −2 st minimum.
        assert!((plan_formants(VoiceType::Masculine, 1.0, 2.0, Some(17.8)) + 2.0).abs() < 1e-4);
        // Man (17.8 cm) → feminine 13.6 cm: +4.7 st, capped at +4.
        assert_eq!(plan_formants(VoiceType::Feminine, 1.0, 8.0, Some(17.8)), FORMANT_MAX_SEMIS);
        // Woman (14.3 cm) → feminine: +0.87 st to target, so the +1.5 st minimum.
        assert!((plan_formants(VoiceType::Feminine, 1.0, 3.0, Some(14.3)) - 1.5).abs() < 1e-4);
        // Not measured yet: follow the pitch (still at least the minimum). Intensity scales.
        assert!((plan_formants(VoiceType::Feminine, 1.0, 5.0, None) - 2.0).abs() < 1e-4);
        assert!((plan_formants(VoiceType::Masculine, 0.5, -8.0, Some(14.3)) + 2.0).abs() < 1e-4);
    }

    #[test]
    fn shift_latency_matches_preset_window() {
        let st = VoiceStage::new(SAMPLE_RATE, FRAME);
        let ms = |s: usize| s as f32 * 1000.0 / SAMPLE_RATE as f32;
        assert!((55.0..=65.0).contains(&ms(st.deep.latency)), "deep {} ms", ms(st.deep.latency));
        assert!((55.0..=65.0).contains(&ms(st.bright.latency)), "bright {} ms", ms(st.bright.latency));
    }
}

/// Real-speech check (needs tests/audio_samples from tests/make-speech.ps1):
/// `cargo test --lib real_speech -- --ignored --nocapture`
#[cfg(test)]
pub(crate) mod real_speech {
    use super::*;
    use crate::audio::dsp::{FRAME, SAMPLE_RATE};
    use crate::audio::pitch::PitchTracker;

    /// Minimal reader for the 16-bit mono PCM WAVs that make-speech.ps1 writes.
    pub(crate) fn read_wav(path: &str) -> Option<Vec<f32>> {
        let b = std::fs::read(path).ok()?;
        let mut i = 12;
        while i + 8 <= b.len() {
            let id = &b[i..i + 4];
            let len = u32::from_le_bytes(b[i + 4..i + 8].try_into().ok()?) as usize;
            if id == b"data" {
                let d = &b[i + 8..(i + 8 + len).min(b.len())];
                return Some(d.chunks_exact(2).map(|c| i16::from_le_bytes([c[0], c[1]]) as f32 / 32768.0).collect());
            }
            i += 8 + len + (len & 1);
        }
        None
    }

    fn yin_median(x: &[f32]) -> f32 {
        let mut p = PitchTracker::new();
        p.push(x);
        p.median().unwrap_or(0.0)
    }

    /// Independent estimate: harmonic-sum over 85 ms frames (no YIN), median of voiced frames.
    fn hss_median(x: &[f32]) -> f32 {
        let sr = SAMPLE_RATE as f32;
        let n = 4096;
        let mut est = vec![];
        let mut s = 0;
        while s + n < x.len() {
            let e: f32 = x[s..s + n].iter().map(|v| v * v).sum::<f32>() / n as f32;
            if e > 1e-4 {
                let (mut best, mut bs) = (0.0, -1.0);
                let mut f = 70.0;
                while f <= 300.0 {
                    let mut sc = 0.0;
                    for h in 1..=6 {
                        let w = 2.0 * std::f32::consts::PI * f * h as f32 / sr;
                        let (mut re, mut im) = (0.0f32, 0.0f32);
                        for i in (0..n).step_by(2) {
                            re += x[s + i] * (w * i as f32).cos();
                            im += x[s + i] * (w * i as f32).sin();
                        }
                        sc += (re * re + im * im).sqrt() / h as f32;
                    }
                    if sc > bs {
                        bs = sc;
                        best = f;
                    }
                    f += 1.0;
                }
                est.push(best);
            }
            s += 9600;
        }
        est.sort_by(|a, b| a.partial_cmp(b).unwrap());
        est.get(est.len() / 2).copied().unwrap_or(0.0)
    }

    fn write_wav(path: &str, x: &[f32]) {
        let mut b = Vec::with_capacity(44 + x.len() * 2);
        let data = (x.len() * 2) as u32;
        b.extend_from_slice(b"RIFF");
        b.extend_from_slice(&(36 + data).to_le_bytes());
        b.extend_from_slice(b"WAVEfmt ");
        b.extend_from_slice(&16u32.to_le_bytes());
        b.extend_from_slice(&1u16.to_le_bytes());
        b.extend_from_slice(&1u16.to_le_bytes());
        b.extend_from_slice(&SAMPLE_RATE.to_le_bytes());
        b.extend_from_slice(&(SAMPLE_RATE * 2).to_le_bytes());
        b.extend_from_slice(&2u16.to_le_bytes());
        b.extend_from_slice(&16u16.to_le_bytes());
        b.extend_from_slice(b"data");
        b.extend_from_slice(&data.to_le_bytes());
        for v in x {
            b.extend_from_slice(&((v.clamp(-1.0, 1.0) * 32767.0) as i16).to_le_bytes());
        }
        std::fs::write(path, b).unwrap();
    }

    /// In-place radix-2 FFT (re, im), n a power of two.
    fn fft(re: &mut [f32], im: &mut [f32]) {
        let n = re.len();
        let mut j = 0;
        for i in 1..n {
            let mut bit = n >> 1;
            while j & bit != 0 {
                j ^= bit;
                bit >>= 1;
            }
            j |= bit;
            if i < j {
                re.swap(i, j);
                im.swap(i, j);
            }
        }
        let mut len = 2;
        while len <= n {
            let a = -2.0 * std::f32::consts::PI / len as f32;
            for s in (0..n).step_by(len) {
                for k in 0..len / 2 {
                    let (wr, wi) = ((a * k as f32).cos(), (a * k as f32).sin());
                    let (u, v) = (s + k, s + k + len / 2);
                    let (tr, ti) = (re[v] * wr - im[v] * wi, re[v] * wi + im[v] * wr);
                    re[v] = re[u] - tr;
                    im[v] = im[u] - ti;
                    re[u] += tr;
                    im[u] += ti;
                }
            }
            len <<= 1;
        }
    }

    /// Log-spectral distance (dB) over speech frames, 60 Hz – 8 kHz.
    fn lsd(a: &[f32], b: &[f32]) -> f32 {
        let n = 1024;
        let (lo, hi) = (60 * n / SAMPLE_RATE as usize + 1, 8000 * n / SAMPLE_RATE as usize);
        let (mut tot, mut cnt) = (0.0, 0);
        let mut s = 0;
        while s + n <= a.len().min(b.len()) {
            let e: f32 = a[s..s + n].iter().map(|v| v * v).sum::<f32>() / n as f32;
            if e > 1e-5 {
                let spec = |x: &[f32]| {
                    let mut re: Vec<f32> = (0..n).map(|i| x[s + i] * (0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / n as f32).cos())).collect();
                    let mut im = vec![0.0; n];
                    fft(&mut re, &mut im);
                    (lo..hi).map(|k| 10.0 * (re[k] * re[k] + im[k] * im[k] + 1e-10).log10()).collect::<Vec<f32>>()
                };
                let (pa, pb) = (spec(a), spec(b));
                let d: f32 = pa.iter().zip(&pb).map(|(x, y)| (x - y) * (x - y)).sum::<f32>() / pa.len() as f32;
                tot += d.sqrt();
                cnt += 1;
            }
            s += n / 2;
        }
        tot / cnt.max(1) as f32
    }

    /// Picks the shifter window for big shifts: shift there and back, compare with the input.
    /// `cargo test --release --lib real_speech_window -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn real_speech_window() {
        for file in ["speech_male.wav", "speech_female.wav"] {
            let Some(x) = read_wav(&format!("../tests/audio_samples/{file}")) else {
                eprintln!("skip: run tests/make-speech.ps1 first");
                return;
            };
            let x = &x[..x.len().min(8 * SAMPLE_RATE as usize)];
            let base = yin_median(x);
            for semis in [-6.0f32, -3.5, 3.5, 6.0] {
                let mut line = format!("{file} {semis:+}: ");
                for ms in [45.0, 60.0, 90.0, 120.0] {
                    let mut a = Shifter::new(SAMPLE_RATE, ms);
                    let mut b = Shifter::new(SAMPLE_RATE, ms);
                    a.tune(semis, 0.4 * semis, base);
                    b.tune(-semis, -0.4 * semis, base * 2f32.powf(semis / 12.0));
                    let mut inp = x.to_vec();
                    let mut mid = vec![0.0; x.len()];
                    a.process(&mut inp, &mut mid);
                    let mut back = vec![0.0; x.len()];
                    b.process(&mut mid, &mut back);
                    let lat = a.latency + b.latency;
                    line += &format!("{ms} ms {:.2}  ", lsd(&x[..x.len() - lat], &back[lat..]));
                }
                println!("{line}");
            }
        }
    }

    /// Deletes previously generated sample voices (out_*, fx_*, ref_*) before writing a new set,
    /// so old renders never pile up. Source voices (speech_*.wav, babble.wav) are kept.
    fn clear_generated() {
        let Ok(dir) = std::fs::read_dir("../tests/audio_samples") else { return };
        for e in dir.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            if name.ends_with(".wav") && ["out_", "fx_", "ref_"].iter().any(|p| name.starts_with(p)) {
                let _ = std::fs::remove_file(e.path());
            }
        }
    }

    /// How much of a requested formant shift Signalsmith actually delivers (writes fx_*.wav).
    /// `cargo test --release --lib real_speech_formant_fx -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn real_speech_formant_fx() {
        clear_generated();
        for file in ["speech_male.wav", "speech_female.wav"] {
            let Some(x) = read_wav(&format!("../tests/audio_samples/{file}")) else { return };
            let base = yin_median(&x);
            for (semis, fs, b) in [(0.0f32, -3.0f32, base), (0.0, 3.0, base), (0.0, -3.0, 0.0), (0.0, 3.0, 0.0), (2.0, -1.5, base), (2.0, -1.5, 0.0)] {
                let mut sh = Shifter::new(SAMPLE_RATE, 60.0);
                sh.tune(semis, fs, b);
                let mut inp = x.clone();
                let mut out = vec![0.0; x.len()];
                sh.process(&mut inp, &mut out);
                let mut t = PitchTracker::new();
                t.push(&out);
                let name = format!("../tests/audio_samples/fx_{}_p{semis}_f{fs}_b{}.wav", file.trim_end_matches(".wav"), b as i32);
                write_wav(&name, &out);
                println!("{name}: tract {:.1} cm", t.vtl_cm().unwrap_or(0.0));
            }
        }
    }

    /// Renders every preset on the sample voices to tests/audio_samples/out_*.wav for listening.
    /// `cargo test --release --lib real_speech_render -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn real_speech_render() {
        clear_generated();
        // The sample voices plus "typical" ones made from them: an average man (~120 Hz,
        // slightly smaller tract) and an average woman (~210 Hz).
        let mut inputs = vec![];
        for (file, typical, semis, fs) in [("speech_male.wav", "speech_typical_man.wav", 5.0f32, 0.8f32), ("speech_female.wav", "speech_typical_woman.wav", 3.2, 0.0)] {
            let Some(x) = read_wav(&format!("../tests/audio_samples/{file}")) else {
                eprintln!("skip: run tests/make-speech.ps1 first");
                return;
            };
            let mut sh = Shifter::new(SAMPLE_RATE, 60.0);
            sh.tune(semis, fs, yin_median(&x));
            let (mut inp, mut y) = (x.clone(), vec![0.0; x.len()]);
            sh.process(&mut inp, &mut y);
            write_wav(&format!("../tests/audio_samples/{typical}"), &y);
            inputs.push((file, x));
            inputs.push((typical, y));
        }
        for (file, x) in inputs {
            for voice in [VoiceType::Natural, VoiceType::Masculine, VoiceType::Feminine] {
                let mut st = VoiceStage::new(SAMPLE_RATE, FRAME);
                let mut y = x.clone();
                for f in y.chunks_mut(FRAME) {
                    st.process(f, voice, 1.0, true);
                }
                let mut probe = PitchTracker::new();
                let lock = x.chunks(FRAME).position(|f| {
                    probe.push(f);
                    probe.median().is_some()
                });
                println!(
                    "  pitch learned after {:.2} s; speaker {:.0} Hz, vocal tract {:.1} cm",
                    lock.unwrap_or(0) as f32 * FRAME as f32 / SAMPLE_RATE as f32,
                    probe.median().unwrap_or(0.0),
                    {
                        let mut all = PitchTracker::new();
                        all.push(&x);
                        all.vtl_cm().unwrap_or(0.0)
                    }
                );
                let name = file.trim_end_matches(".wav");
                let out = format!("../tests/audio_samples/out_{name}_{voice:?}.wav").to_lowercase();
                write_wav(&out, &y);
                let mut o = PitchTracker::new();
                o.push(&y);
                println!(
                    "{out}: in {:.0} Hz {:.1} cm -> out {:.0} Hz {:.1} cm (tracker on whole file)",
                    st.speaker_pitch().unwrap_or(0.0),
                    st.speaker_vtl().unwrap_or(0.0),
                    o.median().unwrap_or(0.0),
                    o.vtl_cm().unwrap_or(0.0)
                );
            }
        }
    }

    #[test]
    #[ignore]
    fn real_speech_pitch_caps() {
        for (file, voice) in [("speech_male.wav", VoiceType::Feminine), ("speech_female.wav", VoiceType::Masculine)] {
            let Some(x) = read_wav(&format!("../tests/audio_samples/{file}")) else {
                eprintln!("skip: run tests/make-speech.ps1 first");
                return;
            };
            let mut st = VoiceStage::new(SAMPLE_RATE, FRAME);
            let mut y = x.clone();
            for f in y.chunks_mut(FRAME) {
                st.process(f, voice, 1.0, false);
            }
            let src = st.speaker_pitch().unwrap();
            let semis = plan_semitones(voice, 1.0, Some(src));
            // Skip the first 2 s (pitch learning + latency).
            let tail = &y[2 * SAMPLE_RATE as usize..];
            println!(
                "{file} {voice:?}: speaker {src:.0} Hz, planned {semis:+.2} st → expected {:.0} Hz | output YIN {:.0} Hz, harmonic-sum {:.0} Hz | input harmonic-sum {:.0} Hz",
                src * 2f32.powf(semis / 12.0),
                yin_median(tail),
                hss_median(tail),
                hss_median(&x[2 * SAMPLE_RATE as usize..]),
            );
        }
    }
}
