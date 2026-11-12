// All of the browser voice lab's state and actions (mic, cleaning, record/compare, AI preview),
// shared by the hero (start button, orb) and the lab panel below it.
import { useEffect, useRef, useState } from "react";
import type { TKey } from "../src/i18n";
import type { Levels, Strength } from "../src/lib/api";
import { aiConvert, aiStatus, type AiResult, type AiServerStatus, type AiVoice } from "./audio/aiVoice";
import { listMics, MicError, WebEngine, type MicInfo, type VoiceType } from "./audio/webEngine";

export const RECORD_SECONDS = 60;
export type Verdict = "waiting" | "silent" | "quiet" | "good" | "loud";
export const SILENT: Levels = { input: { rmsDb: -100, peakDb: -100 }, output: { rmsDb: -100, peakDb: -100 } };

/** Classifies the last ~3 s of raw input levels. */
function judge(history: Levels[], startedAt: number): Verdict {
  if (history.length < 10) return "waiting";
  const peaks = history.map((l) => l.input.peakDb);
  const rms = history.map((l) => l.input.rmsDb);
  const loudest = Math.max(...rms);
  if (peaks.filter((p) => p > -0.5).length >= 3) return "loud";
  if (loudest < -65) return Date.now() - startedAt > 4000 ? "silent" : "waiting";
  if (loudest < -42) return "quiet";
  return "good";
}

export function useVoiceLab() {
  const engine = useRef<WebEngine | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "live">("idle");
  const [error, setError] = useState<{ kind: string; msg: string } | null>(null);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  // The mic the user picked ("" = the device's default mic) vs. what is actually open.
  const [preferredId, setPreferredId] = useState<string>("");
  const preferred = useRef("");
  const onFallback = useRef(false);
  const [notice, setNotice] = useState<{ key: TKey; name: string } | null>(null);
  const [info, setInfo] = useState<MicInfo | null>(null);
  const [levels, setLevels] = useState<Levels>(SILENT);
  const [verdict, setVerdict] = useState<Verdict>("waiting");
  const history = useRef<Levels[]>([]);
  const startedAt = useRef(0);

  const [nc, setNcState] = useState(true);
  const [strength, setStrengthState] = useState<Strength>("strong");
  const [agc, setAgcState] = useState(true);
  const [listen, setListenState] = useState(false);
  const [voice, setVoiceState] = useState<VoiceType>("natural");
  const [voiceAmount] = useState(1);
  const [clarity, setClarityState] = useState(true);
  const [humHz, setHumHz] = useState(0);

  const [rec, setRec] = useState<{ raw: Float32Array; clean: Float32Array } | null>(null);
  const [recording, setRecording] = useState(false);
  const [left, setLeft] = useState(RECORD_SECONDS);
  const [playing, setPlaying] = useState<"raw" | "clean" | AiVoice | null>(null);
  // AI voice preview (only when the local voice server is running)
  const [aiSrv, setAiSrv] = useState<AiServerStatus | null>(null);
  const [aiWorking, setAiWorking] = useState<AiVoice | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [aiOut, setAiOut] = useState<Partial<Record<AiVoice, AiResult>>>({});
  const [recVoice, setRecVoice] = useState<VoiceType>("natural");

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      const s = await aiStatus();
      if (alive) setAiSrv(s);
    };
    void poll();
    const id = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => () => void engine.current?.close(), []);

  const ensureEngine = async () => {
    if (engine.current) return engine.current;
    setPhase("loading");
    const e = await WebEngine.create();
    e.onLevels((l) => {
      setLevels(l);
      setHumHz(e.humHz);
      history.current = [...history.current.slice(-59), l];
      setVerdict(judge(history.current, startedAt.current));
    });
    e.setNc(nc);
    e.setStrength(strength);
    e.setAgc(agc);
    e.setVoice(voice, voiceAmount);
    e.setClarity(clarity);
    engine.current = e;
    return e;
  };

  /**
   * Opens the user's chosen mic, or the device's default mic if the chosen one is missing,
   * busy or unplugged, so nobody is left without a working mic.
   * `reason`: "user" (picked in the list), "unplugged" (track ended), "back" (headset returned).
   */
  const connect = async (deviceId: string = preferred.current, reason: "user" | "unplugged" | "back" = "user") => {
    setError(null);
    preferred.current = deviceId;
    setPreferredId(deviceId);
    try {
      const e = await ensureEngine();
      let fellBack = false;
      try {
        await e.start(deviceId || undefined);
      } catch (err) {
        // Permission is per-site, so another mic won't help; anything else, try the default.
        if (!deviceId || (err instanceof MicError && err.kind === "denied")) throw err;
        await e.start(undefined);
        fellBack = true;
      }
      onFallback.current = fellBack;
      history.current = [];
      startedAt.current = Date.now();
      setVerdict("waiting");
      const i = e.info();
      setInfo(i);
      const name = i?.label ?? "";
      if (fellBack) setNotice({ key: reason === "unplugged" ? "web.fallbackUnplugged" : "web.fallback", name });
      else setNotice(reason === "back" ? { key: "web.switchedBack", name } : null);
      setMics(await listMics());
      e.onEnded(onUnplugged);
      setPhase("live");
    } catch (err) {
      const kind = err instanceof MicError ? err.kind : "other";
      setError({ kind, msg: String((err as Error)?.message ?? err) });
      setPhase(engine.current?.running ? "live" : "idle");
    }
  };

  /** The open mic went away (unplugged, disabled, driver reset). */
  const onUnplugged = () => {
    // Give the OS a moment to settle on a new default device.
    setTimeout(() => {
      if (preferred.current && !onFallback.current) connect(preferred.current, "unplugged");
      else connect("", "unplugged");
    }, 400);
  };

  // Refresh the list on plug/unplug, and return to the chosen mic when it comes back.
  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md) return;
    const onChange = async () => {
      if (phase !== "live") return;
      const list = await listMics();
      setMics(list);
      if (onFallback.current && preferred.current && list.some((m) => m.deviceId === preferred.current)) {
        connect(preferred.current, "back");
      }
    };
    md.addEventListener("devicechange", onChange);
    return () => md.removeEventListener("devicechange", onChange);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => {
    engine.current?.stopPlayback();
    engine.current?.stopMic();
    setListenState(false);
    engine.current?.setMonitor(false);
    setLevels(SILENT);
    setPhase("idle");
  };

  const record = async () => {
    const e = engine.current;
    if (!e) return;
    setRecording(true);
    setLeft(RECORD_SECONDS);
    const timer = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    setRecVoice(voice);
    const r = await e.record(RECORD_SECONDS);
    clearInterval(timer);
    setRec(r);
    setAiOut({});
    setAiErr(null);
    setRecording(false);
  };

  const play = async (which: "raw" | "clean") => {
    if (!engine.current || !rec) return;
    setPlaying(which);
    await engine.current.play(rec[which]);
    setPlaying((p) => (p === which ? null : p));
  };

  /** Convert the cleaned recording with the AI voice (once per voice), then play it. */
  const playAi = async (v: AiVoice) => {
    const e = engine.current;
    if (!e || !rec) return;
    let out = aiOut[v];
    if (!out) {
      setAiWorking(v);
      setAiErr(null);
      try {
        out = await aiConvert(rec.clean, v);
        setAiOut((o) => ({ ...o, [v]: out }));
      } catch (err) {
        setAiErr(err instanceof Error ? err.message : String(err));
        return;
      } finally {
        setAiWorking(null);
      }
    }
    setPlaying(v);
    await e.play(out.audio);
    setPlaying((p) => (p === v ? null : p));
  };

  const stopPlayback = () => {
    engine.current?.stopPlayback();
    setPlaying(null);
  };
  const discard = () => {
    stopPlayback();
    setRec(null);
    setAiOut({});
    setAiErr(null);
  };

  return {
    engine: engine.current,
    phase,
    error,
    mics,
    selectedMic: onFallback.current ? "" : preferredId,
    notice,
    info,
    levels,
    verdict,
    humHz,
    nc,
    strength,
    agc,
    listen,
    voice,
    clarity,
    rec,
    recording,
    left,
    playing,
    aiSrv,
    aiWorking,
    aiErr,
    aiOut,
    recVoice,
    connect,
    stop,
    record,
    stopRecording: () => engine.current?.stopRecording(),
    play,
    playAi,
    stopPlayback,
    discard,
    setNc: (v: boolean) => (setNcState(v), engine.current?.setNc(v)),
    setStrength: (s: Strength) => (setStrengthState(s), engine.current?.setStrength(s)),
    setAgc: (v: boolean) => (setAgcState(v), engine.current?.setAgc(v)),
    setListen: (v: boolean) => (setListenState(v), engine.current?.setMonitor(v)),
    setClarity: (v: boolean) => (setClarityState(v), engine.current?.setClarity(v)),
    setVoice: (v: VoiceType) => (setVoiceState(v), engine.current?.setVoice(v, voiceAmount)),
  };
}

export type VoiceLab = ReturnType<typeof useVoiceLab>;
