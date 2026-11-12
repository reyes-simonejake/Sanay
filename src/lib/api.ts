// Typed wrappers around the Rust commands (src-tauri/src/lib.rs).
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";

export type Strength = "light" | "normal" | "strong";

/** Masculine / feminine voice option (pitch + formant shift). */
export type VoiceType = "natural" | "masculine" | "feminine";

export interface DeviceInfo {
  id: string;
  name: string;
  isDefault: boolean;
  isVirtualCable: boolean;
}
export interface DeviceList {
  inputs: DeviceInfo[];
  outputs: DeviceInfo[];
}

export interface Settings {
  inputDeviceId: string | null;
  ncEnabled: boolean;
  strength: Strength;
  monitorEnabled: boolean;
  language: "en" | "fil";
  startWithWindows: boolean;
  setupDone: boolean;
  voiceType: VoiceType;
  voiceAmount: number;
  clarity: boolean;
  echoCancel: boolean;
  aiVoice: boolean;
  /** Master on/off (floating pill). Off = the untouched mic goes to the call. */
  active: boolean;
  pillVisible: boolean;
  pillPos: [number, number] | null;
}

export interface CableStatus {
  installed: boolean;
  playbackName: string | null;
  recordingName: string | null;
  downloadUrl: string;
}

export type EngineState =
  | { kind: "stopped" }
  | { kind: "starting" }
  | { kind: "running" }
  | { kind: "deviceLost" }
  | { kind: "error"; message: string };

export interface Status {
  engine: EngineState;
  micOk: boolean;
  cableOk: boolean;
  denoiserOk: boolean;
  denoiser: "rnnoise" | "deepfilternet" | null;
  fellBackToLight: boolean;
  dspLoad: number;
  latencyMs: number;
  ncEnabled: boolean;
  ready: boolean;
  cable: CableStatus;
  /** The mic in use; `fallback` = chosen mic missing, using the device's default mic. */
  input: { id: string | null; name: string; fallback: boolean } | null;
  /** Mains hum being removed (Hz), if any. */
  humHz: number | null;
  /** Echo cancellation is on and listening to the speakers. */
  echoCancel: boolean;
  aiVoice: AiVoiceStatus;
}

export type AiState = "off" | "starting" | "live" | "unavailable";
export interface AiVoiceStatus {
  enabled: boolean;
  state: AiState;
  message: string;
  latencyMs: number;
  underruns: number;
}

export interface MeterReading {
  rmsDb: number;
  peakDb: number;
}
export interface Levels {
  input: MeterReading;
  output: MeterReading;
}

export const api = {
  listDevices: () => invoke<DeviceList>("list_devices"),
  getSettings: () => invoke<Settings>("get_settings"),
  startEngine: (inputId: string | null) => invoke<void>("start_engine", { inputId }),
  stopEngine: () => invoke<void>("stop_engine"),
  setNc: (enabled: boolean) => invoke<void>("set_nc", { enabled }),
  setStrength: (level: Strength) => invoke<void>("set_strength", { level }),
  setMonitor: (enabled: boolean) => invoke<void>("set_monitor", { enabled }),
  setVoice: (voiceType: VoiceType, amount: number) => invoke<void>("set_voice", { voiceType, amount }),
  setClarity: (enabled: boolean) => invoke<void>("set_clarity", { enabled }),
  setEchoCancel: (enabled: boolean) => invoke<void>("set_echo_cancel", { enabled }),
  setLanguage: (language: string) => invoke<void>("set_language", { language }),
  setSetupDone: (done: boolean) => invoke<void>("set_setup_done", { done }),
  setAutostart: (enabled: boolean) => invoke<void>("set_autostart", { enabled }),
  getCableStatus: () => invoke<CableStatus>("get_cable_status"),
  getStatus: () => invoke<Status>("get_status"),
  runMicTest: () => invoke<void>("run_mic_test"),
  playMicTest: (variant: "raw" | "clean") => invoke<void>("play_mic_test", { variant }),
  discardMicTest: () => invoke<void>("discard_mic_test"),
  openUrl: (url: string) => invoke<void>("open_url", { url }),
  setActive: (on: boolean) => invoke<void>("set_active", { on }),
  setPillVisible: (visible: boolean) => invoke<void>("set_pill_visible", { visible }),
  showMainWindow: () => invoke<void>("show_main_window"),
};

const SILENT: Levels = { input: { rmsDb: -100, peakDb: -100 }, output: { rmsDb: -100, peakDb: -100 } };

/** Live meter values from the `levels` event (~20×/s). */
export function useLevels(): Levels {
  const [levels, setLevels] = useState<Levels>(SILENT);
  useEffect(() => {
    let un: UnlistenFn | undefined;
    listen<Levels>("levels", (e) => setLevels(e.payload)).then((u) => (un = u));
    return () => un?.();
  }, []);
  return levels;
}

/** Polls engine status every second. */
export function useStatus(): [Status | null, () => void] {
  const [status, setStatus] = useState<Status | null>(null);
  const tick = useRef(() => {});
  tick.current = () => {
    api.getStatus().then(setStatus).catch(() => {});
  };
  useEffect(() => {
    tick.current();
    const id = setInterval(() => tick.current(), 1000);
    return () => clearInterval(id);
  }, []);
  return [status, () => tick.current()];
}

/** Subscribes to a backend event for the lifetime of the component. */
export function useEvent<T>(name: string, onEvent: (payload: T) => void) {
  const cb = useRef(onEvent);
  cb.current = onEvent;
  useEffect(() => {
    let un: UnlistenFn | undefined;
    let dead = false;
    listen<T>(name, (e) => cb.current(e.payload)).then((u) => (dead ? u() : (un = u)));
    return () => {
      dead = true;
      un?.();
    };
  }, [name]);
}

/** What the call hears right now, for the lamp and the pill. */
export type OnAirState = "off" | "blocked" | "live" | "starting" | "fallback";
export function onAirState(active: boolean, voice: VoiceType, status: Status | null): OnAirState {
  if (!active) return "off";
  // Switched on but the call cannot hear Sanay (engine stopped, mic lost, cable missing).
  if (!status || !status.ready) return "blocked";
  if (voice === "natural") return "live";
  const ai = status.aiVoice.state;
  if (ai === "starting") return "starting";
  if (ai === "unavailable") return "fallback";
  return "live";
}
