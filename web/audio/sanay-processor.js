// AudioWorklet: Sanay's post-denoise chain, ported from src-tauri/src/audio/dsp.rs and
// src-tauri/src/audio/character.rs.
//
// Input 0: raw mic (mono)                         → measured, recorded as "raw"
// Input 1: denoised + HPF + voice pitch nudge     → voice character (EQ, de-esser, compressor)
//                                                   → AGC → limiter → output ("clean")
//
// Runs at 48 kHz in 128-sample render quanta. The Rust AGC adapts per 480-sample frame;
// coefficients are rescaled so the behaviour matches.

const dbToLin = (db) => Math.pow(10, db / 20);
const linToDb = (lin) => 20 * Math.log10(Math.max(lin, 1e-9));
const rescale = (c, n) => 1 - Math.pow(1 - c, n / 480);

// ── Voice character: professional EQ, de-esser, gentle compressor (see character.rs) ──

class Biquad {
  constructor() {
    this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.z1 = 0; this.z2 = 0;
  }
  set(b0, b1, b2, a0, a1, a2) {
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  peaking(f, q, g) {
    const A = Math.pow(10, g / 40), w = (2 * Math.PI * f) / sampleRate, al = Math.sin(w) / (2 * q), c = Math.cos(w);
    return this.set(1 + al * A, -2 * c, 1 - al * A, 1 + al / A, -2 * c, 1 - al / A);
  }
  lowShelf(f, g) {
    const A = Math.pow(10, g / 40), w = (2 * Math.PI * f) / sampleRate, c = Math.cos(w);
    const k = 2 * Math.sqrt(A) * (Math.sin(w) / 2) * Math.SQRT2;
    return this.set(A * (A + 1 - (A - 1) * c + k), 2 * A * (A - 1 - (A + 1) * c), A * (A + 1 - (A - 1) * c - k),
      A + 1 + (A - 1) * c + k, -2 * (A - 1 + (A + 1) * c), A + 1 + (A - 1) * c - k);
  }
  highShelf(f, g) {
    const A = Math.pow(10, g / 40), w = (2 * Math.PI * f) / sampleRate, c = Math.cos(w);
    const k = 2 * Math.sqrt(A) * (Math.sin(w) / 2) * Math.SQRT2;
    return this.set(A * (A + 1 + (A - 1) * c + k), -2 * A * (A - 1 + (A + 1) * c), A * (A + 1 + (A - 1) * c - k),
      A + 1 - (A - 1) * c + k, 2 * (A - 1 - (A + 1) * c), A + 1 - (A - 1) * c - k);
  }
  highPass(f, q) {
    const w = (2 * Math.PI * f) / sampleRate, al = Math.sin(w) / (2 * q), c = Math.cos(w);
    return this.set((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al);
  }
  tick(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

// Bands at full amount: [kind, freq, q, gainDb]
const CHARACTER = {
  // Masculine: crisp (−boxiness, +presence, +air, strong de-essing) on a deep ~102 Hz voice
  masculine: { bands: [["peak", 250, 1, -2], ["peak", 4500, 0.9, 3], ["high", 10000, 0, 2.5]], deessHz: 7000, deessDb: 9 },
  // Clarity boost for the natural voice: de-mud, presence, a little air
  clear: { bands: [["peak", 300, 1, -2], ["peak", 3200, 1, 2.5], ["high", 9000, 0, 1.5]], deessHz: 6800, deessDb: 6 },
  // Feminine: light (low cut below 150 Hz: no "grounded" rumble, +presence, +air) on a ~200 Hz voice
  feminine: { bands: [["low", 150, 0, -6], ["peak", 3200, 1, 2.5], ["high", 10000, 0, 3]], deessHz: 7000, deessDb: 8 },
};

class Character {
  constructor() {
    this.voice = "natural";
    this.eq = [new Biquad(), new Biquad(), new Biquad()];
    // De-esser: dynamic high shelf driven by a high-band detector.
    this.det = new Biquad();
    this.shelf = new Biquad();
    this.deessHz = 7000;
    this.deessMax = 0;
    this.deessEnv = 0;
    this.deessAtk = Math.exp(-1 / (0.001 * sampleRate));
    this.deessRel = Math.exp(-1 / (0.06 * sampleRate));
    this.deessApplied = 0;
    this.counter = 0;
    // Compressor on an RMS-style detector.
    this.thr = -24;
    this.ratio = 1;
    this.knee = 8;
    this.cAtk = Math.exp(-1 / (0.01 * sampleRate));
    this.cRel = Math.exp(-1 / (0.15 * sampleRate));
    this.power = 0;
  }

  configure(voice, amount) {
    this.voice = voice;
    const p = CHARACTER[voice];
    if (!p) return;
    const a = Math.max(0, Math.min(1, amount));
    p.bands.forEach(([kind, f, q, g], i) => {
      const b = this.eq[i];
      if (kind === "low") b.lowShelf(f, g * a);
      else if (kind === "high") b.highShelf(f, g * a);
      else b.peaking(f, q, g * a);
    });
    this.deessHz = p.deessHz;
    this.det.highPass(p.deessHz, Math.SQRT1_2);
    this.shelf.highShelf(p.deessHz, -this.deessApplied);
    this.deessMax = p.deessDb * a;
    this.ratio = 1 + a; // up to 2:1
  }

  process(buf, n) {
    if (this.voice === "natural") return;
    for (let i = 0; i < n; i++) {
      let y = buf[i];
      for (let k = 0; k < 3; k++) y = this.eq[k].tick(y);
      // De-esser
      const h = Math.abs(this.det.tick(y));
      this.deessEnv = h + (h > this.deessEnv ? this.deessAtk : this.deessRel) * (this.deessEnv - h);
      if (++this.counter >= 16) {
        this.counter = 0;
        const over = linToDb(this.deessEnv) + 30;
        const red = this.deessMax > 0 ? Math.max(0, Math.min(this.deessMax, over * 0.6)) : 0;
        if (Math.abs(red - this.deessApplied) > 0.1) {
          this.shelf.highShelf(this.deessHz, -red);
          this.deessApplied = red;
        }
      }
      y = this.shelf.tick(y);
      // Compressor
      const pw = y * y;
      this.power = pw + (pw > this.power ? this.cAtk : this.cRel) * (this.power - pw);
      const over = 10 * Math.log10(Math.max(this.power, 1e-12)) - this.thr;
      let gr = 0;
      if (over >= this.knee / 2) gr = over * (1 - 1 / this.ratio);
      else if (over > -this.knee / 2) {
        const t = over + this.knee / 2;
        gr = ((1 - 1 / this.ratio) * t * t) / (2 * this.knee);
      }
      buf[i] = y * dbToLin(-gr);
    }
  }
}

class SanayProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // AGC (target -18 dBFS, gate -45 dBFS, gain -12..+18 dB)
    this.target = -18;
    this.gate = -45;
    // Speech must stand this far above the background; the floor falls fast, rises slowly.
    this.speechMargin = 10;
    this.floor = null;
    this.minGain = -12;
    this.maxGain = 18;
    this.level = -18;
    this.gain = 1;
    this.agcOn = true;
    // Limiter (ceiling -1 dBFS, 60 ms release)
    this.ceiling = dbToLin(-1);
    this.env = 0;
    this.release = Math.exp(-1 / (0.06 * sampleRate));
    // Meters, posted every ~50 ms
    this.acc = { rawSq: 0, rawPeak: 0, cleanSq: 0, cleanPeak: 0, n: 0 };
    // Recording
    this.rec = null;
    // Voice character (natural = bypass)
    this.character = new Character();
    // Pause cleanup (downward expander), mirrors Expander in cleanup.rs
    this.expDepth = 0;
    this.expFloor = null;
    this.expOpen = true;
    this.expHold = 0;
    this.expGain = 1;
    this.scratch = new Float32Array(128);

    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === "record") {
        this.rec = { raw: new Float32Array(m.samples), clean: new Float32Array(m.samples), pos: 0 };
      } else if (m.type === "recordStop") {
        if (this.rec) this.finishRecording(this.rec.pos);
      } else if (m.type === "agc") {
        this.agcOn = m.enabled;
      } else if (m.type === "character") {
        this.character.configure(m.voice, m.amount);
      } else if (m.type === "expander") {
        this.expDepth = m.depthDb;
      }
    };
  }

  /** Pause cleanup: ease the background down by expDepth dB between words. */
  expand(buf, n) {
    let sq = 0;
    for (let i = 0; i < n; i++) sq += buf[i] * buf[i];
    const db = linToDb(Math.sqrt(sq / n));
    const step = n / 480;
    if (this.expFloor === null) this.expFloor = db;
    else if (db < this.expFloor) this.expFloor += (1 - Math.pow(0.7, step)) * (db - this.expFloor);
    else this.expFloor = Math.min(this.expFloor + 0.1 * step, db);
    if (db > this.expFloor + 8) {
      this.expOpen = true;
      this.expHold = Math.round((0.2 * sampleRate) / n);
    } else if (db < this.expFloor + 4) {
      if (this.expHold > 0) this.expHold--;
      else this.expOpen = false;
    }
    const target = this.expOpen || this.expDepth <= 0 ? 1 : dbToLin(-this.expDepth);
    const k = target > this.expGain ? 1 - Math.exp(-1 / (0.005 * sampleRate)) : 1 - Math.exp(-1 / (0.08 * sampleRate));
    for (let i = 0; i < n; i++) {
      this.expGain += k * (target - this.expGain);
      buf[i] *= this.expGain;
    }
  }

  /** Sends the first `len` samples of the recording to the page (stop early or full). */
  finishRecording(len) {
    const rec = this.rec;
    this.rec = null;
    const raw = rec.raw.slice(0, len), clean = rec.clean.slice(0, len);
    this.port.postMessage({ type: "recorded", raw, clean }, [raw.buffer, clean.buffer]);
  }

  process(inputs, outputs) {
    const raw = inputs[0]?.[0];
    let pre = inputs[1]?.[0];
    const out = outputs[0][0];
    const n = out.length;

    if (pre && (this.character.voice !== "natural" || this.expDepth > 0)) {
      if (this.scratch.length < n) this.scratch = new Float32Array(n);
      this.scratch.set(pre.subarray(0, n));
      this.character.process(this.scratch, n);
      this.expand(this.scratch, n);
      pre = this.scratch;
    }

    if (!pre) {
      out.fill(0);
    } else {
      // AGC: adapt only on frames loud enough to be speech.
      let sq = 0;
      for (let i = 0; i < n; i++) sq += pre[i] * pre[i];
      const frameDb = linToDb(Math.sqrt(sq / n));
      if (this.floor === null) this.floor = frameDb;
      else if (frameDb < this.floor) this.floor += rescale(0.3, n) * (frameDb - this.floor);
      else this.floor = Math.min(this.floor + 0.1 * (n / 480), frameDb); // 10 dB/s
      if (this.agcOn && frameDb > Math.max(this.gate, this.floor + this.speechMargin)) {
        const c = frameDb > this.level ? rescale(0.25, n) : rescale(0.03, n);
        this.level += c * (frameDb - this.level);
      }
      const want = this.agcOn
        ? dbToLin(Math.min(this.maxGain, Math.max(this.minGain, this.target - this.level)))
        : 1;
      const step = (want - this.gain) / n;
      const c = this.ceiling;
      for (let i = 0; i < n; i++) {
        this.gain += step;
        let x = pre[i] * this.gain;
        const a = Math.abs(x);
        this.env = a > this.env ? a : a + this.release * (this.env - a);
        if (this.env > c) x *= c / this.env;
        out[i] = c * Math.tanh(x / c);
      }
    }

    // Meters
    const acc = this.acc;
    for (let i = 0; i < n; i++) {
      const r = raw ? raw[i] : 0;
      const o = out[i];
      acc.rawSq += r * r;
      acc.cleanSq += o * o;
      if (Math.abs(r) > acc.rawPeak) acc.rawPeak = Math.abs(r);
      if (Math.abs(o) > acc.cleanPeak) acc.cleanPeak = Math.abs(o);
    }
    acc.n += n;
    if (acc.n >= 2400) {
      this.port.postMessage({
        type: "levels",
        input: { rmsDb: linToDb(Math.sqrt(acc.rawSq / acc.n)), peakDb: linToDb(acc.rawPeak) },
        output: { rmsDb: linToDb(Math.sqrt(acc.cleanSq / acc.n)), peakDb: linToDb(acc.cleanPeak) },
      });
      this.acc = { rawSq: 0, rawPeak: 0, cleanSq: 0, cleanPeak: 0, n: 0 };
    }

    // Recording (memory only; transferred to the page when full)
    const rec = this.rec;
    if (rec) {
      const k = Math.min(n, rec.raw.length - rec.pos);
      if (raw) rec.raw.set(raw.subarray(0, k), rec.pos);
      rec.clean.set(out.subarray(0, k), rec.pos);
      rec.pos += k;
      if (rec.pos >= rec.raw.length) this.finishRecording(rec.pos);
    }
    return true;
  }
}

registerProcessor("sanay-processor", SanayProcessor);
