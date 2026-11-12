// End-to-end check of the live web voice pipeline (denoiser → shifter → character → output).
// Plays the sample voices through the real WebEngine graph and measures the output with a second
// copy of the sanay-pitch analyser (pitch + apparent vocal-tract length).
//
// 1. `pnpm web:dev`, open http://localhost:5173
// 2. devtools console:
//      const t = await import('/@fs/C:/Sanay/tests/voice-e2e.js'); t.arm();
//    then click the "Run voice e2e" button that appears (audio needs a real click to start).
// 3. Results land in `window.__voiceE2E` (and the console) after ~3 minutes.

import { WebEngine } from "/audio/webEngine.ts";

const FILES = ["speech_male.wav", "speech_typical_man.wav", "speech_female.wav", "speech_typical_woman.wav"];
const PRESETS = ["natural", "masculine", "feminine"];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadBuffer(ctx, name) {
  const r = await fetch(`/@fs/C:/Sanay/tests/audio_samples/${name}`);
  return ctx.decodeAudioData(await r.arrayBuffer());
}

/** Plays `buf` through the engine with `preset`; returns the engine's and the output's analysis. */
async function measure(engine, buf, preset) {
  const ctx = engine.ctx;
  const probe = new AudioWorkletNode(ctx, "sanay-pitch", { numberOfOutputs: 0 });
  engine.cleanAnalyser.connect(probe);
  let out = null;
  probe.port.onmessage = (m) => {
    if (m.data.type === "f0") out = m.data;
  };
  engine.setVoice(preset, 1);
  const src = new AudioBufferSourceNode(ctx, { buffer: buf });
  engine.useSource(src);
  src.start();
  await wait(buf.duration * 1000 + 600);
  src.disconnect();
  engine.cleanAnalyser.disconnect(probe);
  return {
    preset,
    inF0: Math.round(engine.speakerPitch ?? 0),
    inVtl: +(engine.speakerVocalTract ?? 0).toFixed(1),
    outF0: Math.round(out?.median ?? 0),
    outVtl: +(out?.vtl ?? 0).toFixed(1),
  };
}

export async function run() {
  const results = [];
  for (const file of FILES) {
    // Fresh engine per voice, so the speaker analysis starts from scratch.
    const engine = await WebEngine.create();
    await engine.ctx.resume();
    engine.setNc(true);
    const buf = await loadBuffer(engine.ctx, file);
    for (const preset of PRESETS) {
      const r = { file, ...(await measure(engine, buf, preset)) };
      console.log("[voice-e2e]", JSON.stringify(r));
      results.push(r);
    }
    await engine.close();
  }
  window.__voiceE2E = results;
  console.table(results);
  return results;
}

/** Adds a button; the click is the user gesture the AudioContext needs. */
export function arm() {
  const b = document.createElement("button");
  b.textContent = "Run voice e2e";
  b.id = "voice-e2e";
  b.style.cssText = "position:fixed;top:8px;right:8px;z-index:9999;padding:12px 16px;background:#0d9488;color:#fff;border-radius:8px";
  b.onclick = () => {
    b.textContent = "Running…";
    window.__voiceE2E = "running";
    run().then(
      () => (b.textContent = "Done"),
      (e) => {
        window.__voiceE2E = "error: " + e;
        b.textContent = "Error";
        console.error("[voice-e2e]", e);
      },
    );
  };
  document.body.appendChild(b);
}
