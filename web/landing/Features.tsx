// "Everything for the call" (after Sellix's end-to-end features): alternating rows, each with a small label,
// a title, a line of text and a link, beside a real product screen, tilted toward the words. The real-call row
// shows how Sanay fits in (your mic, Sanay, the call app) as a flow with light running along the lines.
// Then "Sanay in numbers" (after Sellix's In Numbers): true facts only.
import { ArrowRight, AudioLines, Gauge, Languages, Mic, MonitorPlay, PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "../../src/i18n";
import type { VoiceType } from "../audio/webEngine";
import { RealCallPanel, ScorePanel } from "../journey/Panels";
import { CallPreview } from "./CallPreview";
import { COPY, pick } from "./copy";
import "./features.css";

const ROW_ICON = { practice: PhoneCall, score: Gauge, real: AudioLines, english: Languages } as const;

export function Features({ voice, onTry }: { voice: VoiceType; onTry: () => void }) {
  const { lang } = useT();
  const f = COPY.features;
  return (
    <section id="features" aria-labelledby="features-title" className="land-section land-glow scroll-mt-4">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-[44rem] text-center">
          <h2 id="features-title" className="font-display text-[clamp(2rem,3.8vw,3.1rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
            {pick(f.title, lang)}
          </h2>
          <p className="mt-4 text-[17px] text-muted-foreground">{pick(f.body, lang)}</p>
        </div>

        <div className="mt-14 space-y-20 lg:mt-20 lg:space-y-28">
          {f.rows.map((row, i) => {
            const Icon = ROW_ICON[row.id as keyof typeof ROW_ICON];
            const flip = i % 2 === 1;
            return (
              <article key={row.id} className="feature-row" data-flip={flip || undefined}>
                <div className="feature-copy">
                  <p className="feature-label">
                    <span className="feature-icon">
                      <Icon aria-hidden className="size-4" />
                    </span>
                    {pick(row.label, lang)}
                  </p>
                  <h3 className="font-display mt-5 text-[clamp(1.6rem,2.6vw,2.2rem)] leading-[1.1] font-semibold tracking-[-0.02em] text-balance">{pick(row.title, lang)}</h3>
                  <p className="mt-4 max-w-[30rem] text-[16px] leading-relaxed text-muted-foreground">{pick(row.body, lang)}</p>
                  <button type="button" onClick={onTry} className="fact-link">
                    {pick(f.more, lang)} <ArrowRight aria-hidden className="size-3.5" />
                  </button>
                </div>
                <div aria-hidden className={cn("feature-stage", flip && "feature-stage-flip")}>
                  {row.id === "practice" && <CallPreview voice={voice} level={0} />}
                  {row.id === "score" && <ScorePanel run />}
                  {row.id === "real" && <RealCallFlow voice={voice} />}
                  {row.id === "english" && <EnglishCard />}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Your mic → Sanay → the call app, with light running along the lines, above the call it produces. */
function RealCallFlow({ voice }: { voice: VoiceType }) {
  const { lang } = useT();
  const fl = COPY.features.flow;
  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-8">
      <div className="flow" style={{ ["--light" as string]: `var(--voice-${voice})` }}>
        <span className="flow-node">
          <Mic className="size-4" /> {pick(fl.mic, lang)}
        </span>
        <span className="flow-line" />
        <span className="flow-node flow-sanay">
          <span className="flow-orb" /> {pick(fl.sanay, lang)}
          <span className="flow-tag">{pick(fl.clean, lang)}</span>
        </span>
        <span className="flow-line" />
        <span className="flow-node">
          <MonitorPlay className="size-4" /> {pick(fl.apps, lang)}
        </span>
      </div>
      <RealCallPanel voice={voice} />
    </div>
  );
}

/** What you said in Taglish, and the English to say instead, simple and formal. */
function EnglishCard() {
  const { lang } = useT();
  const e = COPY.features.english;
  return (
    <div className="panel english w-[460px] max-w-full p-6">
      <p className="text-[12px] text-muted-foreground">{lang === "fil" ? "Sinabi mo" : "You said"}</p>
      <p className="mt-2 text-[17px] leading-snug font-medium">{pick(e.said, lang)}</p>
      <div className="english-branch" aria-hidden />
      <div className="grid gap-3">
        <div className="english-out">
          <span className="english-tag">{pick(e.simpleLabel, lang)}</span>
          <p>{pick(e.simple, lang)}</p>
        </div>
        <div className="english-out">
          <span className="english-tag english-tag-formal">{pick(e.formalLabel, lang)}</span>
          <p>{pick(e.formal, lang)}</p>
        </div>
      </div>
    </div>
  );
}

export function Numbers() {
  const { lang } = useT();
  const n = COPY.numbers;
  return (
    <section aria-labelledby="numbers-title" className="land-section">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <h2 id="numbers-title" className="font-display text-[clamp(1.8rem,3vw,2.5rem)] font-semibold tracking-[-0.03em]">
          {pick(n.title, lang)}
        </h2>
        <dl className="numbers mt-12">
          {n.items.map((it) => (
            <div key={it.label.en} className="number">
              <dt className="order-2 mt-2 text-[14px] leading-snug text-muted-foreground">{pick(it.label, lang)}</dt>
              <dd className="font-display order-1 text-[clamp(2.6rem,4.5vw,3.8rem)] leading-none font-semibold tracking-[-0.04em] tabular-nums">{it.n}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
