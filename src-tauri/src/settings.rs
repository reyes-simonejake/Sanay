//! Persistent user settings, stored as JSON in the app config dir. Local only.

use crate::audio::denoise::Strength;
use crate::audio::voice::VoiceType;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    /// cpal DeviceId string of the real mic (F1). None = system default.
    pub input_device_id: Option<String>,
    pub nc_enabled: bool,
    pub strength: Strength,
    /// Hear yourself (F8). Off by default.
    pub monitor_enabled: bool,
    /// "en" or "fil" (F13).
    pub language: String,
    pub start_with_windows: bool,
    /// Has the user finished the first-run setup wizard?
    pub setup_done: bool,
    /// Masculine / feminine voice option and its amount (0..1).
    pub voice_type: VoiceType,
    pub voice_amount: f32,
    /// Clarity boost for the natural voice (on by default).
    pub clarity: bool,
    /// Remove the speakers' sound from the mic so the other person never hears themselves.
    pub echo_cancel: bool,
    /// Masculine / Feminine through the AI voice model (personal testing build).
    pub ai_voice: bool,
    /// Master on/off from the floating pill / window / tray. Off = untouched mic.
    pub active: bool,
    /// Show the floating on/off pill.
    pub pill_visible: bool,
    /// Where the user left the pill (physical pixels, top-left). None = default corner.
    pub pill_pos: Option<(i32, i32)>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            input_device_id: None,
            nc_enabled: true,
            strength: Strength::Normal,
            monitor_enabled: false,
            language: "en".into(),
            start_with_windows: false,
            setup_done: false,
            voice_type: VoiceType::Natural,
            voice_amount: 0.8,
            clarity: true,
            echo_cancel: true,
            ai_voice: true,
            active: true,
            pill_visible: true,
            pill_pos: None,
        }
    }
}

pub struct SettingsStore {
    path: PathBuf,
}

impl SettingsStore {
    pub fn new(config_dir: PathBuf) -> Self {
        Self { path: config_dir.join("settings.json") }
    }

    pub fn load(&self) -> Settings {
        std::fs::read_to_string(&self.path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, s: &Settings) -> anyhow::Result<()> {
        if let Some(dir) = self.path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        // Write-then-rename so a crash never leaves a half-written file.
        let tmp = self.path.with_extension("json.tmp");
        std::fs::write(&tmp, serde_json::to_vec_pretty(s)?)?;
        std::fs::rename(tmp, &self.path)?;
        Ok(())
    }
}
