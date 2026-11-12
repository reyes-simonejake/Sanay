// Say it in English: speak (or type) Filipino / Taglish, get an English line to read out in your
// own voice. Free, no account or key: speech to text is Chrome's built-in recognition (Google hears
// the audio) and the English comes from MyMemory, a free translation service (the text only).
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, RotateCcw, Square, Volume2 } from "lucide-react";
import { useT, type TKey } from "../../src/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Orb } from "../../src/components/Orb";

/* Chrome's speech recognition is not in TypeScript's DOM types yet. */
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;
const SpeechRecognition: RecognitionCtor | undefined =
  (window as unknown as { SpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;

type State = "idle" | "listening" | "working" | "done" | "error";

const ERROR_CODES = ["offline", "limit", "empty", "not-allowed", "no-speech", "audio-capture", "network"];
/** The message for an error code, in the chosen language. */
const errorKey = (code: string): TKey => (ERROR_CODES.includes(code) ? (`english.err.${code}` as TKey) : "english.err.other");

/** Free translation, called straight from the browser (no key, no Sanay server). */
async function translate(text: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?langpair=tl|en&q=${encodeURIComponent(text)}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("offline");
  }
  const body = (await res.json().catch(() => null)) as { responseStatus?: number | string; responseData?: { translatedText?: string } } | null;
  const status = Number(body?.responseStatus);
  if (status === 429 || res.status === 429) throw new Error("limit");
  const english = body?.responseData?.translatedText?.trim() ?? "";
  // On errors the service puts its own message in the text field, in capitals.
  if (!res.ok || status !== 200 || !english || /^[A-Z0-9 .,'!-]{12,}$/.test(english)) throw new Error("empty");
  return english;
}

function speak(text: string) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  const voice = synth.getVoices().find((v) => v.lang === "en-US") ?? synth.getVoices().find((v) => v.lang.startsWith("en"));
  if (voice) u.voice = voice;
  u.rate = 0.92;
  synth.speak(u);
}

function usePulse(active: boolean) {
  const [level, setLevel] = useState(0.15);
  useEffect(() => {
    if (!active) {
      setLevel(0.15);
      return;
    }
    let raf = 0;
    const tick = (t: number) => {
      setLevel(0.3 + 0.35 * Math.abs(Math.sin(t / 300) * Math.sin(t / 970)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return level;
}

/** `bare`: no title (the page around it already has one). */
export function SayInEnglish({ bare = false }: { bare?: boolean }) {
  const { t } = useT();
  const [state, setState] = useState<State>("idle");
  const [said, setSaid] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState<TKey>("english.err.other");
  const rec = useRef<Recognition | null>(null);
  const finalText = useRef("");
  const stateRef = useRef<State>("idle");
  stateRef.current = state;
  const level = usePulse(state === "listening" || state === "working");

  useEffect(() => () => rec.current?.abort(), []);

  const run = async (text: string) => {
    const t = text.trim();
    if (!t) {
      setState("idle");
      return;
    }
    setState("working");
    try {
      setResult(await translate(t));
      setState("done");
    } catch (e) {
      setError(errorKey((e as Error).message));
      setState("error");
    }
  };

  const start = () => {
    if (!SpeechRecognition) return;
    window.speechSynthesis?.cancel();
    const r = new SpeechRecognition();
    r.lang = "fil-PH"; // Filipino, and it copes with Taglish
    r.interimResults = true;
    r.continuous = true;
    finalText.current = "";
    setSaid("");
    setResult("");
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) finalText.current += res[0].transcript + " ";
        else interim += res[0].transcript;
      }
      setSaid((finalText.current + interim).trim());
    };
    r.onerror = (e) => {
      if (e.error === "aborted") return;
      stateRef.current = "error"; // onend follows right away; don't translate after an error
      setError(errorKey(e.error));
      setState("error");
    };
    r.onend = () => {
      rec.current = null;
      // Ended normally (not by an error): turn what was heard into English.
      if (stateRef.current === "listening") void run(finalText.current);
    };
    rec.current = r;
    r.start();
    setState("listening");
  };

  const stop = () => rec.current?.stop();

  const listening = state === "listening";
  const working = state === "working";

  return (
    <div className="@container">
      {!bare && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold tracking-[-0.01em]">{t("english.title")}</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">{t("english.body")}</p>
        </div>
      )}

      {/* Wide: speak on the left, your English on the right. Narrow: one column. */}
      <div className="grid gap-6 @2xl:grid-cols-2 @2xl:gap-8">
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-6">
            <button
              onClick={listening ? stop : start}
              disabled={!SpeechRecognition || working}
              aria-label={listening ? t("english.stop") : t("english.start")}
              className="group relative aspect-square w-36 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <Orb on={listening || working} voice="natural" level={level} className="absolute inset-0 size-full" />
              <span
                className={cn(
                  "absolute inset-0 m-auto grid size-14 place-items-center rounded-full shadow-lg transition-transform group-active:scale-95",
                  listening ? "bg-destructive text-white" : "bg-primary text-primary-foreground",
                )}
              >
                {working ? <Loader2 className="animate-spin" /> : listening ? <Square className="size-4 fill-current" /> : <Mic />}
              </span>
            </button>
            <p className="text-center text-[14px] font-medium" aria-live="polite">
              {!SpeechRecognition ? t("english.noVoice") : listening ? t("english.listening") : working ? t("english.working") : t("english.tap")}
            </p>
          </div>

          <form
            className="rounded-2xl border border-border bg-card p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(said);
            }}
          >
            <label htmlFor="said" className="text-[13px] font-medium text-muted-foreground">
              {t("english.said")}
            </label>
            <textarea
              id="said"
              value={said}
              onChange={(e) => setSaid(e.target.value)}
              rows={3}
              maxLength={450}
              placeholder={t("english.placeholder")}
              className="mt-2 w-full resize-none bg-transparent text-[16px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
            />
            <div className="mt-2 flex justify-end">
              <Button type="submit" className="h-11 rounded-full px-5 text-[15px]" disabled={!said.trim() || listening || working}>
                {t("english.make")}
              </Button>
            </div>
          </form>
        </div>

        <div className="flex flex-col gap-5">
          {state === "error" && (
            <p role="alert" className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-[14px] text-warn">
              {t(error)}
            </p>
          )}

          {result && state === "done" ? (
            <div className="flex flex-1 flex-col rounded-2xl border border-brand/40 bg-accent/60 p-5 @2xl:p-6">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-accent-foreground">{t("english.result")}</p>
                <Button variant="ghost" className="-mr-2 h-10 gap-1.5 text-[14px]" onClick={() => speak(result)}>
                  <Volume2 className="size-4" /> {t("english.hear")}
                </Button>
              </div>
              <p lang="en" className="mt-2 text-[clamp(1.25rem,2.4vw,1.6rem)] leading-snug font-semibold tracking-[-0.01em]">
                “{result}”
              </p>
              <p className="mt-3 text-[13px] text-muted-foreground">{t("english.readTip")}</p>
              <div className="mt-auto pt-5">
                <Button
                  variant="outline"
                  className="h-11 rounded-full bg-card px-5 text-[15px]"
                  onClick={() => {
                    setSaid("");
                    setResult("");
                    setState("idle");
                  }}
                >
                  <RotateCcw /> {t("english.again")}
                </Button>
              </div>
            </div>
          ) : (
            state !== "error" && (
              <div className="flex flex-1 flex-col justify-center rounded-2xl border border-dashed border-border p-6 text-center">
                <p className="text-[13px] font-medium text-muted-foreground">{t("english.result")}</p>
                <p className="mt-2 text-[15px] text-muted-foreground">{t("english.empty")}</p>
              </div>
            )
          )}

          <p className="text-[12px] leading-relaxed text-muted-foreground">{t("english.privacy")}</p>
        </div>
      </div>
    </div>
  );
}
