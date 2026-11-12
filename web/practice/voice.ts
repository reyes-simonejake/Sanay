// Voice for practice: the interviewer speaks with the computer's built-in voices, and each answer is
// heard three ways at once: Chrome's speech recognition (the words), a level meter (pauses, when you
// started, when you stopped) and a recorder (so you can replay it). Nothing is uploaded except the
// audio Chrome's speech recognition sends to Google.

export type PartnerVoice = "masculine" | "feminine";

/* ---------- Speaking ---------- */

const FEMALE = /(female|woman|zira|aria|jenny|samantha|susan|hazel|libby|sonia|rosa|natasha|karen|moira|tessa|google us english)/i;
const MALE = /(male|man\b|david|mark|guy|james|george|ryan|daniel|alex|fred|google uk english male)/i;

/** The list of voices. Chrome loads it a moment after the page; wait for it only once. */
let voicesWaited: Promise<SpeechSynthesisVoice[]> | null = null;
function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  voicesWaited ??= new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener("voiceschanged", done, { once: true });
    window.setTimeout(done, 1500);
  });
  // Later calls read the list again (it may have arrived), without waiting a second time.
  return voicesWaited.then(() => synth.getVoices());
}

async function pickVoice(kind: PartnerVoice) {
  const english = (await voicesReady()).filter((v) => v.lang.toLowerCase().startsWith("en"));
  // Prefer a Philippine English voice, then US, then any English.
  const rank = (v: SpeechSynthesisVoice) => (v.lang === "en-PH" ? 0 : v.lang === "en-US" ? 1 : 2);
  const wanted = english.filter((v) => (kind === "feminine" ? FEMALE.test(v.name) && !/\bmale\b/i.test(v.name.replace(/female/i, "")) : MALE.test(v.name) && !FEMALE.test(v.name)));
  const pool = (wanted.length ? wanted : english).sort((a, b) => rank(a) - rank(b));
  // No matching voice on this computer: use any English voice and move its pitch instead.
  return { voice: pool[0] ?? null, matched: wanted.length > 0 };
}

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Speak a line in the chosen partner voice; resolves when it has finished (or was stopped). */
export async function speak(text: string, kind: PartnerVoice, rate = 0.95): Promise<void> {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const { voice, matched } = await pickVoice(kind);
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "en-US";
    u.rate = rate;
    u.pitch = matched ? 1 : kind === "masculine" ? 0.7 : 1.3;
    // Chrome sometimes never fires "end"; a timeout based on length keeps the interview moving.
    const guard = window.setTimeout(resolve, 2500 + (text.length * 90) / rate);
    u.onend = u.onerror = () => {
      window.clearTimeout(guard);
      resolve();
    };
    synth.speak(u);
  });
}

export const stopSpeaking = () => {
  if (canSpeak()) window.speechSynthesis.cancel();
};

/* ---------- Listening ---------- */

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;
const RecognitionImpl: RecognitionCtor | undefined =
  typeof window === "undefined"
    ? undefined
    : ((window as unknown as { SpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition);

export const canListen = () => !!RecognitionImpl;

export interface Answer {
  text: string;
  /** Seconds from the end of the question until you started talking. */
  startDelay: number;
  /** Seconds from your first word to your last. */
  speaking: number;
  /** Silences longer than 2 seconds in the middle of the answer. */
  longPauses: number;
  /** A recording of the answer, for replay (null if recording is not possible). */
  audio: string | null;
}

export interface ListenOptions {
  /** Live words while you talk. */
  onWords?: (text: string) => void;
  /** Live loudness 0..1 (for the orb). */
  onLevel?: (level: number) => void;
  /** Stop on its own after this much silence once you have spoken (seconds). */
  endSilence?: number;
  /** Give up waiting if you never start (seconds). */
  maxWait?: number;
  /** Longest answer (seconds). */
  maxLength?: number;
}

export interface Listening {
  /** Resolves with the answer when you stop (silence, "I'm done", or the time limit). */
  done: Promise<Answer>;
  /** "I'm done": finish now. */
  finish(): void;
  /** Leave without an answer. */
  cancel(): void;
}

/** The microphone for a practice session, opened once and shared by every answer. */
export async function openMic(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
}

export class ListenError extends Error {}

export function listen(stream: MediaStream, opts: ListenOptions = {}): Listening {
  const endSilence = opts.endSilence ?? 3;
  const maxWait = opts.maxWait ?? 20;
  const maxLength = opts.maxLength ?? 120;

  let finished = false;
  let cancelled = false;
  let finalText = "";
  let interim = "";
  const t0 = performance.now();
  let firstVoice = -1;
  let lastVoice = -1;
  // When words were recognised: a second clock that doesn't depend on how loud the mic is.
  let firstWord = -1;
  let lastWord = -1;
  let longPauses = 0;
  let inPause = false;

  // Words.
  let rec: Recognition | null = null;
  const startRec = () => {
    if (!RecognitionImpl || finished) return;
    const r = new RecognitionImpl();
    r.lang = "en-PH"; // English with a Filipino accent
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (e) => {
      const now = (performance.now() - t0) / 1000;
      if (firstWord < 0) firstWord = now;
      lastWord = now;
      interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) finalText += res[0].transcript + " ";
        else interim += res[0].transcript;
      }
      opts.onWords?.((finalText + interim).trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") fail("mic");
      else if (e.error === "network") fail("network");
    };
    // Chrome stops listening by itself now and then; carry on until the answer is over.
    r.onend = () => {
      if (!finished) startRec();
    };
    rec = r;
    try {
      r.start();
    } catch {
      /* already started */
    }
  };

  // Loudness: pauses, start and end of the answer.
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  src.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  let noiseFloor = 0.01;

  // Replay.
  let recorder: MediaRecorder | null = null;
  const chunks: Blob[] = [];
  try {
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.start();
  } catch {
    recorder = null;
  }

  let resolveDone!: (a: Answer) => void;
  let rejectDone!: (e: Error) => void;
  const done = new Promise<Answer>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });

  const timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    const now = (performance.now() - t0) / 1000;
    // Learn the room's quiet level before you speak; speech is clearly above it.
    if (firstVoice < 0) noiseFloor = Math.min(Math.max(noiseFloor * 0.95 + rms * 0.05, 0.003), 0.05);
    const voiced = rms > Math.max(noiseFloor * 3, 0.012);
    opts.onLevel?.(Math.min(1, rms * 12));
    if (voiced) {
      if (firstVoice < 0) firstVoice = now;
      if (inPause && now - lastVoice > 2) longPauses++;
      inPause = false;
      lastVoice = now;
    } else if (firstVoice >= 0) {
      inPause = true;
      if (now - lastVoice > endSilence && (finalText + interim).trim()) finish();
    }
    if (firstVoice < 0 && now > maxWait) finish();
    if (firstVoice >= 0 && now - firstVoice > maxLength) finish();
  }, 100);

  /**
   * When you started and how long you spoke. The level meter is exact in a quiet room, but a quiet
   * mic or a noisy room can fool it; recognised words are a second opinion (they arrive about a
   * second after they are said). Use whichever is more believable.
   */
  function timing() {
    const RECOGNITION_LAG = 0.8;
    const wordStart = firstWord < 0 ? -1 : Math.max(0, firstWord - RECOGNITION_LAG);
    const starts = [firstVoice, wordStart].filter((x) => x >= 0);
    const startDelay = starts.length ? Math.min(...starts) : maxWait;
    const levelSpan = firstVoice < 0 ? 0 : lastVoice - firstVoice;
    const wordSpan = firstWord < 0 ? 0 : lastWord - firstWord + RECOGNITION_LAG;
    return { startDelay, speaking: Math.max(0.5, levelSpan, wordSpan) };
  }

  function cleanup() {
    window.clearInterval(timer);
    void ctx.close();
  }

  function fail(code: string) {
    if (finished) return;
    finished = true;
    cleanup();
    rec?.abort();
    if (recorder?.state === "recording") recorder.stop();
    rejectDone(new ListenError(code));
  }

  function finish() {
    if (finished) return;
    finished = true;
    cleanup();
    // Give recognition a moment to hand over its last words.
    const r = rec;
    rec = null;
    const words = new Promise<void>((res) => {
      if (!r) return res();
      const t = window.setTimeout(res, 1200);
      r.onend = () => {
        window.clearTimeout(t);
        res();
      };
      r.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res2 = e.results[i]!;
          if (res2.isFinal) finalText += res2[0].transcript + " ";
        }
      };
      r.stop();
    });
    const audio = new Promise<string | null>((res) => {
      if (!recorder || recorder.state !== "recording") return res(null);
      recorder.onstop = () => res(chunks.length ? URL.createObjectURL(new Blob(chunks, { type: recorder!.mimeType })) : null);
      recorder.stop();
    });
    void Promise.all([words, audio]).then(([, url]) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      const text = (finalText || interim).trim();
      resolveDone({
        text,
        ...timing(),
        longPauses,
        audio: url,
      });
    });
  }

  startRec();
  return {
    done,
    finish,
    cancel: () => {
      cancelled = true;
      finish();
    },
  };
}
