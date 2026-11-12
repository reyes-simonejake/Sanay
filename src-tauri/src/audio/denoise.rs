//! Noise suppression backends.
//!
//! * **RNNoise** (`nnnoiseless`) — light, always available. Current default.
//! * **DeepFilterNet3** — higher quality; lands in Phase 1 week 3 behind the `deepfilter`
//!   cargo feature. When it is available and the CPU keeps up, it becomes the default and
//!   RNNoise becomes the automatic fallback (spec §2.5).
//!
//! The denoiser always runs, even when NC is "off": the output is crossfaded between the
//! denoised and the (latency-matched) dry signal. That makes the toggle and the strength
//! slider instant and click-free (F4, F5) and keeps CPU load predictable.

use super::dsp::{db_to_lin, FRAME};
use nnnoiseless::DenoiseState;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Strength {
    Light,
    #[default]
    Normal,
    Strong,
}

impl Strength {
    /// Attenuation limit in dB (F5). Light keeps the voice most natural.
    pub fn attenuation_db(self) -> f32 {
        match self {
            Strength::Light => 12.0,
            Strength::Normal => 24.0,
            Strength::Strong => 100.0,
        }
    }

    pub fn to_u8(self) -> u8 {
        self as u8
    }

    pub fn from_u8(v: u8) -> Self {
        match v {
            0 => Strength::Light,
            2 => Strength::Strong,
            _ => Strength::Normal,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DenoiserKind {
    Rnnoise,
    #[allow(dead_code)]
    DeepFilterNet,
}

/// A frame-based 48 kHz mono denoiser.
pub trait Denoiser: Send {
    fn kind(&self) -> DenoiserKind;
    /// Samples of delay between input and output; the dry path is delayed to match.
    fn latency_samples(&self) -> usize;
    /// Denoise `input` (one `FRAME`, range [-1, 1]) into `output`.
    fn process(&mut self, input: &[f32], output: &mut [f32]);
}

pub struct Rnnoise {
    state: Box<DenoiseState<'static>>,
    scratch_in: [f32; FRAME],
    scratch_out: [f32; FRAME],
}

impl Rnnoise {
    pub fn new() -> Self {
        debug_assert_eq!(DenoiseState::FRAME_SIZE, FRAME);
        Self { state: DenoiseState::new(), scratch_in: [0.0; FRAME], scratch_out: [0.0; FRAME] }
    }
}

impl Denoiser for Rnnoise {
    fn kind(&self) -> DenoiserKind {
        DenoiserKind::Rnnoise
    }

    fn latency_samples(&self) -> usize {
        // Overlap-add synthesis with a 2*FRAME window delays the output by one frame.
        // Verified by `rnnoise_latency_is_one_frame` below.
        FRAME
    }

    fn process(&mut self, input: &[f32], output: &mut [f32]) {
        // RNNoise expects i16-scaled floats.
        for (d, s) in self.scratch_in.iter_mut().zip(input) {
            *d = s * 32768.0;
        }
        self.state.process_frame(&mut self.scratch_out, &self.scratch_in);
        for (d, s) in output.iter_mut().zip(&self.scratch_out) {
            *d = s / 32768.0;
        }
    }
}

/// Denoiser + dry/wet crossfade implementing the NC toggle and strength limit.
pub struct NoiseStage {
    denoiser: Box<dyn Denoiser>,
    /// Ring of past dry samples, used to latency-align the dry path.
    dry_delay: Vec<f32>,
    dry_pos: usize,
    wet: [f32; FRAME],
    /// Current wet amount (0 = bypass), ramped toward the target per sample.
    mix: f32,
}

impl NoiseStage {
    pub fn new(denoiser: Box<dyn Denoiser>) -> Self {
        let lat = denoiser.latency_samples();
        Self { denoiser, dry_delay: vec![0.0; lat.max(1)], dry_pos: 0, wet: [0.0; FRAME], mix: 0.0 }
    }

    pub fn kind(&self) -> DenoiserKind {
        self.denoiser.kind()
    }

    pub fn latency_samples(&self) -> usize {
        self.denoiser.latency_samples()
    }

    /// Processes one frame in place.
    ///
    /// With NC on, out = (1 - floor) * denoised + floor * dry, where floor is the strength's
    /// attenuation limit. Voice stays at unity; noise can't drop below `floor`.
    pub fn process(&mut self, frame: &mut [f32], enabled: bool, strength: Strength) {
        self.denoiser.process(frame, &mut self.wet);
        let target = if enabled { 1.0 - db_to_lin(-strength.attenuation_db()) } else { 0.0 };
        // ~20 ms ramp from fully dry to fully wet.
        let step = 1.0 / 960.0;
        let zero_latency = self.denoiser.latency_samples() == 0;
        for (i, x) in frame.iter_mut().enumerate() {
            let dry = if zero_latency {
                *x
            } else {
                let d = self.dry_delay[self.dry_pos];
                self.dry_delay[self.dry_pos] = *x;
                self.dry_pos = (self.dry_pos + 1) % self.dry_delay.len();
                d
            };
            if self.mix < target {
                self.mix = (self.mix + step).min(target);
            } else if self.mix > target {
                self.mix = (self.mix - step).max(target);
            }
            *x = self.mix * self.wet[i] + (1.0 - self.mix) * dry;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Cross-correlate a voiced test signal with the RNNoise output to confirm the
    /// one-frame latency used to align the dry path.
    #[test]
    fn rnnoise_latency_is_one_frame() {
        let n = FRAME * 200;
        // Broadband pseudo-random signal with a speech-rate envelope: a periodic signal
        // would give ambiguous correlation peaks.
        let mut seed = 0x1234_5678u32;
        let sig: Vec<f32> = (0..n)
            .map(|i| {
                seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                let white = (seed >> 8) as f32 / (1u32 << 24) as f32 - 0.5;
                let t = i as f32 / 48_000.0;
                let env = 0.5 + 0.5 * (2.0 * std::f32::consts::PI * 4.0 * t).sin();
                white * env * 0.5
            })
            .collect();
        let mut dn = Rnnoise::new();
        let mut out = vec![0.0; n];
        for (i, o) in sig.chunks(FRAME).zip(out.chunks_mut(FRAME)) {
            dn.process(i, o);
        }
        let start = FRAME * 50;
        let best = (0..2 * FRAME)
            .max_by(|&a, &b| {
                let c = |lag: usize| -> f32 {
                    (start..n - 2 * FRAME).map(|k| sig[k] * out[k + lag]).sum()
                };
                c(a).partial_cmp(&c(b)).unwrap()
            })
            .unwrap();
        assert!(
            (best as i64 - FRAME as i64).abs() <= 2,
            "measured RNNoise latency {best} samples, expected {FRAME}"
        );
    }

    #[test]
    fn bypass_is_delayed_passthrough() {
        let mut st = NoiseStage::new(Box::new(Rnnoise::new()));
        let input: Vec<f32> = (0..FRAME * 3).map(|i| (i as f32 * 0.01).sin() * 0.3).collect();
        let mut out = input.clone();
        for f in out.chunks_mut(FRAME) {
            st.process(f, false, Strength::Normal);
        }
        for k in FRAME..FRAME * 3 {
            assert!((out[k] - input[k - FRAME]).abs() < 1e-6);
        }
    }
}
