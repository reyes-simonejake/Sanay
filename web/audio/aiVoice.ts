// AI voice preview (personal testing build): converts a recorded clip with the local Sanay voice
// server (D:\dev\SanayAI\scripts\sanay_voice_server.py). The dev server proxies /ai to
// http://127.0.0.1:47821, so this only works on `pnpm web:dev` on the same computer as the voice
// server; anywhere else aiStatus() returns null and the UI hides the AI buttons.
// The server converts with the same live path as calls (100 ms blocks), so the result is what the
// other person would hear.

export type AiVoice = "masculine" | "feminine";

export interface AiServerStatus {
  voices: Record<AiVoice, { ready: boolean }>;
  busy: boolean;
}

export interface AiResult {
  audio: Float32Array; // 48 kHz mono, ready for WebEngine.play
  info: { your_pitch_hz: number; target_pitch_hz: number; block_ms_mean: number; realtime_ok: boolean; device: string };
}

export async function aiStatus(): Promise<AiServerStatus | null> {
  try {
    const r = await fetch("/ai/status", { signal: AbortSignal.timeout(1500), cache: "no-store" });
    if (!r.ok || !r.headers.get("content-type")?.includes("json")) return null;
    return (await r.json()) as AiServerStatus;
  } catch {
    return null;
  }
}

async function resample(x: Float32Array, from: number, to: number): Promise<Float32Array> {
  const src = new AudioBuffer({ length: x.length, sampleRate: from, numberOfChannels: 1 });
  src.copyToChannel(new Float32Array(x), 0);
  const off = new OfflineAudioContext(1, Math.ceil((x.length * to) / from), to);
  const node = off.createBufferSource();
  node.buffer = src;
  node.connect(off.destination);
  node.start();
  return (await off.startRendering()).getChannelData(0);
}

/** `clip`: 48 kHz mono (the cleaned recording). Throws with the server's message on failure. */
export async function aiConvert(clip: Float32Array, voice: AiVoice, sampleRate = 48_000): Promise<AiResult> {
  const x16 = await resample(clip, sampleRate, 16_000);
  const r = await fetch(`/ai/convert?voice=${voice}`, { method: "POST", body: x16.slice().buffer });
  if (!r.ok) throw new Error((await r.text()) || `voice server error ${r.status}`);
  const info = JSON.parse(r.headers.get("X-Info") || "{}");
  const ctx = new OfflineAudioContext(1, 1, sampleRate);
  const decoded = await ctx.decodeAudioData(await r.arrayBuffer()); // resampled to 48 kHz by the browser
  return { audio: decoded.getChannelData(0).slice(), info };
}
