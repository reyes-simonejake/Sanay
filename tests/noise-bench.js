// Noise-cancellation benchmark for the web pipeline. Run in the browser through the Vite dev
// server (`pnpm web:dev`), e.g. from the devtools console:
//
//   const b = await import('/@fs/C:/Sanay/tests/noise-bench.js'); await b.run()
//
// Clean speech: tests/audio_samples/speech_{male,female}.wav (Windows TTS, see tests/README.md).
// Each clip is mixed with synthetic interview-style noise at a fixed SNR, rendered offline
// through the same Web Audio nodes the site uses, and scored against the clean reference.

const PKG = "/@fs/C:/Sanay/node_modules/@sapphi-red/web-noise-suppressor/dist";
const SAMPLES = "/@fs/C:/Sanay/tests/audio_samples";
const SR = 48000;
const LEAD = SR; // 1 s of noise before speech starts

async function loadWav(name) {
  const buf = await (await fetch(`${SAMPLES}/${name}`)).arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, SR);
  const audio = await ctx.decodeAudioData(buf);
  return audio.getChannelData(0).slice();
}

function rng(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed >>> 8) / (1 << 24) - 0.5;
  };
}

// ── Noise generators (48 kHz) ──
function fan(n) {
  // Pink-ish noise + 100/200 Hz motor hum: stationary, like an electric fan.
  const r = rng(1), out = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    const w = r();
    b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527;
    const t = i / SR;
    out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.3 + 0.08 * Math.sin(2 * Math.PI * 100 * t) + 0.04 * Math.sin(2 * Math.PI * 200 * t);
  }
  return out;
}
function traffic(n) {
  // Brown rumble with slow swells (passing vehicles) and an occasional horn-like tone.
  const r = rng(2), out = new Float32Array(n);
  let b = 0;
  for (let i = 0; i < n; i++) {
    b = 0.995 * b + r() * 0.1;
    const t = i / SR;
    const swell = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.15 * t);
    const horn = (t % 4.3) > 3.9 ? 0.15 * Math.sign(Math.sin(2 * Math.PI * 420 * t)) : 0;
    out[i] = b * (0.4 + swell) + horn;
  }
  return out;
}
function tricycle(n) {
  // Two-stroke engine: ~45 Hz firing pulses with harmonics, rattle bursts, revving up and down.
  const r = rng(3), out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 40 + 15 * Math.sin(2 * Math.PI * 0.2 * t);
    phase += f / SR;
    const p = phase % 1;
    const pulse = Math.exp(-p * 18) * (1 + 0.5 * r());
    const rattle = (p < 0.15 ? 1 : 0.2) * r() * 0.6;
    out[i] = pulse * 0.8 + rattle;
  }
  return out;
}
async function babble(n) {
  // Other people talking (TV, neighbours): the hardest case for any denoiser.
  const src = await loadWav("babble.wav");
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = src[(i + 12345) % src.length];
  return out;
}

// ── Metrics ──
const db = (x) => 10 * Math.log10(Math.max(x, 1e-12));
function frames(x, size = 480) {
  const e = [];
  for (let i = 0; i + size <= x.length; i += size) {
    let s = 0;
    for (let k = i; k < i + size; k++) s += x[k] * x[k];
    e.push(s / size);
  }
  return e;
}
/** Speech-active / pause masks from the clean reference (per 10 ms frame). */
function masks(clean) {
  const e = frames(clean);
  const peak = Math.max(...e);
  return { speech: e.map((v) => db(v) > db(peak) - 30), pause: e.map((v) => db(v) < db(peak) - 55) };
}
function maskedPower(x, mask) {
  const e = frames(x);
  let s = 0, c = 0;
  mask.forEach((m, i) => { if (m && i < e.length) { s += e[i]; c++; } });
  return c ? s / c : 0;
}
/** Scale-invariant SDR over the speech-active part. */
function siSdr(ref, est, mask) {
  let dot = 0, rr = 0;
  const idx = [];
  mask.forEach((m, f) => { if (m) for (let k = f * 480; k < f * 480 + 480 && k < ref.length; k++) idx.push(k); });
  for (const k of idx) { dot += ref[k] * est[k]; rr += ref[k] * ref[k]; }
  const a = dot / rr;
  let s = 0, n = 0;
  for (const k of idx) { const t = a * ref[k]; s += t * t; n += (est[k] - t) ** 2; }
  return db(s / n);
}
function bestLag(ref, out, maxLag = 4096) {
  let best = 0, bc = -Infinity;
  for (let lag = 0; lag < maxLag; lag += 1) {
    let c = 0;
    for (let k = LEAD; k < ref.length - maxLag; k += 4) c += ref[k] * out[k + lag];
    if (c > bc) { bc = c; best = lag; }
  }
  return best;
}

// ── Rendering ──
let rnWasm, gtWasm, pkg;
async function init() {
  pkg ??= await import(`${PKG}/index.js`);
  rnWasm ??= await pkg.loadRnnoise({ url: `${PKG}/rnnoise.wasm`, simdUrl: `${PKG}/rnnoise_simd.wasm` });
  gtWasm ??= await pkg.loadGtcrn({ url: `${PKG}/gtcrn.wasm` });
}

/**
 * Renders `input` through a denoiser variant. Mirrors webEngine.ts: wet/dry crossfade with
 * the dry path delayed to match, so strength behaves exactly like the site.
 */
async function render(input, variant) {
  const off = new OfflineAudioContext(1, input.length, SR);
  const buf = off.createBuffer(1, input.length, SR);
  buf.copyToChannel(input, 0);
  const src = new AudioBufferSourceNode(off, { buffer: buf });
  if (variant.kind === "raw") {
    src.connect(off.destination);
  } else {
    let node;
    if (variant.kind === "rnnoise") {
      await off.audioWorklet.addModule(`${PKG}/rnnoise/workletProcessor.js`);
      node = new pkg.RnnoiseWorkletNode(off, { maxChannels: 1, wasmBinary: rnWasm.slice(0) });
    } else {
      await off.audioWorklet.addModule(`${PKG}/gtcrn/workletProcessor.js`);
      node = new pkg.GtcrnWorkletNode(off, { maxChannels: 1, wasmBinary: gtWasm.slice(0) });
    }
    const m = 1 - Math.pow(10, -variant.attenDb / 20);
    const wet = new GainNode(off, { gain: m });
    const dry = new GainNode(off, { gain: 1 - m });
    const delay = new DelayNode(off, { maxDelayTime: 0.2, delayTime: (variant.latency ?? 0) / SR });
    src.connect(node).connect(wet).connect(off.destination);
    src.connect(delay).connect(dry).connect(off.destination);
  }
  src.start();
  // WASM inside the worklets initialises asynchronously; pause until it's ready.
  off.suspend(128 / SR).then(() => setTimeout(() => off.resume(), 600));
  return (await off.startRendering()).getChannelData(0);
}

function mix(speech, noise, snrDb) {
  const n = speech.length + LEAD;
  const s = new Float32Array(n);
  s.set(speech, LEAD);
  const m = masks(s);
  const ps = maskedPower(s, m.speech);
  let pn = 0;
  for (let i = 0; i < n; i++) pn += noise[i] ** 2;
  pn /= n;
  const g = Math.sqrt(ps / pn / Math.pow(10, snrDb / 10));
  const noisy = new Float32Array(n);
  for (let i = 0; i < n; i++) noisy[i] = s[i] + g * noise[i];
  // Keep peaks sane (like a real mic input around -6 dBFS).
  let peak = 0;
  for (const v of noisy) peak = Math.max(peak, Math.abs(v));
  const k = 0.5 / peak;
  for (let i = 0; i < n; i++) { noisy[i] *= k; s[i] *= k; }
  return { clean: s, noisy, masks: m };
}

export async function run({ snrDb = 5, voices = ["speech_male.wav", "speech_female.wav"], variants } = {}) {
  await init();
  // Measure each denoiser's latency once, from a clean clip.
  const probe = await loadWav(voices[0]);
  const probeIn = new Float32Array(probe.length + LEAD); probeIn.set(probe, LEAD);
  const lat = {
    rnnoise: bestLag(probeIn, await render(probeIn, { kind: "rnnoise", attenDb: 100 })),
    gtcrn: bestLag(probeIn, await render(probeIn, { kind: "gtcrn", attenDb: 100 })),
  };
  variants ??= [
    { name: "No processing", kind: "raw" },
    { name: "RNNoise Light (12 dB)", kind: "rnnoise", attenDb: 12 },
    { name: "RNNoise Normal (24 dB)", kind: "rnnoise", attenDb: 24 },
    { name: "RNNoise Strong (100 dB)", kind: "rnnoise", attenDb: 100 },
    { name: "GTCRN Normal (24 dB)", kind: "gtcrn", attenDb: 24 },
    { name: "GTCRN Strong (100 dB)", kind: "gtcrn", attenDb: 100 },
  ];
  const noises = { fan, traffic, tricycle, babble };
  const rows = [];
  for (const voice of voices) {
    const speech = await loadWav(voice);
    for (const [noiseName, gen] of Object.entries(noises)) {
      const noise = await gen(speech.length + LEAD);
      const { clean, noisy, masks: m } = mix(speech, noise, snrDb);
      const rawPause = maskedPower(noisy, m.pause);
      const cleanSpeech = maskedPower(clean, m.speech);
      for (const v of variants) {
        const latency = v.kind === "raw" ? 0 : lat[v.kind];
        const out = await render(noisy, { ...v, latency });
        const aligned = out.subarray(latency, latency + clean.length);
        rows.push({
          voice: voice.replace("speech_", "").replace(".wav", ""),
          noise: noiseName,
          variant: v.name,
          noiseReductionDb: +(db(rawPause) - db(maskedPower(aligned, m.pause))).toFixed(1),
          siSdrDb: +siSdr(clean, aligned, m.speech).toFixed(1),
          voiceKeptDb: +(db(maskedPower(aligned, m.speech)) - db(cleanSpeech)).toFixed(1),
        });
      }
    }
  }
  return { snrDb, latencySamples: lat, rows };
}

/** Averages rows per variant (and per noise) for a compact summary. */
export function summarize(result) {
  const by = {};
  for (const r of result.rows) {
    const k = `${r.variant}`;
    (by[k] ??= []).push(r);
  }
  const avg = (a, f) => +(a.reduce((s, r) => s + r[f], 0) / a.length).toFixed(1);
  const perNoise = {};
  for (const r of result.rows) {
    const k = `${r.variant} | ${r.noise}`;
    (perNoise[k] ??= []).push(r);
  }
  return {
    latencyMs: Object.fromEntries(Object.entries(result.latencySamples).map(([k, v]) => [k, +(v / 48).toFixed(1)])),
    overall: Object.entries(by).map(([k, a]) => ({ variant: k, noiseReductionDb: avg(a, "noiseReductionDb"), siSdrDb: avg(a, "siSdrDb"), voiceKeptDb: avg(a, "voiceKeptDb") })),
    perNoise: Object.entries(perNoise).map(([k, a]) => ({ k, nr: avg(a, "noiseReductionDb"), sdr: avg(a, "siSdrDb") })),
  };
}

// Exposed for end-to-end tests that drive the real WebEngine.
export { loadWav, fan, traffic, tricycle, babble, mix, maskedPower, masks };

/**
 * Hum + bandwidth check: speech + 60 Hz mains hum (with harmonics) + a little hiss through
 * each denoiser. Reports hum left at 60/120/180/240 Hz and how much of the 8–16 kHz band
 * (crispness) survives on the clean speech alone.
 */
export async function humAndBandwidth() {
  await init();
  const speech = await loadWav("speech_male.wav");
  const n = speech.length + LEAD;
  const clean = new Float32Array(n);
  clean.set(speech, LEAD);
  const hum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    hum[i] = 0.02 * (Math.sin(2 * Math.PI * 60 * t) + 0.7 * Math.sin(2 * Math.PI * 120 * t) + 0.5 * Math.sin(2 * Math.PI * 180 * t) + 0.3 * Math.sin(2 * Math.PI * 240 * t));
  }
  const noisy = clean.map((v, i) => v * 0.5 + hum[i]);
  const tone = (x, f) => {
    // Goertzel power over the lead-in (noise only) segment.
    const w = (2 * Math.PI * f) / SR;
    let s1 = 0, s2 = 0;
    for (let i = 4800; i < LEAD; i++) { const s0 = x[i] + 2 * Math.cos(w) * s1 - s2; s2 = s1; s1 = s0; }
    return db((s1 * s1 + s2 * s2 - 2 * Math.cos(w) * s1 * s2) / (LEAD - 4800) ** 2);
  };
  const band = async (x, lo, hi) => {
    const off = new OfflineAudioContext(1, x.length, SR);
    const b = off.createBuffer(1, x.length, SR); b.copyToChannel(x, 0);
    const s = new AudioBufferSourceNode(off, { buffer: b });
    let node = s;
    for (const [type, f] of [["highpass", lo], ["highpass", lo], ["lowpass", hi], ["lowpass", hi]]) {
      const bq = new BiquadFilterNode(off, { type, frequency: f, Q: 0.7 }); node.connect(bq); node = bq;
    }
    node.connect(off.destination); s.start();
    const y = (await off.startRendering()).getChannelData(0);
    let e = 0; for (let i = LEAD; i < y.length; i++) e += y[i] * y[i];
    return db(e / (y.length - LEAD));
  };
  const out = {};
  for (const kind of ["raw", "rnnoise", "gtcrn"]) {
    const v = kind === "raw" ? { kind } : { kind, attenDb: 100, latency: 0 };
    const yHum = await render(noisy, v);
    const yClean = await render(clean, v);
    out[kind] = {
      humLeftDb: Object.fromEntries([60, 120, 180, 240].map((f) => [f, +(tone(yHum, f) - tone(noisy, f)).toFixed(1)])),
      crispness8to16kHzDb: +((await band(yClean, 8000, 16000)) - (await band(clean, 8000, 16000))).toFixed(1),
      body100to300HzDb: +((await band(yClean, 100, 300)) - (await band(clean, 100, 300))).toFixed(1),
    };
  }
  return out;
}
