//! Lock-free level meters shared between the DSP thread and the UI emitter (F6).

use super::dsp::{lin_to_db, FrameLevel};
use serde::Serialize;
use std::sync::atomic::{AtomicU32, Ordering};

/// An f32 stored in an AtomicU32.
#[derive(Default)]
pub struct AtomicF32(AtomicU32);

impl AtomicF32 {
    pub fn new(v: f32) -> Self {
        Self(AtomicU32::new(v.to_bits()))
    }
    pub fn load(&self) -> f32 {
        f32::from_bits(self.0.load(Ordering::Relaxed))
    }
    pub fn store(&self, v: f32) {
        self.0.store(v.to_bits(), Ordering::Relaxed)
    }
    /// Store `v` if larger than the current value.
    pub fn fetch_max(&self, v: f32) {
        let mut cur = self.0.load(Ordering::Relaxed);
        while v > f32::from_bits(cur) {
            match self.0.compare_exchange_weak(cur, v.to_bits(), Ordering::Relaxed, Ordering::Relaxed) {
                Ok(_) => break,
                Err(c) => cur = c,
            }
        }
    }
    /// Read the value and reset it to zero.
    pub fn take(&self) -> f32 {
        f32::from_bits(self.0.swap(0f32.to_bits(), Ordering::Relaxed))
    }
}

/// One side (input or output) of the meters. The DSP thread writes every 10 ms frame; the
/// UI emitter reads ~20×/s and takes the peak held since its previous read.
#[derive(Default)]
pub struct Meter {
    rms: AtomicF32,
    peak_hold: AtomicF32,
}

impl Meter {
    pub fn update(&self, l: FrameLevel) {
        self.rms.store(l.rms);
        self.peak_hold.fetch_max(l.peak);
    }

    pub fn read(&self) -> MeterReading {
        MeterReading { rms_db: lin_to_db(self.rms.load()), peak_db: lin_to_db(self.peak_hold.take()) }
    }

    pub fn reset(&self) {
        self.rms.store(0.0);
        self.peak_hold.store(0.0);
    }
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeterReading {
    pub rms_db: f32,
    pub peak_db: f32,
}

/// Payload of the `levels` event.
#[derive(Clone, Copy, Debug, Serialize)]
pub struct Levels {
    pub input: MeterReading,
    pub output: MeterReading,
}
