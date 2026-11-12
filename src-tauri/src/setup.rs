//! Virtual cable detection for the setup wizard (F2).

use crate::audio::devices;
use serde::Serialize;

pub const VB_CABLE_URL: &str = "https://vb-audio.com/Cable/";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CableStatus {
    /// The playback endpoint Sanay writes to ("CABLE Input ...").
    pub installed: bool,
    pub playback_name: Option<String>,
    /// The mic the user must choose in Zoom/Meet/Teams ("CABLE Output ...").
    pub recording_name: Option<String>,
    pub download_url: &'static str,
}

pub fn cable_status() -> CableStatus {
    let playback_name = devices::find_cable_playback().map(|d| devices::device_name(&d));
    CableStatus {
        installed: playback_name.is_some(),
        playback_name,
        recording_name: devices::find_cable_recording_name(),
        download_url: VB_CABLE_URL,
    }
}
