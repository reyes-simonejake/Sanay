// The sections after the journey. Each one tells the visitor one thing, with something to look at or try:
//  - "What call are you getting ready for?" (after Imagica's prompt): pick a call, see how it starts.
//  - "The noise stays out of the call" (after ArgusVPN's feature tiles): the sounds Sanay takes out.
//  - "Private by design" (after ArgusVPN's Data Protection): a glass sphere in 3D and two plain promises.
//  - "From your home to a call anywhere" (after the dotted globes of ArgusVPN and Dala): a 3D Earth.
//  - The closing call to action: Sanay's logo in 3D (after Sellix's ending) on a glowing grid floor.
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Bike, Bird, Check, CloudRain, Dog, Fan, Laptop, Mic, MicVocal, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "../../src/i18n";
import { useTheme } from "../../src/lib/theme";
import type { VoiceType } from "../audio/webEngine";
import { COPY, PACKS, pick } from "./copy";
import type { City } from "./three/Globe";
import "./sections.css";

import { hasWebGL } from "../../src/lib/webgl";

const Globe = lazy(() => import("./three/Globe"));
const Glass = lazy(() => import("./three/Glass"));
const LogoMark = lazy(() => import("./three/LogoMark"));

const VOICE_HEX = {
  dark: { masculine: "#3f6bff", feminine: "#a35cff", natural: "#c4ccd8" },
  light: { masculine: "#2d55f0", feminine: "#8b3ff0", natural: "#7c8799" },
};

/** Mounts its 3D child only while it is near the screen, and only where WebGL works.
 *  Leaving unmounts it, which hands its WebGL context back (phones only allow a few). */
function Near({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!hasWebGL()) return;
    const io = new IntersectionObserver(([e]) => setShow(e.isIntersecting), { rootMargin: "400px 0px" });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      {show && <Suspense fallback={null}>{children}</Suspense>}
    </div>
  );
}

function SectionHead({ title, body, center }: { title: string; body: string; center?: boolean }) {
  return (
    <div className={cn("max-w-[40rem]", center && "mx-auto text-center")}>
      <h2 className="font-display text-[clamp(2rem,3.8vw,3.1rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">{title}</h2>
      <p className="mt-4 text-[17px] leading-relaxed text-pretty text-muted-foreground">{body}</p>
    </div>
  );
}

/* ---- What call are you getting ready for? ---------------------------- */
export function CallPicker({ onTry }: { onTry: () => void }) {
  const { lang } = useT();
  const [i, setI] = useState(0);
  const p = PACKS[i]!;
  const c = COPY.picker;
  return (
    <section id="calls" aria-labelledby="calls-title" className="land-section land-glow scroll-mt-4">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-28 sm:px-8 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <div id="calls-title">
            <SectionHead title={pick(c.title, lang)} body={pick(c.body, lang)} />
          </div>
          <div className="picker-prompt mt-8" aria-live="polite">
            <span className="text-muted-foreground">{pick(c.prompt, lang)}</span>{" "}
            <span key={i} className="picker-typed font-semibold">
              {pick(p.title, lang).toLowerCase()}
            </span>
            <span aria-hidden className="picker-caret" />
          </div>
          <div role="radiogroup" aria-label={pick(c.title, lang)} className="mt-5 flex flex-wrap gap-2">
            {PACKS.map((pk, k) => (
              <button key={pk.title.en} type="button" role="radio" aria-checked={k === i} onClick={() => setI(k)} className="chip" data-on={k === i || undefined}>
                {pick(pk.title, lang)}
              </button>
            ))}
          </div>
        </div>

        <div className="picker-card" style={{ ["--light" as string]: `var(--voice-${p.voice})` }}>
          <div className="flex items-center justify-between text-[12px] text-muted-foreground">
            <span className="flex items-center gap-2">
              <span aria-hidden className="size-1.5 rounded-full bg-ok" />
              {pick(p.who, lang)}
            </span>
            <span>{pick(c.length, lang).replace("{n}", String(p.minutes))}</span>
          </div>
          <div className="mt-8 flex items-center gap-4">
            <span aria-hidden className="picker-orb" />
            <div>
              <p className="font-display text-[22px] leading-tight font-semibold tracking-[-0.02em]">{pick(p.title, lang)}</p>
              <p className="text-[13px] text-muted-foreground">{pick(c.who, lang)}</p>
            </div>
          </div>
          <blockquote key={i} className="picker-quote font-display">“{p.opener}”</blockquote>
          <div aria-hidden className="picker-wave">
            {Array.from({ length: 36 }, (_, k) => (
              <i key={k} style={{ animationDelay: `${(k * 83) % 900}ms`, height: `${30 + 60 * Math.abs(Math.sin(k * 0.6))}%` }} />
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" onClick={onTry} className="journey-btn">
              <Mic aria-hidden className="size-4" /> {pick(COPY.packsCta, lang)}
            </button>
            <span className="text-[13px] text-muted-foreground">{pick(c.soon, lang)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- The noise stays out --------------------------------------------- */
const NOISE_ICON = { tricycle: Bike, rooster: Bird, karaoke: MicVocal, rain: CloudRain, fan: Fan, dog: Dog } as const;

export function NoiseTiles() {
  const { lang } = useT();
  const n = COPY.noise;
  const [on, setOn] = useState(0);
  // One tile at a time shows its noise being taken out; hovering a tile shows that one.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setOn((k) => (k + 1) % n.items.length), 2600);
    return () => window.clearInterval(id);
  }, [n.items.length]);
  return (
    <section aria-labelledby="noise-title" className="land-section">
      <div className="mx-auto max-w-6xl px-5 py-28 sm:px-8">
        <div id="noise-title">
          <SectionHead title={pick(n.title, lang)} body={pick(n.body, lang)} center />
        </div>
        <ul className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {n.items.map((it, k) => {
            const Icon = NOISE_ICON[it.id as keyof typeof NOISE_ICON];
            return (
              <li key={it.id} className="noise-tile" data-on={k === on || undefined} onPointerEnter={() => setOn(k)}>
                <Icon aria-hidden className="size-6" />
                <span className="text-[14px] font-medium">{pick(it, lang)}</span>
                <span aria-hidden className="noise-bars">
                  {Array.from({ length: 14 }, (_, b) => (
                    <i key={b} style={{ ["--h" as string]: `${25 + 70 * Math.abs(Math.sin(b * 1.9 + k))}%` }} />
                  ))}
                </span>
                <span className="noise-done">
                  <Check aria-hidden className="size-3.5" /> {lang === "fil" ? "Natanggal" : "Removed"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ---- Private by design ------------------------------------------------ */
export function Privacy({ voice }: { voice: VoiceType }) {
  const { lang } = useT();
  const { theme } = useTheme();
  const pr = COPY.privacy;
  return (
    <section aria-labelledby="privacy-title" className="land-section land-glow">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-28 sm:px-8 lg:grid-cols-2">
        <Near className="privacy-stage">
          <Glass colour={VOICE_HEX[theme][voice]} day={theme === "light"} />
        </Near>
        <div>
          <div id="privacy-title">
            <SectionHead title={pick(pr.title, lang)} body={pick(pr.body, lang)} />
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <div className="land-card">
              <Laptop aria-hidden className="size-5 text-brand" />
              <p className="mt-4 text-[16px] font-semibold">{pick(pr.a, lang)}</p>
              <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground">{pick(pr.aBody, lang)}</p>
            </div>
            <div className="land-card">
              <ShieldCheck aria-hidden className="size-5 text-brand" />
              <p className="mt-4 text-[16px] font-semibold">{pick(pr.b, lang)}</p>
              <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground">{pick(pr.bBody, lang)}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- From your home to a call anywhere -------------------------------- */
const HOME: City = { name: "Manila", lat: 14.6, lon: 121 };
const CITIES: City[] = [
  { name: "Dubai", lat: 25.2, lon: 55.3 },
  { name: "Hong Kong", lat: 22.3, lon: 114.2 },
  { name: "Singapore", lat: 1.35, lon: 103.8 },
  { name: "Tokyo", lat: 35.7, lon: 139.7 },
  { name: "Sydney", lat: -33.9, lon: 151.2 },
  { name: "Toronto", lat: 43.7, lon: -79.4 },
  { name: "London", lat: 51.5, lon: -0.13 },
];

export function World({ voice }: { voice: VoiceType }) {
  const { lang } = useT();
  const { theme } = useTheme();
  const w = COPY.world;
  return (
    <section aria-labelledby="world-title" className="land-section">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-28 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div id="world-title">
          <SectionHead title={pick(w.title, lang)} body={pick(w.body, lang)} />
        </div>
        <Near className="world-stage">
          <Globe cities={CITIES} home={HOME} colour={VOICE_HEX[theme][voice === "natural" ? "masculine" : voice]} day={theme === "light"} />
        </Near>
      </div>
    </section>
  );
}

/* ---- Closing call to action ------------------------------------------- */
export function FinalCta({ voice, onTry }: { voice: VoiceType; onTry: () => void }) {
  const { lang, t } = useT();
  const f = COPY.final;
  return (
    <section aria-labelledby="final-title" className="land-section final">
      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-28 sm:px-8">
        <div id="final-title">
          <SectionHead title={pick(f.title, lang)} body={pick(f.body, lang)} center />
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={onTry} className="journey-btn">
            <Mic aria-hidden className="size-4" /> {t("web.hero.cta")}
          </button>
          <a href="#/signup" className="journey-btn journey-btn-ghost">
            {pick(COPY.signUp, lang)}
          </a>
        </div>
      </div>
      <div aria-hidden className="final-stage">
        <div className="final-floor" />
        <Near className="final-logo">
          <LogoMark colour={VOICE_HEX.dark[voice === "natural" ? "masculine" : voice]} />
        </Near>
      </div>
    </section>
  );
}
