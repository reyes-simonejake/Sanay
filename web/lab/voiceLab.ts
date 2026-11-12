// Voice-type lab: renders masculine / feminine variants offline so they can be compared by
// ear and by a round-trip artifact score. Dev-only (not part of the production build).
//
//   pnpm web:dev  →  http://localhost:5173/lab/

import SignalsmithStretch from "signalsmith-stretch";

export const SR = 48000;

export interface Variant {
  id: string;
  name: string;
  blockMs: number;
  /** "fixed": shift by ±maxSemis·amount. "target": move the speaker's median pitch toward targetHz. */
  mode: "fixed" | "target";
  maxSemis: number;
  targetHz: { masculine: number; feminine: number };
  /** Formant shift = pitch shift × formantRatio (semitones). Praat's "change gender" ≈ 1.65 st per ~6 st. */
  formantRatio: number;
  /** "auto" = Signalsmith pitch-tracks for formant analysis; "median" = pinned to measured median F0. */
  formantBase: "auto" | "median";
  tonalityHz: number;
}

export const VARIANTS: Variant[] = [
  {
    id: "v1",
    name: "Old (45 ms, fixed ±6 st, strong formants, 8 kHz)",
    blockMs: 45,
    mode: "fixed",
    maxSemis: 6,
    targetHz: { masculine: 0, feminine: 0 },
    formantRatio: 0.5,
    formantBase: "auto",
    tonalityHz: 8000,
  },
  {
    id: "pro",
    name: "Professional preset pitch nudge (≤3 / ≤2.5 st)",
    blockMs: 90,
    mode: "target",
    maxSemis: 3,
    targetHz: { masculine: 110, feminine: 205 },
    formantRatio: 0.3,
    formantBase: "median",
    tonalityHz: 3000,
  },
];
// Note: the lab renders the pitch stage only. The full preset (with the character EQ,
// de-esser and compressor) is easiest to judge on the main page: Record and compare.

// ── Pitch (YIN on a 12 kHz copy; voiced frames only) ──

function decimate4(x: Float32Array): Float32Array {
  // 4-tap box filter then keep every 4th sample: fine for F0 (<500 Hz).
  const out = new Float32Array(Math.floor(x.length / 4));
  for (let i = 0; i < out.length; i++) out[i] = (x[4 * i] + x[4 * i + 1] + x[4 * i + 2] + x[4 * i + 3]) / 4;
  return out;
}

/** Per-frame F0 (Hz) or 0 when unvoiced. 40 ms windows, 10 ms hop. */
export function pitchTrack(x: Float32Array): number[] {
  const y = decimate4(x);
  const sr = SR / 4;
  const W = 480; // 40 ms
  const hop = 120;
  const tauMin = Math.floor(sr / 400);
  const tauMax = Math.ceil(sr / 60);
  const d = new Float32Array(tauMax + 1);
  const f0: number[] = [];
  for (let s = 0; s + W + tauMax < y.length; s += hop) {
    let energy = 0;
    for (let k = 0; k < W; k++) energy += y[s + k] ** 2;
    if (energy / W < 1e-6) {
      f0.push(0);
      continue;
    }
    for (let tau = 1; tau <= tauMax; tau++) {
      let sum = 0;
      for (let k = 0; k < W; k++) {
        const diff = y[s + k] - y[s + k + tau];
        sum += diff * diff;
      }
      d[tau] = sum;
    }
    // Cumulative mean normalised difference; first dip below 0.15.
    let run = 0;
    let found = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      run += d[tau];
      const cmnd = (d[tau] * tau) / (run || 1);
      if (tau >= tauMin && cmnd < 0.15) {
        // Walk to the local minimum.
        let t = tau;
        while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
        found = t;
        break;
      }
    }
    f0.push(found ? sr / found : 0);
  }
  return f0;
}

export function medianF0(x: Float32Array): number {
  const v = pitchTrack(x).filter((f) => f > 0).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 0;
}

// ── Rendering ──

export interface Shift {
  semis: number;
  formantSemis: number;
  baseHz: number;
}

export function plan(v: Variant, voice: "masculine" | "feminine", amount: number, srcMedian: number): Shift {
  let semis: number;
  if (v.mode === "fixed") {
    semis = (voice === "masculine" ? -1 : 1) * v.maxSemis * amount;
  } else {
    const full = 12 * Math.log2(v.targetHz[voice] / srcMedian);
    // Only move in the requested direction (a deep voice choosing "masculine" stays put).
    const directional = voice === "masculine" ? Math.min(0, full) : Math.max(0, full);
    semis = Math.max(-v.maxSemis, Math.min(v.maxSemis, directional)) * amount;
  }
  return {
    semis,
    formantSemis: v.mode === "fixed" ? (voice === "masculine" ? -3 : 3) * amount : semis * v.formantRatio,
    baseHz: v.formantBase === "median" ? srcMedian : 0,
  };
}

/** Offline render through Signalsmith Stretch; output aligned to the input (latency removed). */
export async function render(input: Float32Array, v: Variant, sh: Shift): Promise<Float32Array> {
  const pad = Math.round(SR * 0.5);
  const off = new OfflineAudioContext(1, input.length + pad, SR);
  const st = (await SignalsmithStretch(off, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] })) as AudioNode & {
    configure(o: { blockMs: number }): Promise<void>;
    latency(): Promise<number>;
    schedule(o: object): Promise<void>;
  };
  await st.configure({ blockMs: v.blockMs });
  const lat = Math.round((await st.latency()) * SR);
  const buf = off.createBuffer(1, input.length + pad, SR);
  buf.copyToChannel(input as Float32Array<ArrayBuffer>, 0);
  const src = new AudioBufferSourceNode(off, { buffer: buf });
  src.connect(st).connect(off.destination);
  src.start();
  await st.schedule({
    active: true,
    semitones: sh.semis,
    formantSemitones: sh.formantSemis,
    formantCompensation: true,
    formantBaseHz: sh.baseHz,
    tonalityHz: v.tonalityHz,
  });
  const out = (await off.startRendering()).getChannelData(0);
  return out.slice(lat, lat + input.length);
}

// ── Scoring ──

const twiddles = new Map<number, { cos: Float64Array; sin: Float64Array }>();

/** In-place radix-2 FFT (re, im of length power of 2). */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  let tw = twiddles.get(n);
  if (!tw) {
    tw = { cos: new Float64Array(n / 2), sin: new Float64Array(n / 2) };
    for (let k = 0; k < n / 2; k++) {
      tw.cos[k] = Math.cos((-2 * Math.PI * k) / n);
      tw.sin[k] = Math.sin((-2 * Math.PI * k) / n);
    }
    twiddles.set(n, tw);
  }
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const stride = n / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = tw.cos[k * stride];
        const wi = tw.sin[k * stride];
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
      }
    }
  }
}

/** Log-magnitude spectrogram (2048-pt Hann, 10 ms hop), bins up to 8 kHz. */
function logSpec(x: Float32Array, offset = 0): Float64Array[] {
  const N = 2048;
  const hop = 960; // 20 ms
  const maxBin = Math.floor((8000 / SR) * N);
  const win = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const frames: Float64Array[] = [];
  for (let s = Math.max(0, offset); s + N < x.length; s += hop) {
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[s + i] * win[i];
    fft(re, im);
    const m = new Float64Array(maxBin);
    for (let b = 0; b < maxBin; b++) m[b] = 10 * Math.log10(re[b] ** 2 + im[b] ** 2 + 1e-10);
    frames.push(m);
  }
  return frames;
}

/**
 * Log-spectral distance (dB) between reference and estimate over the louder (speech) frames.
 * Phase-insensitive, which matters: a phase vocoder legitimately changes waveform phase.
 */
export function lsd(ref: Float32Array, est: Float32Array): number {
  // Coarse alignment by envelope cross-correlation (±20 ms).
  let best = 0;
  let bc = -Infinity;
  for (let lag = -960; lag <= 960; lag += 24) {
    let c = 0;
    for (let k = 4000; k < ref.length - 4000; k += 48) c += Math.abs(ref[k]) * Math.abs(est[k + lag] ?? 0);
    if (c > bc) {
      bc = c;
      best = lag;
    }
  }
  const A = logSpec(ref);
  const B = logSpec(est, best);
  const energy = A.map((f) => f.reduce((s, v) => s + 10 ** (v / 10), 0));
  const loud = Math.max(...energy) / 1000; // within 30 dB of the loudest frame
  let total = 0;
  let count = 0;
  for (let i = 0; i < Math.min(A.length, B.length); i++) {
    if (energy[i] < loud) continue;
    let d = 0;
    for (let b = 0; b < A[i].length; b++) d += (Math.max(A[i][b], -80) - Math.max(B[i][b], -80)) ** 2;
    total += Math.sqrt(d / A[i].length);
    count++;
  }
  return total / count;
}

export function siSdr(ref: Float32Array, est: Float32Array): number {
  // Fine-align (±400 samples) before scoring.
  let best = 0;
  let bc = -Infinity;
  for (let lag = -400; lag <= 400; lag += 2) {
    let c = 0;
    for (let k = 2000; k < ref.length - 2000; k += 3) c += ref[k] * est[k + lag];
    if (c > bc) {
      bc = c;
      best = lag;
    }
  }
  let dot = 0;
  let rr = 0;
  for (let k = 2000; k < ref.length - 2000; k++) {
    dot += ref[k] * est[k + best];
    rr += ref[k] * ref[k];
  }
  const a = dot / rr;
  let s = 0;
  let n = 0;
  for (let k = 2000; k < ref.length - 2000; k++) {
    const t = a * ref[k];
    s += t * t;
    n += (est[k + best] - t) ** 2;
  }
  return 10 * Math.log10(s / n);
}

export interface Score {
  variant: string;
  voice: "masculine" | "feminine";
  semis: number;
  srcF0: number;
  outF0: number;
  /** Shift then shift back: log-spectral distance from the original (dB, lower = cleaner). */
  roundTripLsd: number;
  latencyMs: number;
}

export async function score(input: Float32Array, v: Variant, voice: "masculine" | "feminine", amount = 1): Promise<{ score: Score; audio: Float32Array }> {
  const srcF0 = medianF0(input);
  const sh = plan(v, voice, amount, srcF0);
  const audio = await render(input, v, sh);
  let roundTripLsd = 0;
  if (Math.abs(sh.semis) > 0.05) {
    const back = await render(audio, v, { semis: -sh.semis, formantSemis: -sh.formantSemis, baseHz: sh.baseHz ? srcF0 * 2 ** (sh.semis / 12) : 0 });
    roundTripLsd = +lsd(input, back).toFixed(2);
  }
  return {
    audio,
    score: {
      variant: v.id,
      voice,
      semis: +sh.semis.toFixed(2),
      srcF0: +srcF0.toFixed(0),
      outF0: +medianF0(audio).toFixed(0),
      roundTripLsd,
      latencyMs: v.blockMs,
    },
  };
}

export async function loadSample(name: string): Promise<Float32Array> {
  const buf = await (await fetch(`/@fs/C:/Sanay/tests/audio_samples/${name}`)).arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, SR);
  return (await ctx.decodeAudioData(buf)).getChannelData(0).slice();
}
