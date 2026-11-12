// Practice interview: a spoken mock interview with a practice partner (masculine or feminine voice).
// The partner asks what interview you're preparing for, runs it question by question, listens to
// each answer, then gives feedback out loud and on screen, with your answers to replay.
// No AI: written question sets (web/practice/interviews.ts) and simple scoring rules (score.ts).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Briefcase, CircleCheck, Circle, GraduationCap, Headphones, Landmark, Mic, PhoneOff, Plane, RotateCcw, School, SkipForward, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Orb } from "../../src/components/Orb";
import { fill, useT, type TKey } from "../../src/i18n";
import { detectInterview, INTERVIEWS, interviewOf, type InterviewType } from "../practice/interviews";
import { overall, scoreAnswer, spokenFeedback, type Advice, type AnswerScore, type Overall } from "../practice/score";
import { canListen, canSpeak, listen, ListenError, openMic, speak, stopSpeaking, type Answer, type Listening, type PartnerVoice } from "../practice/voice";

type Stage = "setup" | "choose" | "interview" | "results";
type Activity = "idle" | "speaking" | "listening" | "thinking";

const TYPE_ICON: Record<InterviewType, typeof Briefcase> = { bpo: Headphones, job: Briefcase, abroad: Plane, scholarship: Landmark, college: School };

const LINES = {
  hello: "Hi! I'm your practice partner. What kind of interview are you preparing for? For example, a call center job, a visa interview, or a scholarship.",
  again: "Sorry, I didn't catch that. You can say it again, or tap a choice on your screen.",
  start: (spoken: string, n: number) => `Great, let's practice ${spoken}. I'll ask you ${n} questions. Take your time, and answer like it's the real thing. Let's start.`,
  first: "First question.",
  last: "Last question.",
  more: "Can you tell me a little more?",
  thanks: ["Thank you.", "Okay, thank you.", "Got it, thanks.", "Alright, thank you."],
  end: "That's the end of our interview. Thank you! Here's your feedback.",
};

interface Turn {
  answer: Answer;
  score: AnswerScore;
}

const HISTORY_KEY = "sanay.practice.history";
interface Past {
  date: string;
  type: InterviewType;
  ready: number;
}
function readHistory(): Past[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as Past[];
  } catch {
    return [];
  }
}
function saveHistory(p: Past) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([...readHistory(), p].slice(-20)));
  } catch {
    /* private window: skip */
  }
}

/** Joins two answers to the same question (after "tell me a little more"). */
function joinAnswers(a: Answer, b: Answer): Answer {
  return {
    text: `${a.text} ${b.text}`.trim(),
    startDelay: a.startDelay,
    speaking: a.speaking + b.speaking,
    longPauses: a.longPauses + b.longPauses,
    audio: b.audio ?? a.audio,
  };
}

export function PracticeInterview() {
  const { t, lang } = useT();
  const [stage, setStage] = useState<Stage>("setup");
  const [partner, setPartner] = useState<PartnerVoice>("feminine");
  const [activity, setActivity] = useState<Activity>("idle");
  const [type, setType] = useState<InterviewType | null>(null);
  const [index, setIndex] = useState(0);
  const [words, setWords] = useState("");
  const [level, setLevel] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [result, setResult] = useState<Overall | null>(null);
  const [error, setError] = useState<TKey | null>(null);
  /** Live caption: what the interviewer is saying right now (and the last thing they said). */
  const [caption, setCaption] = useState("");

  const mic = useRef<MediaStream | null>(null);
  const live = useRef<Listening | null>(null);
  const alive = useRef(true); // false once the person leaves or ends: every step checks it
  const run = useRef(0); // each session has a number; old async steps stop when it changes
  const choice = useRef<((t: InterviewType) => void) | null>(null);
  const starting = useRef(false);
  const [opening, setOpening] = useState(false);

  // Leaving the page stops everything.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopAll();
    };
  }, []);

  // The orb moves while the partner talks.
  useEffect(() => {
    if (activity !== "speaking") return;
    let raf = 0;
    const tick = (ms: number) => {
      setLevel(0.3 + 0.4 * Math.abs(Math.sin(ms / 160) * Math.sin(ms / 530)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activity]);

  function stopAll() {
    run.current++;
    stopSpeaking();
    live.current?.cancel();
    live.current = null;
    mic.current?.getTracks().forEach((tr) => tr.stop());
    mic.current = null;
    choice.current = null;
  }

  /** True while this session is still the current one. */
  const still = (id: number) => alive.current && run.current === id;

  async function say(id: number, text: string) {
    if (!still(id)) return;
    setActivity("speaking");
    setCaption(text);
    await speak(text, partner);
    if (still(id)) setActivity("idle");
  }

  async function hear(id: number, opts: { endSilence?: number; maxWait?: number } = {}): Promise<Answer | null> {
    if (!still(id) || !mic.current) return null;
    setWords("");
    setActivity("listening");
    const l = listen(mic.current, { ...opts, onWords: setWords, onLevel: setLevel });
    live.current = l;
    try {
      const a = await l.done;
      return still(id) ? a : null;
    } catch (e) {
      if (still(id)) setError(e instanceof ListenError && e.message === "network" ? "practice.err.network" : "practice.err.mic");
      return null;
    } finally {
      if (live.current === l) live.current = null;
      if (still(id)) {
        setActivity("idle");
        setLevel(0);
      }
    }
  }

  /** Start a session; `same` repeats that interview without asking again. */
  async function start(same?: InterviewType) {
    // A second tap while the first is still starting does nothing (no double interviews).
    if (starting.current) return;
    setError(null);
    if (!canListen() || !canSpeak()) return setError("practice.err.browser");
    starting.current = true;
    setOpening(true);
    stopAll(); // a session from before (e.g. "Practice this again") ends cleanly first
    try {
      mic.current = await openMic();
    } catch {
      return setError("practice.err.mic");
    } finally {
      starting.current = false;
      setOpening(false);
    }
    const id = ++run.current;
    setTurns([]);
    setCaption("");
    setResult(null);
    setIndex(0);
    setType(null);
    if (same) return runInterview(id, same);
    setStage("choose");

    // 1. What interview? Spoken, or tapped on screen.
    const tapped = new Promise<InterviewType>((res) => (choice.current = res));
    let picked: InterviewType | null = null;
    let line = LINES.hello;
    for (let tries = 0; tries < 3 && !picked && still(id); tries++) {
      await say(id, line);
      const heard = await Promise.race([hear(id, { endSilence: 1.8, maxWait: 12 }), tapped]);
      if (typeof heard === "string") picked = heard;
      else if (heard?.text) picked = detectInterview(heard.text);
      line = LINES.again;
    }
    if (!picked) picked = await tapped; // after three tries, wait for a tap
    live.current?.cancel();
    if (!still(id)) return;
    choice.current = null;
    await runInterview(id, picked);
  }

  async function runInterview(id: number, picked: InterviewType) {
    const iv = interviewOf(picked);
    setType(picked);
    setStage("interview");
    await say(id, LINES.start(iv.spoken, iv.questions.length));

    const done: Turn[] = [];
    for (let i = 0; i < iv.questions.length && still(id); i++) {
      const q = iv.questions[i]!;
      setIndex(i);
      const lead = i === 0 ? `${LINES.first} ` : i === iv.questions.length - 1 ? `${LINES.last} ` : "";
      await say(id, lead + q.ask);
      let a = await hear(id);
      if (!a) {
        if (!still(id)) return;
        continue;
      }
      // A very short answer gets one friendly "tell me more".
      const count = a.text.split(/\s+/).filter(Boolean).length;
      if (count > 0 && count < 15 && still(id)) {
        await say(id, LINES.more);
        const more = await hear(id, { maxWait: 10 });
        if (more?.text) a = joinAnswers(a, more);
      }
      if (!still(id)) return;
      const turn = { answer: a, score: scoreAnswer(q, a) };
      done.push(turn);
      setTurns([...done]);
      if (i < iv.questions.length - 1) await say(id, LINES.thanks[i % LINES.thanks.length]!);
    }
    if (!still(id)) return;
    await finish(id, picked, done);
  }

  async function finish(id: number, picked: InterviewType, done: Turn[]) {
    if (!done.length) {
      stopAll();
      setStage("setup");
      return;
    }
    const o = overall(
      done.map((d) => d.score),
      done.map((d) => d.answer),
    );
    setResult(o);
    saveHistory({ date: new Date().toISOString(), type: picked, ready: o.ready });
    mic.current?.getTracks().forEach((tr) => tr.stop());
    mic.current = null;
    setStage("results");
    await say(id, `${LINES.end} ${spokenFeedback(o)}`);
  }

  /** "End practice": score what was answered so far. */
  function endNow() {
    live.current?.cancel();
    stopSpeaking();
    if (type && turns.length) {
      run.current++;
      const id2 = run.current;
      void finish(id2, type, turns);
    } else {
      stopAll();
      setStage("setup");
      setActivity("idle");
    }
  }

  function restart() {
    stopAll();
    setActivity("idle");
    setStage("setup");
  }

  const iv = type ? interviewOf(type) : null;
  const q = iv?.questions[index];
  const past = readHistory();
  const last = past[past.length - 1];

  /* ---------- Screens ---------- */

  if (stage === "setup") {
    return (
      <div className="@container">
        <div className="grid gap-8 @2xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] @2xl:gap-10">
          {/* Left: the partner and the big start button. */}
          <div className="flex flex-col items-center rounded-2xl border border-border bg-card/60 px-5 py-7 text-center">
            <div className="relative size-44">
              <Orb on voice={partner} level={activity === "speaking" ? level : 0.2} className="absolute inset-0 size-full" />
            </div>
            <h2 className="mt-3 text-[22px] font-semibold tracking-[-0.02em]">{t("practice.setup.title")}</h2>
            <p className="mt-2 max-w-sm text-[15px] text-muted-foreground">{t("practice.setup.body")}</p>
            <Button className="mt-6 h-12 w-full max-w-xs rounded-full text-[16px]" disabled={opening} onClick={() => void start()}>
              {t("practice.start")}
            </Button>
            {last && <p className="mt-3 text-[13px] text-muted-foreground">{fill(t("practice.last"), { score: String(last.ready) })}</p>}
          </div>

          {/* Right: choices and tips. */}
          <div className="flex flex-col gap-7">
            <fieldset>
              <legend className="text-[15px] font-semibold">{t("practice.voice.title")}</legend>
              <div className="mt-3 grid grid-cols-1 gap-3 @sm:grid-cols-2">
                {(["feminine", "masculine"] as const).map((v) => (
                  <label
                    key={v}
                    className={cn(
                      "flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 transition-colors",
                      partner === v ? "border-brand/60 bg-accent/60" : "border-border bg-card hover:bg-secondary",
                    )}
                  >
                    <span className="flex items-center gap-2.5 text-[15px] font-medium">
                      <input type="radio" name="partner" value={v} checked={partner === v} onChange={() => setPartner(v)} className="size-4 accent-[var(--brand)]" />
                      {t(`practice.voice.${v}` as TKey)}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 justify-center gap-1.5 bg-card text-[14px]"
                      onClick={(e) => {
                        e.preventDefault();
                        setPartner(v);
                        setActivity("speaking");
                        void speak("Hi! I'll be your interviewer today.", v).then(() => alive.current && setActivity("idle"));
                      }}
                    >
                      <Volume2 className="size-4" /> {t("practice.voice.hear")}
                    </Button>
                  </label>
                ))}
              </div>
            </fieldset>

            <ul className="space-y-3 rounded-2xl bg-secondary/60 p-4 text-[14px]">
              <li className="flex gap-3">
                <Headphones className="mt-0.5 size-[18px] shrink-0 text-brand" /> {t("practice.setup.tip1")}
              </li>
              <li className="flex gap-3">
                <Mic className="mt-0.5 size-[18px] shrink-0 text-brand" /> {t("practice.setup.tip2")}
              </li>
            </ul>

            {error && (
              <p role="alert" className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-[14px] text-warn">
                {t(error)}
              </p>
            )}

            <p className="mt-auto text-[12px] leading-relaxed text-muted-foreground">{t("practice.privacy")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "results" && result && iv) {
    return <Results o={result} turns={turns} iv={iv} lang={lang} speaking={activity === "speaking"} onAgain={() => void start(type ?? undefined)} onNew={restart} onHear={() => void speak(spokenFeedback(result), partner)} onStopHear={stopSpeaking} />;
  }

  // "choose" and "interview": the call screen. Wide: the partner on the left, the question on the right.
  return (
    <div className="@container">
      <div className="grid gap-6 @2xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] @2xl:gap-10">
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card/60 px-5 py-6 text-center">
          <p className="text-[13px] text-muted-foreground">
            {iv ? fill(t("practice.progress"), { n: String(index + 1), total: String(iv.questions.length) }) : t("practice.choose.title")}
          </p>
          <p className="mt-0.5 text-[15px] font-medium">{t(`practice.voice.${partner}` as TKey)}</p>
          {iv && (
            <div className="mt-3 flex gap-1.5" aria-hidden>
              {iv.questions.map((_, i) => (
                <span key={i} className={cn("h-1.5 w-6 rounded-full", i < index ? "bg-brand" : i === index ? "bg-brand/60" : "bg-secondary")} />
              ))}
            </div>
          )}
          <div className="relative mt-2 aspect-square w-36 @2xl:w-52">
            <Orb on voice={activity === "listening" ? "natural" : partner} level={level} className="absolute inset-0 size-full" />
          </div>
          <p className="text-[15px] font-medium">
            {activity === "speaking" ? t("practice.state.speaking") : activity === "listening" ? t("practice.state.listening") : t("practice.state.wait")}
          </p>
          {caption && (
            <div className="mt-4 w-full rounded-xl bg-background/70 px-4 py-3 text-left">
              <p className="text-[12px] font-medium text-muted-foreground">{t("practice.caption.them")}</p>
              <p lang="en" className={cn("mt-1 text-[15px] leading-relaxed", activity !== "speaking" && "text-muted-foreground")} aria-live="polite">
                {caption}
              </p>
            </div>
          )}
          <div className="mt-6 flex items-start justify-center gap-4">
            <RoundButton label={t("practice.end")} danger onClick={endNow}>
              <PhoneOff />
            </RoundButton>
            {activity === "listening" && (
              <RoundButton label={t("practice.done")} primary onClick={() => live.current?.finish()}>
                <CircleCheck />
              </RoundButton>
            )}
            {activity === "speaking" && stage === "interview" && (
              <RoundButton label={t("practice.skipVoice")} onClick={stopSpeaking}>
                <SkipForward />
              </RoundButton>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {stage === "choose" && (
            <>
              <h2 className="text-[18px] font-semibold tracking-[-0.01em]">{t("practice.choose.title")}</h2>
              <div className="grid gap-2.5 @md:grid-cols-2 @2xl:grid-cols-1 @4xl:grid-cols-2">
                {INTERVIEWS.map((i) => {
                  const Icon = TYPE_ICON[i.type];
                  return (
                    <button
                      key={i.type}
                      onClick={() => choice.current?.(i.type)}
                      className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left text-[15px] font-medium transition-colors hover:bg-secondary"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-brand">
                        <Icon className="size-[18px]" />
                      </span>
                      {t(`practice.type.${i.type}` as TKey)}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {stage === "interview" && q && (
            <div className="rounded-2xl border border-border bg-card p-5 @2xl:p-6">
              <p lang="en" className="text-[clamp(1.25rem,2.4vw,1.6rem)] leading-snug font-semibold tracking-[-0.01em]">
                {q.ask}
              </p>
              {lang === "fil" && <p className="mt-2 text-[14px] text-muted-foreground">{q.fil}</p>}
            </div>
          )}

          {(stage === "interview" || activity === "listening") && (
            <div className="flex min-h-36 flex-1 flex-col rounded-2xl border border-dashed border-border p-5">
              <p className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                {activity === "listening" && <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />}
                {t("practice.caption.you")}
              </p>
              <p lang="en" className="mt-2 text-[16px] leading-relaxed" aria-live="polite">
                {activity === "listening" ? words || <span className="text-muted-foreground">{t("practice.state.listeningHint")}</span> : <span className="text-muted-foreground">{t("practice.answerWait")}</span>}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-[14px] text-warn">
              {t(error)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RoundButton({ label, onClick, children, danger, primary }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean; primary?: boolean }) {
  return (
    <div className="flex w-24 flex-col items-center gap-1.5 text-center text-[12px] text-muted-foreground">
      <button
        onClick={onClick}
        aria-label={label}
        className={cn(
          "grid size-14 place-items-center rounded-full border transition-transform active:scale-95",
          danger ? "border-transparent bg-destructive text-white" : primary ? "border-transparent bg-brand text-brand-foreground" : "border-border bg-card",
        )}
      >
        {children}
      </button>
      <span aria-hidden>{label}</span>
    </div>
  );
}

/* ---------- Results ---------- */

const PART_KEYS: (keyof AnswerScore["parts"])[] = ["content", "length", "pace", "fluency", "confidence"];

function adviceText(t: (k: TKey) => string, a: Advice) {
  const vars: Record<string, string> = {};
  if ("pace" in a) vars.pace = String(a.pace);
  if ("word" in a) vars.word = a.word;
  if ("count" in a) vars.count = String(a.count);
  if ("seconds" in a) vars.seconds = String(a.seconds);
  return fill(t(`practice.advice.${a.code}` as TKey), vars);
}

function Results({
  o,
  turns,
  iv,
  lang,
  speaking,
  onAgain,
  onNew,
  onHear,
  onStopHear,
}: {
  o: Overall;
  turns: Turn[];
  iv: ReturnType<typeof interviewOf>;
  lang: string;
  speaking: boolean;
  onAgain: () => void;
  onNew: () => void;
  onHear: () => void;
  onStopHear: () => void;
}) {
  const { t } = useT();
  const r = 52;
  const c = 2 * Math.PI * r;
  /** Average of one part; pace only over the answers where it could be measured (null: none). */
  const avg = (k: keyof AnswerScore["parts"]): number | null => {
    const use = k === "pace" ? turns.filter((x) => x.score.paceKnown) : turns;
    return use.length ? Math.round(use.reduce((s, x) => s + x.score.parts[k], 0) / use.length) : null;
  };
  return (
    <div className="@container space-y-8">
      {/* Top: the score and what to work on (left), the parts (right). */}
      <div className="grid gap-6 @2xl:grid-cols-2 @2xl:gap-8">
        <div className="space-y-5 rounded-2xl border border-border bg-card/60 p-5 @2xl:p-6">
          <div className="flex flex-wrap items-center gap-5">
            <div className="relative size-32 shrink-0">
              <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
                <circle cx="60" cy="60" r={r} fill="none" stroke="var(--secondary)" strokeWidth="10" />
                <circle cx="60" cy="60" r={r} fill="none" stroke="var(--brand)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - o.ready / 100)} />
              </svg>
              <span className="absolute inset-0 grid place-items-center text-center">
                <span>
                  <span className="block text-3xl font-semibold">{o.ready}</span>
                  <span className="block text-[11px] text-muted-foreground">{t("practice.ready")}</span>
                </span>
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[20px] font-semibold tracking-[-0.01em]">{t(`practice.band.${o.band}` as TKey)}</p>
              <p className="mt-1 text-[14px] text-muted-foreground">
                {t("practice.wentWell")} {t(`practice.strength.${o.strength}` as TKey)}
              </p>
              <Button variant="outline" className="mt-3 h-10 gap-1.5 bg-card text-[14px]" onClick={speaking ? onStopHear : onHear}>
                <Volume2 className="size-4" /> {speaking ? t("practice.stopFeedback") : t("practice.hearFeedback")}
              </Button>
            </div>
          </div>

          {o.advice.length === 0 && (
            <p className="rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-[14px]">{t("practice.nothingToFix")}</p>
          )}
          {o.advice.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[14px] font-semibold">{t("practice.improve")}</h3>
              {o.advice.map((a) => (
                <p key={a.code} className="rounded-xl border border-brand/30 bg-accent/50 px-4 py-3 text-[14px]">
                  {adviceText(t, a)}
                </p>
              ))}
            </section>
          )}
        </div>

        <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-5 @2xl:p-6">
          <h3 className="text-[14px] font-semibold">{t("practice.parts")}</h3>
          {PART_KEYS.map((k) => (
            <div key={k} className="space-y-1.5 text-[14px]">
              <div className="flex justify-between">
                <span>{t(`practice.part.${k}` as TKey)}</span>
                <span className="tabular-nums text-muted-foreground">{avg(k) ?? t("practice.notMeasured")}</span>
              </div>
              <span className="block h-2 overflow-hidden rounded-full bg-secondary">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${avg(k) ?? 0}%` }} />
              </span>
            </div>
          ))}
        </section>
      </div>

      {/* Every answer: two columns when there is room. */}
      <section className="space-y-3">
        <h3 className="text-[15px] font-semibold">{t("practice.answers")}</h3>
        <div className="grid gap-3">
          {turns.map((turn, i) => {
            const q = iv.questions[i]!;
            const fillers = Object.entries(turn.score.fillers);
            return (
              <details key={i} className="group rounded-2xl border border-border bg-card p-4" open={i === 0}>
                <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2.5 text-[15px] font-medium">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-[12px]">{i + 1}</span>
                  <span lang="en" className="min-w-0 flex-1">
                    {q.ask}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[13px] tabular-nums">{turn.score.total}</span>
                </summary>
                <div className="mt-4 space-y-3 text-[14px]">
                  {turn.answer.audio && <audio controls src={turn.answer.audio} className="h-10 w-full" aria-label={t("practice.replay")} />}
                  <p lang="en" className="leading-relaxed text-muted-foreground">
                    “{turn.answer.text || t("practice.noAnswer")}”
                  </p>
                  <ul className="space-y-1.5">
                    {q.points.map((p, k) => (
                      <li key={k} className="flex items-center gap-2 text-[13px]">
                        {turn.score.covered[k] ? <CircleCheck className="size-4 shrink-0 text-ok" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
                        <span className={turn.score.covered[k] ? "" : "text-muted-foreground"}>{(lang === "fil" ? q.names.fil : q.names.en)[k] ?? p[0]}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[13px] text-muted-foreground">
                    {turn.score.paceKnown ? fill(t("practice.stats"), { words: String(turn.score.words), pace: String(turn.score.pace) }) : fill(t("practice.statsNoPace"), { words: String(turn.score.words) })}
                    {fillers.length > 0 && ` · ${t("practice.fillers")} ${fillers.map(([w, n]) => `“${w}” ×${n}`).join(", ")}`}
                  </p>
                  <p className="rounded-xl bg-secondary px-3.5 py-2.5 text-[13px]">
                    <span className="font-medium">{t("practice.tip")}</span> {lang === "fil" ? q.tip.fil : q.tip.en}
                  </p>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-3 @lg:flex-row">
        <Button className="h-12 flex-1 rounded-full text-[15px]" onClick={onAgain}>
          <RotateCcw /> {t("practice.again")}
        </Button>
        <Button variant="outline" className="h-12 flex-1 rounded-full bg-card text-[15px]" onClick={onNew}>
          <GraduationCap /> {t("practice.other")}
        </Button>
      </div>
    </div>
  );
}
