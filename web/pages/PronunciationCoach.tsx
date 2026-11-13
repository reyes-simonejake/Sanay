// Pronunciation coach: sounds Filipinos often mix up (F/P, V/B, TH, i/ee, SH/S), in two steps.
//  1. Listen: Sanay plays one of two words and you pick which one you heard (training the ear).
//  2. Say it: hear the word (also slowly), say it, see which word Sanay heard, and replay yourself.
//     Up to 3 tries a word, then a sentence challenge and a summary with "practise the missed ones".
// Speech recognition is Chrome's (it sends audio to Google). Progress stays on this device.
import { useEffect, useRef, useState } from "react";
import { CircleCheck, Ear, Loader2, Mic, Play, RotateCcw, Snail, Volume2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fill, useT, type TKey } from "../../src/i18n";
import { DRILLS, judge, judgeSentence, type Drill } from "../practice/sounds";
import { canListen, speak, stopSpeaking } from "../practice/voice";

/* Chrome's speech recognition with several guesses per result. */
interface Alternatives {
  length: number;
  [i: number]: { transcript: string };
}
interface Recognition {
  lang: string;
  maxAlternatives: number;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<Alternatives> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;
const RecognitionImpl: RecognitionCtor | undefined =
  (window as unknown as { SpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;

type Mode = "listen" | "say";
const MAX_TRIES = 3;
const VOICE = "feminine" as const;

const PROGRESS_KEY = "sanay.coach.progress";
function readProgress(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

/** Hear one attempt: the guesses speech recognition offers, plus a recording to replay. */
function useAttempt() {
  const rec = useRef<Recognition | null>(null);
  const mic = useRef<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState<string | null>(null);

  useEffect(
    () => () => {
      rec.current?.abort();
      mic.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function attempt(): Promise<{ guesses: string[] } | { error: TKey }> {
    if (!RecognitionImpl) return { error: "coach.err.browser" };
    stopSpeaking();
    setBusy(true);
    // A recording of this attempt, so you can compare it with the right sound.
    let recorder: MediaRecorder | null = null;
    const chunks: Blob[] = [];
    try {
      mic.current ??= await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(mic.current);
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.start();
    } catch {
      recorder = null;
    }
    const result = await new Promise<{ guesses: string[] } | { error: TKey }>((resolve) => {
      const r = new RecognitionImpl();
      r.lang = "en-US";
      r.maxAlternatives = 5;
      r.interimResults = false;
      let out: { guesses: string[] } | { error: TKey } = { error: "coach.err.noSpeech" };
      r.onresult = (e) => {
        const alts = e.results[0]!;
        const guesses: string[] = [];
        for (let i = 0; i < alts.length; i++) guesses.push(alts[i]!.transcript);
        out = { guesses };
      };
      r.onerror = (e) => {
        if (e.error === "not-allowed") out = { error: "coach.err.mic" };
        else if (e.error === "network") out = { error: "coach.err.network" };
      };
      r.onend = () => resolve(out);
      rec.current = r;
      r.start();
    });
    rec.current = null;
    if (recorder && recorder.state === "recording") {
      await new Promise<void>((res) => {
        recorder!.onstop = () => res();
        recorder!.stop();
      });
      if (chunks.length) {
        setRecording((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(new Blob(chunks, { type: recorder!.mimeType }));
        });
      }
    }
    setBusy(false);
    return result;
  }

  const clear = () =>
    setRecording((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });

  return { attempt, busy, recording, clear };
}

export function PronunciationCoach() {
  const { t } = useT();
  const [drill, setDrill] = useState<Drill>(DRILLS[0]!);
  const [mode, setMode] = useState<Mode>("listen");
  const [progress, setProgress] = useState(readProgress);

  const save = (id: string, score: number) => {
    const p = { ...progress, [id]: Math.max(progress[id] ?? 0, score) };
    setProgress(p);
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
    } catch {
      /* private window */
    }
  };

  return (
    <div className="@container space-y-6">
      {/* The five sound pairs. */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("coach.pick")}>
        {DRILLS.map((d) => (
          <button
            key={d.id}
            role="tab"
            aria-selected={d.id === drill.id}
            onClick={() => {
              stopSpeaking();
              setDrill(d);
              setMode("listen");
            }}
            className={cn(
              "flex h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] font-medium",
              d.id === drill.id ? "border-transparent bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {d.pair}
            {progress[d.id] === d.words.length && <CircleCheck className="size-4 text-ok" aria-label={t("coach.mastered")} />}
          </button>
        ))}
      </div>

      {/* Step 1 / Step 2 */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/60 p-1.5" role="tablist" aria-label={t("coach.steps")}>
        {(["listen", "say"] as const).map((m, i) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              stopSpeaking();
              setMode(m);
            }}
            className={cn(
              "flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-2 text-[14px] font-medium whitespace-nowrap transition-colors sm:gap-2 sm:px-3 sm:text-[15px]",
              mode === m ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "listen" ? <Ear className="size-[18px]" /> : <Mic className="size-[18px]" />}
            {fill(t(`coach.step.${m}` as TKey), { n: String(i + 1) })}
          </button>
        ))}
      </div>

      {mode === "listen" ? <ListenStep key={drill.id} drill={drill} onDone={() => setMode("say")} /> : <SayStep key={drill.id} drill={drill} onFinish={(score) => save(drill.id, score)} />}

      <p className="text-[12px] leading-relaxed text-muted-foreground">{t("coach.privacy")}</p>
    </div>
  );
}

/* ---------- Step 1: Listen (ear training) ---------- */

const LISTEN_ROUNDS = 6;

function ListenStep({ drill, onDone }: { drill: Drill; onDone: () => void }) {
  const { t, lang } = useT();
  // Each round: one of the pairs, and which of its two words is played.
  const [rounds] = useState(() =>
    Array.from({ length: LISTEN_ROUNDS }, (_, i) => {
      const pair = drill.words[i % drill.words.length]!;
      return { pair, answer: Math.random() < 0.5 ? 0 : 1 };
    }),
  );
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const done = i >= rounds.length;
  const round = rounds[i];

  const play = (rate = 0.9) => round && void speak(round.pair[round.answer]!, VOICE, rate);

  // Play each new word as soon as it shows.
  useEffect(() => {
    const r = rounds[i];
    if (r) void speak(r.pair[r.answer]!, VOICE, 0.9);
  }, [i, rounds]);

  const pick = (k: number) => {
    if (picked !== null || !round) return;
    setPicked(k);
    if (k === round.answer) setRight((r) => r + 1);
  };

  if (done) {
    return (
      <div className="grid gap-6 @2xl:grid-cols-2">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-5xl font-semibold">
            {right} / {rounds.length}
          </p>
          <p className="mt-3 text-[16px]">{t(right >= rounds.length - 1 ? "coach.listen.great" : "coach.listen.ok")}</p>
        </div>
        <div className="flex flex-col justify-center gap-3 rounded-2xl bg-secondary/60 p-6">
          <p className="text-[15px]">{t("coach.listen.next")}</p>
          <Button className="h-12 gap-2 rounded-full text-[15px]" onClick={onDone}>
            <Mic /> {t("coach.listen.toSay")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 @2xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] @2xl:gap-8">
      <div className="space-y-4">
        <div className="rounded-2xl bg-secondary/60 p-5">
          <p className="text-[13px] font-medium text-muted-foreground">{t("coach.how")}</p>
          <p className="mt-1.5 text-[15px] leading-relaxed">{lang === "fil" ? drill.how.fil : drill.how.en}</p>
        </div>
        <p className="text-[14px] text-muted-foreground">{t("coach.listen.body")}</p>
      </div>

      <div className="flex flex-col items-center rounded-2xl border border-brand/40 bg-accent/50 p-6 text-center">
        <p className="text-[13px] text-muted-foreground">{fill(t("coach.round"), { n: String(i + 1), total: String(rounds.length) })}</p>
        <p className="mt-2 text-[18px] font-semibold">{t("coach.listen.q")}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2.5">
          <Button variant="outline" className="h-12 gap-2 rounded-full bg-card px-5 text-[15px]" onClick={() => play()}>
            <Volume2 /> {t("coach.playAgain")}
          </Button>
          <Button variant="ghost" className="h-12 gap-2 rounded-full px-4 text-[15px]" onClick={() => play(0.55)}>
            <Snail /> {t("coach.slow")}
          </Button>
        </div>
        <div className="mt-6 grid w-full grid-cols-2 gap-3">
          {round!.pair.map((w, k) => {
            const isAnswer = k === round!.answer;
            const show = picked !== null;
            return (
              <button
                key={w}
                lang="en"
                onClick={() => pick(k)}
                disabled={show}
                className={cn(
                  "min-h-20 rounded-2xl border-2 text-3xl font-semibold tracking-[-0.02em] transition-colors",
                  !show && "border-border bg-card hover:border-brand/60",
                  show && isAnswer && "border-ok bg-ok/15 text-ok",
                  show && !isAnswer && k === picked && "border-warn bg-warn/10 text-warn",
                  show && !isAnswer && k !== picked && "border-border bg-card opacity-50",
                )}
              >
                {w}
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <div className="mt-5 w-full">
            <p role="status" className={cn("text-[15px] font-semibold", picked === round!.answer ? "text-ok" : "text-warn")}>
              {picked === round!.answer ? t("coach.listen.right") : fill(t("coach.listen.wrong"), { word: round!.pair[round!.answer]! })}
            </p>
            <Button
              className="mt-4 h-12 w-full max-w-xs rounded-full text-[15px]"
              onClick={() => {
                setPicked(null);
                setI(i + 1);
              }}
            >
              {t("coach.next")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Step 2: Say it ---------- */

type Verdict = "right" | "other" | "unclear";
interface WordResult {
  word: string;
  ok: boolean;
}

function SayStep({ drill, onFinish }: { drill: Drill; onFinish: (score: number) => void }) {
  const { t, lang } = useT();
  const { attempt, busy, recording, clear } = useAttempt();
  // Which words to practise this round (all of them, or only the missed ones).
  const [list, setList] = useState(drill.words);
  const [i, setI] = useState(0);
  const [tries, setTries] = useState(0);
  const [last, setLast] = useState<{ verdict: Verdict; heard: string } | null>(null);
  const [error, setError] = useState<TKey | null>(null);
  const [results, setResults] = useState<WordResult[]>([]);
  const [sentence, setSentence] = useState<{ heard: string; ok: boolean[] } | null>(null);
  const [stage, setStage] = useState<"words" | "sentence" | "summary">("words");
  const advance = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(advance.current), []);

  const pair = list[i];

  const nextWord = (ok: boolean) => {
    window.clearTimeout(advance.current);
    const res = [...results, { word: pair![0], ok }];
    setResults(res);
    setTries(0);
    setLast(null);
    setError(null);
    clear();
    if (i + 1 < list.length) setI(i + 1);
    else {
      setStage("sentence");
      if (list.length === drill.words.length) onFinish(res.filter((r) => r.ok).length);
    }
  };

  const sayWord = async () => {
    if (!pair) return;
    setError(null);
    const r = await attempt();
    if ("error" in r) return setError(r.error);
    const verdict = judge(pair[0], pair[1], r.guesses);
    setLast({ verdict, heard: r.guesses[0] ?? "" });
    setTries((n) => n + 1);
    // Right: move on by itself after a moment.
    if (verdict === "right") advance.current = window.setTimeout(() => nextWord(true), 1600);
  };

  const saySentence = async () => {
    setError(null);
    const r = await attempt();
    if ("error" in r) return setError(r.error);
    setSentence({ heard: r.guesses[0] ?? "", ok: judgeSentence(drill.targets, r.guesses.slice(0, 1)) });
  };

  const restart = (words: [string, string][]) => {
    setList(words);
    setI(0);
    setTries(0);
    setLast(null);
    setResults([]);
    setSentence(null);
    setError(null);
    clear();
    setStage("words");
  };

  const tipBox = (
    <div className="rounded-2xl bg-secondary/60 p-5">
      <p className="text-[13px] font-medium text-muted-foreground">{t("coach.how")}</p>
      <p className="mt-1.5 text-[15px] leading-relaxed">{lang === "fil" ? drill.how.fil : drill.how.en}</p>
    </div>
  );

  const errorBox = error && (
    <p role="alert" className="mt-5 w-full rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-left text-[14px] text-warn">
      {t(error)}
    </p>
  );

  const replay = recording && (
    <Button variant="ghost" className="h-11 gap-2 rounded-full text-[15px]" onClick={() => void new Audio(recording).play()}>
      <Play className="size-4" /> {t("coach.hearYourself")}
    </Button>
  );

  /* Summary */
  if (stage === "summary") {
    const missed = list.filter((p) => results.some((r) => r.word === p[0] && !r.ok));
    const score = results.filter((r) => r.ok).length;
    return (
      <div className="grid gap-6 @2xl:grid-cols-2">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-5xl font-semibold">
            {score} / {results.length}
          </p>
          <p className="mt-3 text-[16px]">{t(score === results.length ? "coach.done.all" : score >= results.length - 2 ? "coach.done.good" : "coach.done.more")}</p>
        </div>
        <div className="space-y-3">
          <ul className="space-y-2">
            {results.map((r) => (
              <li key={r.word} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-[15px]">
                {r.ok ? <CircleCheck className="size-5 text-ok" /> : <XCircle className="size-5 text-warn" />}
                <span lang="en" className="font-medium">
                  {r.word}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2.5 @lg:flex-row">
            {missed.length > 0 && (
              <Button className="h-12 flex-1 gap-2 rounded-full text-[15px]" onClick={() => restart(missed)}>
                <RotateCcw /> {t("coach.practiceMissed")}
              </Button>
            )}
            <Button variant="outline" className="h-12 flex-1 gap-2 rounded-full bg-card text-[15px]" onClick={() => restart(drill.words)}>
              <RotateCcw /> {t("coach.again")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* Sentence challenge */
  if (stage === "sentence") {
    const words = drill.sentence.split(" ");
    return (
      <div className="grid gap-6 @2xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] @2xl:gap-8">
        <div className="space-y-4">
          {tipBox}
          <p className="text-[14px] text-muted-foreground">{t("coach.sentence.body")}</p>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-brand/40 bg-accent/50 p-6 text-center">
          <p className="text-[13px] font-medium text-muted-foreground">{t("coach.sentence.title")}</p>
          <p lang="en" className="mt-3 text-[clamp(1.4rem,3vw,2rem)] leading-snug font-semibold tracking-[-0.02em]">
            {words.map((w, k) => {
              const clean = w.toLowerCase().replace(/[^a-z']/g, "");
              const idx = drill.targets.indexOf(clean);
              const mark = idx >= 0 && sentence ? (sentence.ok[idx] ? "text-ok" : "text-warn underline decoration-wavy") : idx >= 0 ? "text-brand" : "";
              return (
                <span key={k} className={mark}>
                  {w}{" "}
                </span>
              );
            })}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <Button variant="outline" className="h-12 gap-2 rounded-full bg-card px-5 text-[15px]" onClick={() => void speak(drill.sentence, VOICE, 0.85)}>
              <Volume2 /> {t("coach.hear")}
            </Button>
            <Button className="h-12 gap-2 rounded-full px-6 text-[15px]" onClick={() => void saySentence()} disabled={busy || !canListen()}>
              {busy ? <Loader2 className="animate-spin" /> : <Mic />} {busy ? t("coach.listening") : t("coach.say")}
            </Button>
          </div>
          {sentence && (
            <div role="status" className="mt-5 w-full rounded-xl bg-card px-4 py-3 text-left text-[14px]">
              <p className="font-semibold">{fill(t("coach.sentence.score"), { n: String(sentence.ok.filter(Boolean).length), total: String(sentence.ok.length) })}</p>
              <p className="mt-1 text-muted-foreground">
                {t("coach.heard")} <span lang="en">“{sentence.heard}”</span>
              </p>
            </div>
          )}
          {errorBox}
          <div className="mt-auto flex flex-wrap justify-center gap-2 pt-6">
            {replay}
            <Button variant="ghost" className="h-11 text-[15px]" onClick={() => setStage("summary")}>
              {sentence ? t("coach.seeResults") : t("coach.skip")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* Words */
  return (
    <div className="grid gap-6 @2xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] @2xl:gap-8">
      <div className="space-y-5">
        {tipBox}
        <ol className="space-y-2">
          {list.map(([w, o], k) => {
            const r = results.find((x) => x.word === w);
            return (
              <li key={w} className={cn("flex items-center gap-3 rounded-xl border px-4 py-2.5 text-[15px]", k === i ? "border-brand/50 bg-accent/50" : "border-border bg-card")}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[12px]">{k + 1}</span>
                <span lang="en" className="font-medium">
                  {w}
                </span>
                <span lang="en" className="text-[13px] text-muted-foreground">
                  · {o}
                </span>
                {r && (r.ok ? <CircleCheck className="ml-auto size-4 text-ok" /> : <XCircle className="ml-auto size-4 text-warn" />)}
              </li>
            );
          })}
        </ol>
      </div>

      {pair && (
        <div className="flex flex-col items-center rounded-2xl border border-brand/40 bg-accent/50 p-6 text-center">
          <p className="text-[13px] text-muted-foreground">{fill(t("coach.progress"), { n: String(i + 1), total: String(list.length) })}</p>
          <p lang="en" className="mt-4 text-6xl font-semibold tracking-[-0.03em]">
            {pair[0]}
          </p>
          <p className="mt-2 text-[14px] text-muted-foreground">{fill(t("coach.notOther"), { other: pair[1] })}</p>

          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <Button variant="outline" className="h-12 gap-2 rounded-full bg-card px-5 text-[15px]" onClick={() => void speak(pair[0], VOICE, 0.9)}>
              <Volume2 /> {t("coach.hear")}
            </Button>
            <Button variant="ghost" className="h-12 gap-2 rounded-full px-4 text-[15px]" onClick={() => void speak(pair[0], VOICE, 0.55)}>
              <Snail /> {t("coach.slow")}
            </Button>
            <Button className="h-12 gap-2 rounded-full px-6 text-[15px]" onClick={() => void sayWord()} disabled={busy || !canListen() || last?.verdict === "right" || tries >= MAX_TRIES}>
              {busy ? <Loader2 className="animate-spin" /> : <Mic />} {busy ? t("coach.listening") : t("coach.say")}
            </Button>
          </div>

          {last && (
            <div role="status" className={cn("mt-6 w-full rounded-xl px-4 py-3 text-left text-[14px]", last.verdict === "right" ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn")}>
              <p className="flex items-center gap-2 font-semibold">
                {last.verdict === "right" ? <CircleCheck className="size-5" /> : <XCircle className="size-5" />}
                {t(`coach.result.${last.verdict}` as TKey)}
              </p>
              {last.heard && (
                <p className="mt-1 text-foreground">
                  {t("coach.heard")} <span lang="en">“{last.heard}”</span>
                </p>
              )}
              {last.verdict !== "right" && (
                <p className="mt-1 text-foreground">{tries < MAX_TRIES ? fill(t("coach.triesLeft"), { word: pair[0], n: String(MAX_TRIES - tries) }) : t("coach.noMoreTries")}</p>
              )}
            </div>
          )}
          {errorBox}

          <div className="mt-auto flex flex-wrap justify-center gap-2 pt-6">
            {replay}
            {last?.verdict !== "right" && (
              <Button variant="ghost" className="h-11 text-[15px]" onClick={() => nextWord(false)}>
                {tries >= MAX_TRIES ? t("coach.next") : t("coach.skip")}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
