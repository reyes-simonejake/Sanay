// AudioWorklet: hum / rumble pre-filter (mirrors HumRemover in src-tauri/src/audio/cleanup.rs).
// Listens to unbroken pauses, detects mains hum (50 or 60 Hz + harmonics) and engages narrow
// notches (~4 Hz wide) on 8 harmonics, plus a 70 Hz high-pass for rumble. Runs before the
// denoiser. Posts {type: "hum", hz} when detection changes.

const HARMONICS = 8;
const ANALYSIS = 12000; // 0.25 s at 48 kHz → 4 Hz resolution
const dbOf = (lin) => 20 * Math.log10(Math.max(lin, 1e-12));

class Biquad {
  constructor(b0, b1, b2, a0, a1, a2) {
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    this.z1 = 0; this.z2 = 0;
  }
  tick(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}
const highPass = (f, q) => {
  const w = (2 * Math.PI * f) / sampleRate, al = Math.sin(w) / (2 * q), c = Math.cos(w);
  return new Biquad((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al);
};
const notch = (f, q) => {
  const w = (2 * Math.PI * f) / sampleRate, al = Math.sin(w) / (2 * q), c = Math.cos(w);
  return new Biquad(1, -2 * c, 1, 1 + al, -2 * c, 1 - al);
};

/** Hann-windowed Goertzel power. */
function goertzel(x, f) {
  const w = (2 * Math.PI * f) / sampleRate, c = 2 * Math.cos(w), n = x.length;
  let s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    const v = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
    const s0 = v + c * s1 - s2;
    s2 = s1; s1 = s0;
  }
  return (s1 * s1 + s2 * s2 - c * s1 * s2) / (n * n);
}

function score(x, mains) {
  let k = 0;
  for (let h = 1; h <= 4; h++) {
    const f = mains * h;
    const p = dbOf(Math.sqrt(goertzel(x, f)));
    const n = dbOf(Math.sqrt((goertzel(x, f - 12) + goertzel(x, f + 12)) / 2));
    if (p - n >= 8 && p > -95) k++;
  }
  return k;
}

class SanayPrefilter extends AudioWorkletProcessor {
  constructor() {
    super();
    this.enabled = true;
    this.rumble = highPass(70, Math.SQRT1_2);
    this.notches = [];
    this.mains = 0;
    this.quiet = new Float32Array(ANALYSIS);
    this.qLen = 0;
    this.level = null;
    this.floor = null;
    this.hits = 0;
    this.misses = 0;
    this.port.onmessage = (e) => {
      if (e.data.type === "enabled") this.enabled = e.data.enabled;
    };
  }

  analyse() {
    const s50 = score(this.quiet, 50), s60 = score(this.quiet, 60);
    const found = s60 >= 2 && s60 >= s50 ? 60 : s50 >= 2 ? 50 : 0;
    if (found) {
      this.misses = 0;
      if (++this.hits >= 3 && this.mains !== found) {
        this.mains = found;
        this.notches = Array.from({ length: HARMONICS }, (_, i) => notch(found * (i + 1), (found * (i + 1)) / 4));
        this.port.postMessage({ type: "hum", hz: found });
      }
    } else {
      this.hits = 0;
      if (++this.misses >= 20 && this.mains) {
        this.mains = 0;
        this.notches = [];
        this.port.postMessage({ type: "hum", hz: 0 });
      }
    }
    this.qLen = 0;
  }

  process(inputs, outputs) {
    const x = inputs[0]?.[0];
    const out = outputs[0][0];
    if (!x) {
      out.fill(0);
      return true;
    }
    if (!this.enabled) {
      out.set(x);
      return true;
    }
    // Smoothed level (~50 ms) vs background floor decides what is an unbroken pause.
    let sq = 0;
    for (let i = 0; i < x.length; i++) sq += x[i] * x[i];
    const now = dbOf(Math.sqrt(sq / x.length));
    const k = 1 - Math.pow(0.8, x.length / 480);
    this.level = this.level === null ? now : this.level + k * (now - this.level);
    const step = x.length / 480;
    if (this.floor === null) this.floor = this.level;
    else if (this.level < this.floor) this.floor += (1 - Math.pow(0.7, step)) * (this.level - this.floor);
    else this.floor = Math.min(this.floor + 0.1 * step, this.level);
    if (this.level < this.floor + 8) {
      const n = Math.min(x.length, ANALYSIS - this.qLen);
      this.quiet.set(x.subarray(0, n), this.qLen);
      this.qLen += n;
      if (this.qLen >= ANALYSIS) this.analyse();
    } else {
      this.qLen = 0; // speech: start a fresh stretch
    }
    for (let i = 0; i < x.length; i++) {
      let y = this.rumble.tick(x[i]);
      for (let j = 0; j < this.notches.length; j++) y = this.notches[j].tick(y);
      out[i] = y;
    }
    return true;
  }
}

registerProcessor("sanay-prefilter", SanayPrefilter);
