// AudioWorklet: speaker analysis (mirrors src-tauri/src/audio/pitch.rs). Output is silent.
// On a 12 kHz copy, 40 ms window, 10 ms hop:
// * pitch (YIN): median F0 of the last ~3 s of voiced speech;
// * apparent vocal-tract length (VTL, cm) from formant dispersion: 12th-order LPC roots of a
//   25 ms pre-emphasised frame, least-squares fit of F1..F4 against (2i-1)/2 → spacing dF,
//   L = c / (2 dF). Men ~17–18 cm, women ~14–15 cm.
// Posts {type: "f0", median, vtl} every 0.5 s once ~0.2 s of voiced speech has been heard.

const DECIM = 4;
const RATE = sampleRate / DECIM;
const WIN = Math.round(RATE * 0.04);
const HOP = Math.round(RATE * 0.01);
const TAU_MIN = Math.floor(RATE / 400);
const TAU_MAX = Math.ceil(RATE / 60);
const THRESHOLD = 0.2;
const HISTORY = 300;
const MIN_VOICED = 20;
const MIN_RMS = 0.005; // ≈ -46 dBFS
const LPC_ORDER = 12;
const LPC_WIN = Math.round(RATE * 0.025);
const SPEED_OF_SOUND_CM = 35000;

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[s.length >> 1];
};

/** LPC a[0..order] (a[0] = 1) by autocorrelation + Levinson–Durbin, or null. */
function lpc(x, order) {
  const r = new Float64Array(order + 1);
  for (let l = 0; l <= order; l++) {
    let s = 0;
    for (let i = 0; i < x.length - l; i++) s += x[i] * x[i + l];
    r[l] = s;
  }
  if (r[0] <= 1e-12) return null;
  let a = new Float64Array(order + 1);
  a[0] = 1;
  let e = r[0];
  for (let i = 1; i <= order; i++) {
    let acc = r[i];
    for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
    const k = -acc / e;
    const prev = a.slice();
    for (let j = 1; j < i; j++) a[j] = prev[j] + k * prev[i - j];
    a[i] = k;
    e *= 1 - k * k;
    if (e <= 0) return null;
  }
  return a;
}

/** Roots of a[0] z^n + … + a[n] (Durand–Kerner) as [re, im] pairs. */
function polyRoots(a) {
  const n = a.length - 1;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const t = (2 * Math.PI * k) / n + 0.4;
    re[k] = 0.9 * Math.cos(t);
    im[k] = 0.9 * Math.sin(t);
  }
  for (let it = 0; it < 200; it++) {
    let moved = 0;
    for (let i = 0; i < n; i++) {
      // p(z_i)
      let pr = 0, pi = 0;
      for (let c = 0; c <= n; c++) {
        const tr = pr * re[i] - pi * im[i];
        pi = pr * im[i] + pi * re[i];
        pr = tr + a[c];
      }
      // a0 · Π (z_i − z_j)
      let dr = a[0], di = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const xr = re[i] - re[j], xi = im[i] - im[j];
        const tr = dr * xr - di * xi;
        di = dr * xi + di * xr;
        dr = tr;
      }
      const dd = dr * dr + di * di;
      const sr = (pr * dr + pi * di) / dd, si = (pi * dr - pr * di) / dd;
      re[i] -= sr;
      im[i] -= si;
      moved = Math.max(moved, Math.abs(sr) + Math.abs(si));
    }
    if (moved < 1e-10) break;
  }
  return { re, im };
}

/** Formant spacing dF (Hz) of a voiced 12 kHz frame, or 0 if < 4 clear formants. */
function formantSpacing(frame) {
  const n = frame.length;
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const pre = frame[i] - (i > 0 ? 0.97 * frame[i - 1] : 0);
    x[i] = pre * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  const a = lpc(x, LPC_ORDER);
  if (!a) return 0;
  const { re, im } = polyRoots(a);
  const f = [];
  for (let k = 0; k < re.length; k++) {
    if (im[k] <= 0) continue;
    const hz = (Math.atan2(im[k], re[k]) * RATE) / (2 * Math.PI);
    const bw = (-Math.log(Math.hypot(re[k], im[k])) * RATE) / Math.PI;
    if (hz > 200 && hz < 4800 && bw < 500) f.push(hz);
  }
  if (f.length < 4) return 0;
  f.sort((p, q) => p - q);
  let num = 0, den = 0;
  for (let i = 0; i < 4; i++) {
    const k = (2 * i + 1) / 2;
    num += f[i] * k;
    den += k * k;
  }
  return num / den;
}

class SanayPitch extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(WIN + TAU_MAX);
    this.filled = 0;
    this.acc = 0;
    this.accN = 0;
    this.sinceHop = 0;
    this.diff = new Float32Array(TAU_MAX + 1);
    this.voiced = [];
    this.spacing = [];
    this.sincePost = 0;
  }

  analyse() {
    const y = this.buf;
    let sq = 0;
    for (let k = 0; k < WIN; k++) sq += y[k] * y[k];
    if (Math.sqrt(sq / WIN) < MIN_RMS) return 0;
    const d = this.diff;
    for (let tau = 1; tau <= TAU_MAX; tau++) {
      let s = 0;
      for (let k = 0; k < WIN; k++) {
        const v = y[k] - y[k + tau];
        s += v * v;
      }
      d[tau] = s;
    }
    let running = 0;
    for (let tau = 1; tau <= TAU_MAX; tau++) {
      running += d[tau];
      if (tau >= TAU_MIN && (d[tau] * tau) / (running || 1e-12) < THRESHOLD) {
        let t = tau;
        while (t < TAU_MAX && d[t + 1] < d[t]) t++;
        return RATE / t;
      }
    }
    return 0;
  }

  process(inputs) {
    const x = inputs[0]?.[0];
    if (!x) return true;
    for (let i = 0; i < x.length; i++) {
      this.acc += x[i];
      if (++this.accN < DECIM) continue;
      const v = this.acc / DECIM;
      this.acc = 0;
      this.accN = 0;
      // Shift the window left by one and append (window is small: ~680 samples).
      this.buf.copyWithin(0, 1);
      this.buf[this.buf.length - 1] = v;
      if (this.filled < this.buf.length) this.filled++;
      if (++this.sinceHop >= HOP && this.filled === this.buf.length) {
        this.sinceHop = 0;
        const f = this.analyse();
        if (f > 0) {
          this.voiced.push(f);
          if (this.voiced.length > HISTORY) this.voiced.shift();
          const dF = formantSpacing(this.buf.subarray(0, LPC_WIN));
          if (dF > 0) {
            this.spacing.push(dF);
            if (this.spacing.length > HISTORY) this.spacing.shift();
          }
        }
      }
    }
    this.sincePost += x.length;
    if (this.sincePost >= sampleRate / 2 && this.voiced.length >= MIN_VOICED) {
      this.sincePost = 0;
      const vtl = this.spacing.length >= MIN_VOICED ? SPEED_OF_SOUND_CM / (2 * median(this.spacing)) : 0;
      this.port.postMessage({ type: "f0", median: median(this.voiced), vtl });
    }
    return true;
  }
}

registerProcessor("sanay-pitch", SanayPitch);
