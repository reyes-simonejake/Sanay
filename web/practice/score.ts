// Scoring a practice interview with simple, explainable rules (no AI): did the answer cover the
// usual points, was it long enough, the speaking pace, filler words, long pauses, and how quickly
// you started. Every number here can be explained to the person in one sentence.
import type { Answer } from "./voice";
import type { Question } from "./interviews";

/** Filler words people say while thinking, in English and in Filipino. */
const FILLERS = ["uh", "uhm", "um", "umm", "ahh", "ah", "erm", "hmm", "like", "parang", "ano", "kasi", "bale", "ganun", "you know", "i mean", "basically", "actually"];

export interface AnswerScore {
  words: number;
  /** Words per minute while speaking (0 when it couldn't be measured). */
  pace: number;
  paceKnown: boolean;
  fillers: Record<string, number>;
  fillerCount: number;
  /** Which of the question's points the answer covered. */
  covered: boolean[];
  /** 0..100 for each part. */
  parts: { content: number; length: number; pace: number; fluency: number; confidence: number };
  total: number;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

function countFillers(text: string) {
  const lower = ` ${text.toLowerCase().replace(/[.,!?]/g, " ")} `;
  const found: Record<string, number> = {};
  for (const f of FILLERS) {
    // "like" and "actually" are fillers only sometimes; count them only when they repeat a lot.
    const n = lower.split(` ${f} `).length - 1;
    if (n > 0) found[f] = n;
  }
  for (const soft of ["like", "actually", "basically"]) if ((found[soft] ?? 0) < 3) delete found[soft];
  return found;
}

export function scoreAnswer(q: Question, a: Answer): AnswerScore {
  const text = ` ${a.text.toLowerCase()} `;
  const words = countWords(a.text);
  const minutes = Math.max(a.speaking, 1) / 60;
  const measured = words ? Math.round(words / minutes) : 0;
  // Nobody speaks below ~50 or above ~260 words a minute: such a number means the timing failed
  // (a very quiet mic, a noisy room). Then pace is "not measured" instead of wrong advice.
  const paceKnown = words >= 8 && measured >= 50 && measured <= 260;
  const pace = paceKnown ? measured : 0;
  const fillers = countFillers(a.text);
  const fillerCount = Object.values(fillers).reduce((n, v) => n + v, 0);
  const covered = q.points.map((group) => group.some((w) => text.includes(` ${w}`) || text.includes(`${w} `)));

  const content = words === 0 ? 0 : (covered.filter(Boolean).length / q.points.length) * 100;
  // A good spoken answer is roughly 30 to 150 words.
  const length = words === 0 ? 0 : words < 30 ? (words / 30) * 100 : words > 180 ? Math.max(50, 100 - (words - 180) / 3) : 100;
  // Clear interview pace: about 110 to 165 words a minute.
  const paceScore = !words ? 0 : !paceKnown ? 0 : pace < 110 ? 100 - (110 - pace) * 1.2 : pace > 165 ? 100 - (pace - 165) * 1.5 : 100;
  const perMinute = (fillerCount + a.longPauses) / minutes;
  const fluency = !words ? 0 : 100 - perMinute * 12;
  // Starting within about 3 seconds sounds ready; long silences before answering sound unsure.
  const confidence = !words ? 0 : a.startDelay <= 3 ? 100 : 100 - (a.startDelay - 3) * 12;

  // Pace, smoothness and confidence mean little in a few words: they count fully from about 30 words.
  const said = Math.min(1, words / 30);
  const parts = {
    content: clamp(content),
    length: clamp(length),
    pace: clamp(paceScore * said),
    fluency: clamp(fluency * said),
    confidence: clamp(confidence * said),
  };
  // Without a pace, the other parts share its weight.
  const total = paceKnown || !words
    ? clamp(parts.content * 0.35 + parts.length * 0.15 + parts.pace * 0.15 + parts.fluency * 0.2 + parts.confidence * 0.15)
    : clamp((parts.content * 0.35 + parts.length * 0.15 + parts.fluency * 0.2 + parts.confidence * 0.15) / 0.85);
  return { words, pace, paceKnown, fillers, fillerCount, covered, parts, total };
}

/** One thing to work on, as a code the screen and the interviewer's voice both turn into words. */
export type Advice =
  | { code: "silent" }
  | { code: "short" }
  | { code: "long" }
  | { code: "fast"; pace: number }
  | { code: "slow"; pace: number }
  | { code: "fillers"; word: string; count: number }
  | { code: "pauses"; count: number }
  | { code: "start"; seconds: number }
  | { code: "content" };

export interface Overall {
  ready: number;
  /** "ready" 80+, "almost" 60-79, "practice" under 60. */
  band: "ready" | "almost" | "practice";
  /** What went well (the best part). */
  strength: keyof AnswerScore["parts"];
  /** The two most useful things to work on, most important first. */
  advice: Advice[];
}

export function overall(scores: AnswerScore[], answers: Answer[]): Overall {
  const n = Math.max(scores.length, 1);
  const ready = clamp(scores.reduce((s, x) => s + x.total, 0) / n);
  const avg = (k: keyof AnswerScore["parts"]) => scores.reduce((s, x) => s + x.parts[k], 0) / n;
  const keys: (keyof AnswerScore["parts"])[] = ["content", "length", "pace", "fluency", "confidence"];
  const strength = keys.reduce((best, k) => (avg(k) > avg(best) ? k : best), keys[0]!);

  const spoken = scores.filter((s) => s.words > 0);
  const advice: { a: Advice; weight: number }[] = [];
  if (spoken.length < scores.length) advice.push({ a: { code: "silent" }, weight: 100 });
  const words = spoken.reduce((s, x) => s + x.words, 0) / Math.max(spoken.length, 1);
  if (spoken.length && words < 30) advice.push({ a: { code: "short" }, weight: 90 - words });
  if (spoken.length && words > 180) advice.push({ a: { code: "long" }, weight: 40 });
  const timed = spoken.filter((x) => x.paceKnown);
  const pace = Math.round(timed.reduce((s, x) => s + x.pace, 0) / Math.max(timed.length, 1));
  if (timed.length && pace > 170) advice.push({ a: { code: "fast", pace }, weight: 50 + (pace - 170) / 2 });
  if (timed.length && pace && pace < 100) advice.push({ a: { code: "slow", pace }, weight: 45 + (100 - pace) / 2 });
  const fillerTotals: Record<string, number> = {};
  for (const s of scores) for (const [w, c] of Object.entries(s.fillers)) fillerTotals[w] = (fillerTotals[w] ?? 0) + c;
  const top = Object.entries(fillerTotals).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 3) advice.push({ a: { code: "fillers", word: top[0], count: top[1] }, weight: 40 + top[1] * 3 });
  const pauses = answers.reduce((s, a) => s + a.longPauses, 0);
  if (pauses >= 3) advice.push({ a: { code: "pauses", count: pauses }, weight: 35 + pauses * 2 });
  const delay = answers.filter((a) => a.text).reduce((s, a) => s + a.startDelay, 0) / Math.max(spoken.length, 1);
  if (spoken.length && delay > 4) advice.push({ a: { code: "start", seconds: Math.round(delay) }, weight: 30 + delay * 2 });
  if (spoken.length && avg("content") < 60) advice.push({ a: { code: "content" }, weight: 60 });

  return {
    ready,
    band: ready >= 80 ? "ready" : ready >= 60 ? "almost" : "practice",
    strength,
    advice: advice.sort((a, b) => b.weight - a.weight).slice(0, 2).map((x) => x.a),
  };
}

/* ---------- What the interviewer says (English: the language being practised) ---------- */

const STRENGTH_SPOKEN: Record<keyof AnswerScore["parts"], string> = {
  content: "you covered the important points",
  length: "your answers had a good length",
  pace: "you spoke at a clear pace",
  fluency: "you spoke smoothly",
  confidence: "you answered with confidence",
};

function adviceSpoken(a: Advice): string {
  switch (a.code) {
    case "silent":
      return "Try to answer every question, even with a short answer.";
    case "short":
      return "Give longer answers, with one example each time.";
    case "long":
      return "Keep your answers a little shorter, about one minute each.";
    case "fast":
      return "Slow down a little, and pause between ideas.";
    case "slow":
      return "Try to speak a little faster and keep going.";
    case "fillers":
      return `Try to say "${a.word}" less. A short pause is better.`;
    case "pauses":
      return "Plan your answer in your head first, so there are fewer long pauses.";
    case "start":
      return "Start your answer a bit sooner. You can say, let me think, then begin.";
    case "content":
      return "Cover more of the key points. Check the tips on your screen.";
  }
}

export function spokenFeedback(o: Overall): string {
  const open = o.band === "ready" ? "Great job! You sound ready." : o.band === "almost" ? "Good job! You're almost ready." : "Thanks for practicing! Keep going, you're improving.";
  const parts = [open, `Your Ready score is ${o.ready}.`, `What went well: ${STRENGTH_SPOKEN[o.strength]}.`];
  if (o.advice.length) parts.push(`To improve: ${o.advice.map(adviceSpoken).join(" ")}`);
  parts.push("You can replay your answers on the screen.");
  return parts.join(" ");
}
