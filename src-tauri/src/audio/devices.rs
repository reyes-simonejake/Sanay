//! Device enumeration and lookup (F1, F2, F10).
//!
//! Devices are identified by cpal's `DeviceId`, which is stable across replugs on WASAPI and
//! round-trips through its `Display`/`FromStr` form — that string is what we persist.

use anyhow::{anyhow, Result};
use cpal::traits::{DeviceTrait, HostTrait};
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    /// True for the playback side of a known virtual cable (where Sanay writes).
    pub is_virtual_cable: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct DeviceList {
    pub inputs: Vec<DeviceInfo>,
    pub outputs: Vec<DeviceInfo>,
}

/// Name fragments of the *playback* endpoint of supported virtual cables.
/// The interview app then selects the matching *recording* endpoint (e.g. "CABLE Output").
const CABLE_PLAYBACK_PATTERNS: &[&str] = &["CABLE Input", "VB-Audio Virtual Cable"];
/// Name fragments of the recording endpoint, shown to the user as "the mic to pick in Zoom".
const CABLE_RECORDING_PATTERNS: &[&str] = &["CABLE Output"];

pub fn is_cable_playback(name: &str) -> bool {
    CABLE_PLAYBACK_PATTERNS.iter().any(|p| name.contains(p))
}

pub fn is_cable_recording(name: &str) -> bool {
    CABLE_RECORDING_PATTERNS.iter().any(|p| name.contains(p))
}

pub fn host() -> cpal::Host {
    cpal::default_host()
}

pub fn device_name(d: &cpal::Device) -> String {
    d.description().map(|desc| desc.name().to_string()).unwrap_or_else(|_| "Unknown device".into())
}

fn device_id_string(d: &cpal::Device) -> Option<String> {
    d.id().ok().map(|id| id.to_string())
}

pub fn list() -> Result<DeviceList> {
    let host = host();
    let default_in = host.default_input_device().and_then(|d| device_id_string(&d));
    let default_out = host.default_output_device().and_then(|d| device_id_string(&d));

    let mut inputs = Vec::new();
    for d in host.input_devices()? {
        let Some(id) = device_id_string(&d) else { continue };
        let name = device_name(&d);
        // Don't offer our own virtual mic as the "real mic": that would be a feedback loop.
        if is_cable_recording(&name) {
            continue;
        }
        inputs.push(DeviceInfo { is_default: Some(&id) == default_in.as_ref(), id, name, is_virtual_cable: false });
    }
    let mut outputs = Vec::new();
    for d in host.output_devices()? {
        let Some(id) = device_id_string(&d) else { continue };
        let name = device_name(&d);
        outputs.push(DeviceInfo {
            is_default: Some(&id) == default_out.as_ref(),
            is_virtual_cable: is_cable_playback(&name),
            id,
            name,
        });
    }
    Ok(DeviceList { inputs, outputs })
}

pub fn find_by_id(id: &str) -> Result<cpal::Device> {
    let parsed: cpal::DeviceId = id.parse().map_err(|e| anyhow!("bad device id {id:?}: {e:?}"))?;
    host().device_by_id(&parsed).ok_or_else(|| anyhow!("device not found: {id}"))
}

/// The mic actually in use, reported to the UI.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveInput {
    pub id: Option<String>,
    pub name: String,
    /// The user's chosen mic isn't connected, so the device's default mic is used instead.
    pub fallback: bool,
}

/// The system default mic, unless that is our own virtual cable (that would feed Sanay its
/// own output). In that case, or with no default, the first real mic.
fn usable_default() -> Option<cpal::Device> {
    let host = host();
    if let Some(d) = host.default_input_device() {
        if !is_cable_recording(&device_name(&d)) {
            return Some(d);
        }
    }
    host.input_devices().ok()?.find(|d| !is_cable_recording(&device_name(d)))
}

/// Id of the mic Sanay would use when following the system default.
pub fn usable_default_id() -> Option<String> {
    usable_default().and_then(|d| device_id_string(&d))
}

pub fn any_usable_input() -> bool {
    usable_default().is_some()
}

/// Picks the mic to open: the one the user chose if it is connected, otherwise the device's
/// default mic (e.g. the laptop's built-in mic) so the user is never left without audio.
pub fn resolve_input(wanted: Option<&str>) -> Result<(cpal::Device, ActiveInput)> {
    if let Some(id) = wanted {
        if let Ok(d) = find_by_id(id) {
            let name = device_name(&d);
            return Ok((d, ActiveInput { id: Some(id.to_string()), name, fallback: false }));
        }
        log::warn!("chosen mic {id} not connected; falling back to the default mic");
    }
    let d = usable_default().ok_or_else(|| anyhow!("No microphone found. Plug in a headset or mic."))?;
    let active = ActiveInput { id: device_id_string(&d), name: device_name(&d), fallback: wanted.is_some() };
    Ok((d, active))
}

/// Id of the current default speakers, if any.
pub fn default_output_id() -> Option<String> {
    host().default_output_device().and_then(|d| device_id_string(&d))
}

pub fn default_output() -> Result<cpal::Device> {
    host().default_output_device().ok_or_else(|| anyhow!("no output device"))
}

/// The output device Sanay writes cleaned audio to, if a virtual cable is installed.
pub fn find_cable_playback() -> Option<cpal::Device> {
    host().output_devices().ok()?.find(|d| is_cable_playback(&device_name(d)))
}

/// Name of the virtual mic the user should select in Zoom/Meet/Teams.
pub fn find_cable_recording_name() -> Option<String> {
    host().input_devices().ok()?.map(|d| device_name(&d)).find(|n| is_cable_recording(n))
}

pub fn exists(id: &str) -> bool {
    find_by_id(id).is_ok()
}
