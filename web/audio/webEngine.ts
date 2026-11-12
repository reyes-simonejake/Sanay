// Browser version of the Sanay pipeline (mirrors src-tauri/src/audio/engine.rs):
//
//  mic ─► mono ─┬─► denoiser ─► wet gain ─┐
//               ├─► delay ────► dry gain ─┴─► HPF 80 Hz ─► voice type ─► sanay-processor (AGC + limiter) ─► monitor
//               └─────────────────────────────────────────────────────► sanay-processor input 0 (raw meter / recording)
//
// Denoiser: GTCRN by default, RNNoise on slow devices. Measured with tests/noise-bench.js
// (5 dB SNR, male + female speech): GTCRN removes far more engine/tricycle noise
// (~23–35 dB vs ~5 dB) and keeps speech cleaner, for ~3x RNNoise's CPU (still ~5% of a core).
// The dry path is delayed by the denoiser's measured latency, so the NC toggle and strength
// crossfade never comb-filter. Everything runs locally; no audio leaves the browser.

import { GtcrnWorkletNode, RnnoiseWorkletNode, loadGtcrn, loadRnnoise } from "@sapphi-red/web-noise-suppressor";
import rnnoiseWorkletUrl from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import rnnoiseWasmUrl from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseSimdWasmUrl from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";
import gtcrnWorkletUrl from "@sapphi-red/web-noise-suppressor/gtcrnWorklet.js?url";
import gtcrnWasmUrl from "@sapphi-red/web-noise-suppressor/gtcrn.wasm?url";
import sanayWorkletUrl from "./sanay-processor.js?url";
import pitchWorkletUrl from "./sanay-pitch.js?url";
import prefilterWorkletUrl from "./sanay-prefilter.js?url";
import SignalsmithStretch from "signalsmith-stretch";
import type { Levels, Strength, VoiceType } from "../../src/lib/api";

export type { VoiceType };

export const SAMPLE_RATE = 48_000;

const ATTENUATION_DB: Record<Strength, number> = { light: 12, normal: 24, strong: 100 };
/** Pause cleanup depth per strength (dB), same as the desktop engine. */
const EXPANDER_DB: Record<Strength, number> = { light: 6, normal: 12, strong: 18 };


// ── Voice enhancement tuning (same as src-tauri/src/audio/voice.rs) ──
// Each preset moves two cues: pitch, and "voice size" (apparent vocal-tract length, measured
// live by sanay-pitch.js). Both have a guaranteed minimum change, so a preset never sounds like
// the natural voice; Natural keeps the speaker's own voice.
// Masculine: toward 100 Hz (either way, max 10 st) and an 18.5 cm "broadcast chest" (≥2 st
//   bigger), crisp EQ. Feminine: up toward 210 Hz (≥1.5 st, never above 250 Hz, never down:
//   lowering sounded "grounded"), 13.6 cm (≥1.5 st smaller), light EQ.
const VOICE_PRESET = {
  masculine: { targetHz: 100, maxSemis: 10, upOnly: false, minSemis: 0, ceilingHz: Infinity, targetVtlCm: 18.5, minFormant: 2, blockMs: 60 },
  feminine: { targetHz: 210, maxSemis: 10, upOnly: true, minSemis: 1.5, ceilingHz: 250, targetVtlCm: 13.6, minFormant: 1.5, blockMs: 60 },
} as const; // 60 ms window: cleanest for big shifts both ways (voice.rs real_speech_window)
/** Below this (pitch and formants), the shifter is skipped (character EQ only). */
const VOICE_MIN_SEMIS = 0.15;
/** Until the speaker's vocal tract is measured, formants follow 0.4× the pitch shift. */
const VOICE_FORMANT_RATIO = 0.4;
const VOICE_FORMANT_MAX = 4;
/** Signalsmith delivers ~78% of a downward and ~90% of an upward formant request. */
const FORMANT_DELIVERY_DOWN = 0.78;
const FORMANT_DELIVERY_UP = 0.9;
/** Above 3 kHz, treat sound as noise-like: −35% artifacts vs 8 kHz (no metallic "s"). */
const VOICE_TONALITY_HZ = 3000;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function planSemitones(type: VoiceType, amount: number, medianHz: number | null): number {
  if (type === "natural") return 0;
  // Until the speaker's pitch is known (~0.2 s of voiced speech) the direction is unknown: EQ only.
  if (!medianHz) return 0;
  const p = VOICE_PRESET[type];
  const toTarget = 12 * Math.log2(p.targetHz / medianHz);
  const semis = p.upOnly
    ? Math.min(Math.max(toTarget, p.minSemis), p.maxSemis, Math.max(0, 12 * Math.log2(p.ceilingHz / medianHz)))
    : Math.max(-p.maxSemis, Math.min(p.maxSemis, toTarget));
  return semis * clamp01(amount);
}

/** Formant shift (st): toward the target voice size, at least the minimum, preset direction only. */
export function planFormants(type: VoiceType, amount: number, semis: number, vtlCm: number | null): number {
  if (type === "natural") return 0;
  const p = VOICE_PRESET[type];
  const dir = type === "masculine" ? -1 : 1;
  const full = vtlCm && vtlCm > 0 ? 12 * Math.log2(vtlCm / p.targetVtlCm) : semis * VOICE_FORMANT_RATIO;
  const size = Math.min(Math.max(dir * full, p.minFormant), VOICE_FORMANT_MAX);
  return dir * size * clamp01(amount);
}

/** What to ask Signalsmith for so that `formants` semitones are actually delivered. */
const formantRequest = (formants: number) => formants / (formants < 0 ? FORMANT_DELIVERY_DOWN : FORMANT_DELIVERY_UP);

export type MicErrorKind = "denied" | "notFound" | "busy" | "insecure" | "unsupported" | "other";

export class MicError extends Error {
  constructor(public kind: MicErrorKind, message: string) {
    super(message);
  }
}

function classify(e: unknown): MicError {
  const name = (e as { name?: string })?.name ?? "";
  const msg = String((e as Error)?.message ?? e);
  if (name === "NotAllowedError" || name === "SecurityError") return new MicError("denied", msg);
  if (name === "NotFoundError" || name === "OverconstrainedError") return new MicError("notFound", msg);
  if (name === "NotReadableError" || name === "AbortError") return new MicError("busy", msg);
  return new MicError("other", msg);
}

export type DenoiserKind = "gtcrn" | "rnnoise";

/** Fallback RNNoise latency (samples) measured in Chrome with web-noise-suppressor 0.4.1. */
const RNNOISE_DEFAULT_LATENCY = 992;

/** If GTCRN needs more than this fraction of real time on one core, use RNNoise instead. */
const GTCRN_MAX_LOAD = 0.3;

export interface MicInfo {
  label: string;
  deviceId: string;
  trackSampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  contextSampleRate: number;
  /** Browser input→output latency (s), if reported. */
  browserLatency: number;
  /** Latency Sanay adds (ms). */
  sanayLatencyMs: number;
  /** Extra latency while a voice type is active (ms). */
  voiceLatencyMs: number;
  denoiser: DenoiserKind;
}

async function loadModules(ctx: BaseAudioContext, kind: DenoiserKind): Promise<void> {
  await ctx.audioWorklet.addModule(kind === "gtcrn" ? gtcrnWorkletUrl : rnnoiseWorkletUrl);
  await ctx.audioWorklet.addModule(sanayWorkletUrl);
  await ctx.audioWorklet.addModule(pitchWorkletUrl);
  await ctx.audioWorklet.addModule(prefilterWorkletUrl);
}

type Denoiser = AudioWorkletNode & { destroy(): void };

function makeDenoiser(ctx: BaseAudioContext, kind: DenoiserKind, wasm: ArrayBuffer): Denoiser {
  // The library's types want a live AudioContext; offline contexts work the same at runtime.
  const c = ctx as unknown as AudioContext;
  const opts = { maxChannels: 1, wasmBinary: wasm.slice(0) };
  return kind === "gtcrn" ? new GtcrnWorkletNode(c, opts) : new RnnoiseWorkletNode(c, opts);
}

/**
 * Speech-like probe: a glottal pulse train with jittery pitch (110–190 Hz), shaped by two
 * formant resonances and a syllable envelope. Denoisers keep it (they would remove plain
 * noise), and the pitch jitter makes the cross-correlation peak unambiguous.
 */
function testSignal(len: number): Float32Array {
  const sig = new Float32Array(len);
  let seed = 0x12345678;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed >>> 8) / (1 << 24);
  };
  // Two-pole resonators at ~700 Hz and ~1200 Hz (vowel-ish formants).
  const res = (f: number, bw: number) => {
    const r = Math.exp((-Math.PI * bw) / SAMPLE_RATE);
    return { a1: 2 * r * Math.cos((2 * Math.PI * f) / SAMPLE_RATE), a2: -r * r, y1: 0, y2: 0 };
  };
  const f1 = res(700, 120);
  const f2 = res(1200, 150);
  let nextPulse = 0;
  for (let i = 0; i < len; i++) {
    let x = 0;
    if (i >= nextPulse) {
      x = 1;
      nextPulse = i + Math.round(SAMPLE_RATE / (110 + 80 * rnd()));
    }
    const y1 = x + f1.a1 * f1.y1 + f1.a2 * f1.y2;
    f1.y2 = f1.y1;
    f1.y1 = y1;
    const y2 = y1 + f2.a1 * f2.y1 + f2.a2 * f2.y2;
    f2.y2 = f2.y1;
    f2.y1 = y2;
    const t = i / SAMPLE_RATE;
    const syllable = Math.max(0, Math.sin(2 * Math.PI * 3 * t)) ** 0.5;
    sig[i] = y2 * syllable;
  }
  let peak = 0;
  for (const v of sig) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < len; i++) sig[i] *= 0.4 / peak;
  return sig;
}

/**
 * Renders broadband test signal through the denoiser offline. Returns the output and how
 * long rendering took relative to real time (a CPU-speed probe for this device).
 */
async function renderOffline(kind: DenoiserKind, wasm: ArrayBuffer, seconds: number) {
  const len = Math.round(SAMPLE_RATE * seconds);
  const off = new OfflineAudioContext(1, len, SAMPLE_RATE);
  await loadModules(off, kind);
  const sig = testSignal(len);
  const buf = off.createBuffer(1, len, SAMPLE_RATE);
  buf.copyToChannel(sig as Float32Array<ArrayBuffer>, 0);
  const src = new AudioBufferSourceNode(off, { buffer: buf });
  src.connect(makeDenoiser(off, kind, wasm)).connect(off.destination);
  src.start();
  // The worklet compiles its WASM asynchronously; offline rendering doesn't wait for that and
  // would produce silence. Pause after the first quantum to give it time to initialise.
  let t0 = 0;
  off.suspend(128 / SAMPLE_RATE).then(() =>
    setTimeout(() => {
      t0 = performance.now();
      off.resume();
    }, 500),
  );
  const out = (await off.startRendering()).getChannelData(0);
  const load = (performance.now() - t0) / (seconds * 1000);
  let eIn = 0;
  let eOut = 0;
  for (let k = 0; k < len; k++) {
    eIn += sig[k] * sig[k];
    eOut += out[k] * out[k];
  }
  // A working denoiser keeps most of a speech-like signal; silence means it never ran.
  if (eOut < eIn * 0.01) throw new Error(`${kind} produced no output`);
  return { sig, out, load };
}

/** Delay of the denoiser in samples, from the cross-correlation peak. */
function findLatency(sig: Float32Array, out: Float32Array): number {
  const start = 9600;
  const end = sig.length - 4096;
  let best = 0;
  let bestCorr = -Infinity;
  for (let lag = 0; lag < 4096; lag++) {
    let c = 0;
    for (let k = start; k < end; k += 2) c += sig[k] * out[k + lag];
    if (c > bestCorr) {
      bestCorr = c;
      best = lag;
    }
  }
  return best;
}

/** Picks GTCRN unless this device is too slow for it, and measures the chosen one's delay. */
async function chooseDenoiser(): Promise<{ kind: DenoiserKind; wasm: ArrayBuffer; latency: number }> {
  try {
    const wasm = await loadGtcrn({ url: gtcrnWasmUrl });
    const { sig, out, load } = await renderOffline("gtcrn", wasm, 1.5);
    if (load <= GTCRN_MAX_LOAD) return { kind: "gtcrn", wasm, latency: findLatency(sig, out) };
    console.info(`Sanay: GTCRN load ${(load * 100).toFixed(0)}% is too high here; using RNNoise`);
  } catch (e) {
    console.warn("Sanay: GTCRN unavailable, using RNNoise", e);
  }
  const wasm = await loadRnnoise({ url: rnnoiseWasmUrl, simdUrl: rnnoiseSimdWasmUrl });
  let latency = RNNOISE_DEFAULT_LATENCY;
  try {
    const { sig, out } = await renderOffline("rnnoise", wasm, 1);
    latency = findLatency(sig, out);
  } catch (e) {
    console.warn(`Sanay: could not measure RNNoise latency, assuming ${latency}`, e);
  }
  return { kind: "rnnoise", wasm, latency };
}

export class WebEngine {
  readonly ctx: AudioContext;
  readonly rawAnalyser: AnalyserNode;
  readonly cleanAnalyser: AnalyserNode;
  private latencySamples: number;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private mono: GainNode;
  private denoiser: Denoiser;
  readonly denoiserKind: DenoiserKind;
  private wet: GainNode;
  private dry: GainNode;
  private hpf: BiquadFilterNode;
  private shifters: Record<"masculine" | "feminine", { node: StretchNode; wet: GainNode; latency: number; running: boolean }>;
  private voiceDry: GainNode;
  private voiceType: VoiceType = "natural";
  private voiceAmount = 0.8;
  private voiceStopTimer = 0;
  /** Speaker's median pitch from the sanay-pitch worklet, once known. */
  private speakerHz: number | null = null;
  /** Speaker's apparent vocal-tract length (cm), once measured. */
  private speakerVtl: number | null = null;
  private appliedFormants: number | null = null;
  private appliedSemis: number | null = null;
  /** Which shifter currently feeds the output (null = untouched voice + character only). */
  private activeShifter: "masculine" | "feminine" | null = null;
  private pitch: AudioWorkletNode;
  private prefilter: AudioWorkletNode;
  private clarity = true;
  /** Mains hum currently being removed (Hz), or 0. */
  humHz = 0;
  private proc: AudioWorkletNode;
  private monitor: GainNode;
  private playback: AudioBufferSourceNode | null = null;
  private levelsCb: ((l: Levels) => void) | null = null;
  private recordResolve: ((r: { raw: Float32Array; clean: Float32Array }) => void) | null = null;
  private nc = true;
  private strength: Strength = "strong";
  private monitorOn = false;

  private constructor(
    ctx: AudioContext,
    kind: DenoiserKind,
    wasm: ArrayBuffer,
    latencySamples: number,
    deep: { node: StretchNode; latency: number },
    bright: { node: StretchNode; latency: number },
  ) {
    this.ctx = ctx;
    this.latencySamples = latencySamples;

    // Explicit mono downmix (spec step 2).
    this.mono = new GainNode(ctx, { channelCount: 1, channelCountMode: "explicit", channelInterpretation: "speakers" });
    this.denoiserKind = kind;
    this.denoiser = makeDenoiser(ctx, kind, wasm);
    this.wet = new GainNode(ctx, { gain: 0 });
    const delay = new DelayNode(ctx, { maxDelayTime: 0.1, delayTime: latencySamples / SAMPLE_RATE });
    this.dry = new GainNode(ctx, { gain: 1 });
    this.hpf = new BiquadFilterNode(ctx, { type: "highpass", frequency: 80, Q: Math.SQRT1_2 });
    this.proc = new AudioWorkletNode(ctx, "sanay-processor", {
      numberOfInputs: 2,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: "explicit",
    });
    this.rawAnalyser = new AnalyserNode(ctx, { fftSize: 4096, smoothingTimeConstant: 0.7 });
    this.cleanAnalyser = new AnalyserNode(ctx, { fftSize: 4096, smoothingTimeConstant: 0.7 });
    this.monitor = new GainNode(ctx, { gain: 0 });

    // Hum / rumble removal before the denoiser (both paths), raw meter/recording stay raw.
    this.prefilter = new AudioWorkletNode(ctx, "sanay-prefilter", { outputChannelCount: [1], channelCount: 1, channelCountMode: "explicit" });
    this.prefilter.port.onmessage = (e) => {
      if (e.data.type === "hum") this.humHz = e.data.hz;
    };
    this.mono.connect(this.prefilter);
    this.prefilter.connect(this.denoiser).connect(this.wet).connect(this.hpf);
    this.prefilter.connect(delay).connect(this.dry).connect(this.hpf);
    this.mono.connect(this.proc, 0, 0);
    this.mono.connect(this.rawAnalyser);
    // Voice type stage: crossfade between the untouched voice and the pitch/formant-shifted one.
    this.voiceDry = new GainNode(ctx, { gain: 1 });
    this.hpf.connect(this.voiceDry).connect(this.proc, 0, 1);
    const mk = (s: { node: StretchNode; latency: number }) => {
      const wet = new GainNode(ctx, { gain: 0 });
      this.hpf.connect(s.node).connect(wet).connect(this.proc, 0, 1);
      return { node: s.node, wet, latency: s.latency, running: false };
    };
    this.shifters = { masculine: mk(deep), feminine: mk(bright) };
    // Pitch tracker listens to the cleaned (denoised) voice, so noise can't fool it.
    this.pitch = new AudioWorkletNode(ctx, "sanay-pitch", { numberOfOutputs: 0 });
    this.hpf.connect(this.pitch);
    this.pitch.port.onmessage = (e) => {
      if (e.data.type !== "f0") return;
      this.speakerHz = e.data.median;
      this.speakerVtl = e.data.vtl || null;
      if (this.voiceType !== "natural") this.applyVoice(false);
    };
    this.proc.connect(this.cleanAnalyser);
    this.proc.connect(this.monitor).connect(ctx.destination);

    this.proc.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === "levels") this.levelsCb?.({ input: m.input, output: m.output });
      else if (m.type === "recorded") {
        this.recordResolve?.({ raw: m.raw, clean: m.clean });
        this.recordResolve = null;
      }
    };
    this.applyMix();
    this.sendCharacter();
  }

  static async create(): Promise<WebEngine> {
    if (!window.isSecureContext) throw new MicError("insecure", "Microphone needs HTTPS");
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === "undefined") {
      throw new MicError("unsupported", "This browser can't run the mic test");
    }
    const { kind, wasm, latency } = await chooseDenoiser();
    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: "interactive" });
    await loadModules(ctx, kind);
    const makeShifter = async (blockMs: number) => {
      const node = (await SignalsmithStretch(ctx, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      })) as StretchNode;
      await node.configure({ blockMs });
      return { node, latency: await node.latency() };
    };
    const deep = await makeShifter(VOICE_PRESET.masculine.blockMs);
    const bright = await makeShifter(VOICE_PRESET.feminine.blockMs);
    return new WebEngine(ctx, kind, wasm, latency, deep, bright);
  }

  /** Opens the mic. Browser DSP is off so visitors hear their real, unprocessed mic as "raw". */
  async start(deviceId?: string): Promise<void> {
    this.stopMic();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch (e) {
      throw classify(e);
    }
    await this.ctx.resume();
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.source.connect(this.mono);
  }

  /** Test hook (tests/voice-e2e.js): feed any audio node, e.g. a file player, instead of the mic. */
  useSource(node: AudioNode) {
    this.stopMic();
    node.connect(this.mono);
  }

  stopMic() {
    this.source?.disconnect();
    this.source = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  get running() {
    return !!this.stream;
  }

  onEnded(cb: () => void) {
    this.stream?.getAudioTracks()[0]?.addEventListener("ended", cb);
  }

  onLevels(cb: ((l: Levels) => void) | null) {
    this.levelsCb = cb;
  }

  setNc(on: boolean) {
    this.nc = on;
    this.applyMix();
  }

  setStrength(s: Strength) {
    this.strength = s;
    this.applyMix();
  }

  setAgc(on: boolean) {
    this.proc.port.postMessage({ type: "agc", enabled: on });
  }

  /** Same crossfade as NoiseStage in denoise.rs: m·wet + (1−m)·dry, ramped over ~20 ms. */
  private applyMix() {
    this.prefilter.port.postMessage({ type: "enabled", enabled: this.nc });
    this.proc.port.postMessage({ type: "expander", depthDb: this.nc ? EXPANDER_DB[this.strength] : 0 });
    const m = this.nc ? 1 - Math.pow(10, -ATTENUATION_DB[this.strength] / 20) : 0;
    const t = this.ctx.currentTime;
    this.wet.gain.setTargetAtTime(m, t, 0.007);
    this.dry.gain.setTargetAtTime(1 - m, t, 0.007);
  }

  /**
   * Voice enhancement preset: "masculine" = deep & clear, "feminine" = bright & clear.
   * Character EQ/compression always applies for a preset; the pitch shifter only runs when
   * the speaker's voice actually needs a nudge toward the preset. `amount` is 0..1.
   */
  setVoice(type: VoiceType, amount: number) {
    this.voiceType = type;
    this.voiceAmount = amount;
    this.sendCharacter();
    this.applyVoice(true);
  }

  /** Clarity boost (de-mud, presence, de-essing) for the natural voice. */
  setClarity(on: boolean) {
    this.clarity = on;
    this.sendCharacter();
  }

  private sendCharacter() {
    const preset = this.voiceType !== "natural" ? this.voiceType : this.clarity ? "clear" : "natural";
    const amount = this.voiceType !== "natural" ? this.voiceAmount : 1;
    this.proc.port.postMessage({ type: "character", voice: preset, amount });
  }

  /** Routes audio through the right shifter (or none) and tunes it. */
  private applyVoice(force: boolean) {
    const t = this.ctx.currentTime;
    const semis = planSemitones(this.voiceType, this.voiceAmount, this.speakerHz);
    const formants = this.speakerHz ? planFormants(this.voiceType, this.voiceAmount, semis, this.speakerVtl) : 0;
    const want =
      this.voiceType !== "natural" && (Math.abs(semis) >= VOICE_MIN_SEMIS || Math.abs(formants) >= VOICE_MIN_SEMIS)
        ? this.voiceType
        : null;

    if (want !== this.activeShifter) {
      clearTimeout(this.voiceStopTimer);
      for (const [k, sh] of Object.entries(this.shifters) as ["masculine" | "feminine", (typeof this.shifters)["masculine"]][]) {
        sh.wet.gain.setTargetAtTime(k === want ? 1 : 0, t, 0.01);
      }
      this.voiceDry.gain.setTargetAtTime(want ? 0 : 1, t, 0.01);
      const prev = this.activeShifter;
      this.activeShifter = want;
      this.appliedSemis = null;
      this.appliedFormants = null;
      // Stop the shifter we just faded out (saves CPU).
      if (prev) this.voiceStopTimer = window.setTimeout(() => {
        if (this.activeShifter !== prev) {
          void this.shifters[prev].node.stop();
          this.shifters[prev].running = false;
        }
      }, 150);
    }
    if (!want) return;
    if (
      !force &&
      this.appliedSemis !== null &&
      this.appliedFormants !== null &&
      Math.abs(semis - this.appliedSemis) < 0.2 &&
      Math.abs(formants - this.appliedFormants) < 0.2
    )
      return;
    this.appliedSemis = semis;
    this.appliedFormants = formants;
    this.shifters[want].running = true;
    void this.shifters[want].node.schedule({
      active: true,
      semitones: semis,
      formantSemitones: formantRequest(formants),
      formantCompensation: true,
      formantBaseHz: this.speakerHz ?? 0,
      tonalityHz: VOICE_TONALITY_HZ,
    });
  }

  /** The speaker's median pitch (Hz), once ~0.2 s of voiced speech has been heard. */
  get speakerPitch(): number | null {
    return this.speakerHz;
  }

  /** The speaker's apparent vocal-tract length (cm), once measured. */
  get speakerVocalTract(): number | null {
    return this.speakerVtl;
  }

  setMonitor(on: boolean) {
    this.monitorOn = on;
    this.monitor.gain.setTargetAtTime(on && !this.playback ? 1 : 0, this.ctx.currentTime, 0.01);
  }

  record(seconds: number): Promise<{ raw: Float32Array; clean: Float32Array }> {
    return new Promise((resolve) => {
      this.recordResolve = resolve;
      this.proc.port.postMessage({ type: "record", samples: Math.round(seconds * SAMPLE_RATE) });
    });
  }

  /** Ends the current recording now; record() resolves with what was captured so far. */
  stopRecording() {
    this.proc.port.postMessage({ type: "recordStop" });
  }

  /** Plays a recorded clip. The live monitor is muted meanwhile. */
  play(samples: Float32Array): Promise<void> {
    this.stopPlayback();
    const buf = this.ctx.createBuffer(1, samples.length, SAMPLE_RATE);
    buf.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    const src = new AudioBufferSourceNode(this.ctx, { buffer: buf });
    src.connect(this.ctx.destination);
    this.playback = src;
    this.setMonitor(this.monitorOn);
    return new Promise((resolve) => {
      src.onended = () => {
        if (this.playback === src) this.playback = null;
        this.setMonitor(this.monitorOn);
        resolve();
      };
      src.start();
    });
  }

  stopPlayback() {
    try {
      this.playback?.stop();
    } catch {
      /* already stopped */
    }
    this.playback = null;
  }

  info(): MicInfo | null {
    const track = this.stream?.getAudioTracks()[0];
    if (!track) return null;
    const s = track.getSettings();
    return {
      label: track.label || "Microphone",
      deviceId: s.deviceId ?? "",
      trackSampleRate: s.sampleRate,
      channelCount: s.channelCount,
      echoCancellation: s.echoCancellation !== undefined && s.echoCancellation !== false,
      noiseSuppression: s.noiseSuppression,
      autoGainControl: s.autoGainControl === true,
      contextSampleRate: this.ctx.sampleRate,
      browserLatency: (this.ctx.baseLatency ?? 0) + (this.ctx.outputLatency ?? 0),
      sanayLatencyMs: (this.latencySamples / SAMPLE_RATE) * 1000,
      voiceLatencyMs: this.activeShifter ? this.shifters[this.activeShifter].latency * 1000 : 0,
      denoiser: this.denoiserKind,
    };
  }

  async close() {
    this.stopPlayback();
    this.stopMic();
    this.denoiser.destroy();
    clearTimeout(this.voiceStopTimer);
    await this.ctx.close();
  }
}

export async function listMics(): Promise<MediaDeviceInfo[]> {
  const all = await navigator.mediaDevices.enumerateDevices();
  // Chrome adds "default"/"communications" aliases; the picker has its own default option.
  return all.filter(
    (d) => d.kind === "audioinput" && d.deviceId !== "" && d.deviceId !== "default" && d.deviceId !== "communications",
  );
}

/** The parts of the Signalsmith Stretch node we use (the package ships no types). */
interface StretchNode extends AudioNode {
  schedule(change: {
    active?: boolean;
    semitones?: number;
    formantSemitones?: number;
    formantCompensation?: boolean;
    formantBaseHz?: number;
    tonalityHz?: number;
    output?: number;
  }): Promise<unknown>;
  configure(opts: { blockMs?: number; intervalMs?: number; splitComputation?: boolean }): Promise<void>;
  start(when?: number): Promise<unknown>;
  stop(when?: number): Promise<unknown>;
  /** Live-input latency in seconds (resolved by the worklet). */
  latency(): Promise<number>;
}

/** For tests only (tests/noise-bench.js, browser checks). */
export const _internal = { renderOffline, findLatency, loadRnnoiseWasm: () => loadRnnoise({ url: rnnoiseWasmUrl, simdUrl: rnnoiseSimdWasmUrl }) };
