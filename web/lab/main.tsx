// Voice Lab: listen to masculine / feminine variants side by side (dev only).
import React, { useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import "../web.css";
import { loadSample, score, SR, VARIANTS, type Score } from "./voiceLab";

type VoiceKind = "masculine" | "feminine";
interface Rendered {
  key: string;
  label: string;
  audio: Float32Array;
  score?: Score;
}

let ctx: AudioContext | null = null;
let playing: AudioBufferSourceNode | null = null;

function play(x: Float32Array) {
  ctx ??= new AudioContext({ sampleRate: SR });
  playing?.stop();
  const b = ctx.createBuffer(1, x.length, SR);
  b.copyToChannel(x as Float32Array<ArrayBuffer>, 0);
  const s = new AudioBufferSourceNode(ctx, { buffer: b });
  s.connect(ctx.destination);
  s.start();
  playing = s;
}

async function recordVoice(seconds: number): Promise<Float32Array> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true },
  });
  const rc = new AudioContext({ sampleRate: SR });
  const src = rc.createMediaStreamSource(stream);
  const proc = rc.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  proc.onaudioprocess = (e) => chunks.push(e.inputBuffer.getChannelData(0).slice());
  src.connect(proc);
  proc.connect(rc.destination);
  await new Promise((r) => setTimeout(r, seconds * 1000));
  stream.getTracks().forEach((t) => t.stop());
  await rc.close();
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  // Normalise to -3 dBFS peak.
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] *= 0.7 / peak;
  return out;
}

function Lab() {
  const [source, setSource] = useState<{ name: string; audio: Float32Array } | null>(null);
  const [voice, setVoice] = useState<VoiceKind>("feminine");
  const [amount, setAmount] = useState(1);
  const [rows, setRows] = useState<Rendered[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const runId = useRef(0);

  const pick = async (name: string, get: () => Promise<Float32Array>) => {
    setBusy(name === "your voice" ? "Recording 8 seconds — read a sentence aloud…" : "Loading…");
    try {
      setSource({ name, audio: await get() });
      setRows([]);
    } finally {
      setBusy(null);
    }
  };

  const renderAll = async () => {
    if (!source) return;
    const id = ++runId.current;
    setRows([]);
    const out: Rendered[] = [];
    for (const v of VARIANTS) {
      setBusy(`Rendering ${v.name}…`);
      const { audio, score: sc } = await score(source.audio, v, voice, amount);
      if (id !== runId.current) return;
      out.push({ key: v.id, label: v.name, audio, score: sc });
      setRows([...out]);
    }
    setBusy(null);
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Sanay Voice Lab</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Compare masculine / feminine versions by ear. <b>Round-trip distance</b>: the voice is shifted and shifted back;
          lower means fewer artifacts. Use headphones.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <h2 className="font-semibold">1. Voice to test</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => pick("test voice (male)", () => loadSample("speech_male.wav"))}>
            Test voice: male
          </button>
          <button className="btn" onClick={() => pick("test voice (female)", () => loadSample("speech_female.wav"))}>
            Test voice: female
          </button>
          <button className="btn btn-primary" onClick={() => pick("your voice", () => recordVoice(8))}>
            🎙 Record my voice (8 s)
          </button>
        </div>
        {source && (
          <div className="flex items-center gap-3 text-sm">
            <span>
              Using: <b>{source.name}</b> ({(source.audio.length / SR).toFixed(1)} s)
            </span>
            <button className="btn" onClick={() => play(source.audio)}>
              ▶ Original
            </button>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <h2 className="font-semibold">2. Voice type</h2>
        <div className="flex gap-2">
          {(["masculine", "feminine"] as const).map((v) => (
            <button key={v} className={`btn ${voice === v ? "btn-primary" : ""}`} onClick={() => setVoice(v)}>
              {v}
            </button>
          ))}
        </div>
        <label className="block text-sm">
          Amount: {Math.round(amount * 100)}%
          <input type="range" min={0.2} max={1} step={0.05} value={amount} onChange={(e) => setAmount(+e.target.value)} className="w-full accent-teal-600" />
        </label>
        <button className="btn btn-primary" disabled={!source || !!busy} onClick={renderAll}>
          Render all versions
        </button>
        {busy && <p className="text-sm text-slate-600">{busy}</p>}
      </section>

      {rows.length > 0 && (
        <section className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <h2 className="font-semibold">3. Listen</h2>
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1">Version</th>
                <th>Pitch</th>
                <th>Round-trip ↓</th>
                <th>Delay</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="py-2 pr-2">{r.label}</td>
                  <td>
                    {r.score?.srcF0}→{r.score?.outF0} Hz
                    <div className="text-xs text-slate-500">{r.score?.semis} st</div>
                  </td>
                  <td>{r.score?.roundTripLsd ? `${r.score.roundTripLsd} dB` : "—"}</td>
                  <td>{r.score?.latencyMs} ms</td>
                  <td>
                    <button className="btn" onClick={() => play(r.audio)}>
                      ▶ Play
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

const style = document.createElement("style");
style.textContent = `.btn{border:1px solid rgb(203 213 225);border-radius:.75rem;padding:.5rem .9rem;font-weight:500}
.btn:disabled{opacity:.5}.btn-primary{background:#0d9488;color:#fff;border-color:#0d9488}`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Lab />
  </React.StrictMode>,
);
