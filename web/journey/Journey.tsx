// The home page's scroll journey, in the Sellix flow, over a 3D world that goes from night to sunrise:
// 1. Hero: a glowing planet with its land in points of light; the promise sits on its glow.
// 2-4. Pinned facts, "01 / 03": one big statement on the left, the particle shape in the middle (two voices,
//    the score ring, noise settling into a clean voice), a short paragraph on the right.
// 5. A ring of real Filipino photographs. 6. Sunrise: "Sanay ka na."
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowRight, Mic, Square } from "lucide-react";
import { useT, type TKey } from "../../src/i18n";
import { lockTheme, useTheme } from "../../src/lib/theme";
import type { VoiceLab } from "../useVoiceLab";
import { COPY, pick } from "../landing/copy";
import { CHAPTERS, clamp, journey } from "./store";
import "./journey.css";
import "./flow.css";

import { hasWebGL } from "../../src/lib/webgl";

const Scene = lazy(() => import("./Scene"));

function canDraw3D() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return hasWebGL();
}

const FACT_CHAPTERS = [1, 2, 3];

export function Journey({ lab, level, onStart }: { lab: VoiceLab; level: number; onStart: () => void }) {
  const { t, lang } = useT();
  const wrap = useRef<HTMLElement>(null);
  const { theme } = useTheme();
  const [active, setActive] = useState(0);
  const [three] = useState(canDraw3D);
  // The city lets go of its WebGL context once it is well off screen (phones only allow a few) and
  // comes back when you scroll up to it.
  const [near, setNear] = useState(true);
  useEffect(() => {
    const el = wrap.current;
    if (!el || !three) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [three]);
  const live = lab.phase === "live";

  journey.level = level;
  journey.voice = lab.voice;
  journey.theme = theme;

  useEffect(() => {
    lockTheme("dark");
    return () => lockTheme(null);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const el = wrap.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const a = clamp(-r.top / vh, 0, CHAPTERS - 1);
      journey.at = a;
      setActive(Math.round(a));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const go = (i: number) => {
    const el = wrap.current;
    if (!el) return;
    window.scrollTo({ top: el.offsetTop + i * window.innerHeight, behavior: "smooth" });
  };

  const ch = COPY.chapters;
  const h = COPY.hero;
  const factOn = FACT_CHAPTERS.includes(active);
  const factIndex = factOn ? active - 1 : 0;

  return (
    <section ref={wrap} id="top" tabIndex={-1} aria-label="Sanay" className="journey relative outline-none" data-chapter={active} style={{ height: `${CHAPTERS * 100}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <div aria-hidden className="journey-backdrop absolute inset-0" />
        {three && near && (
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        )}

        {/* 2 to 4: the pinned facts. */}
        <div className="facts absolute inset-0" data-on={factOn || undefined}>
          <div className="mx-auto grid h-full max-w-6xl grid-rows-[auto_1fr_auto] px-5 pt-24 pb-10 sm:px-8">
            <p className="chapter-kicker">
              <span aria-hidden className="chapter-kicker-line" />
              {pick(COPY.steps.kicker, lang)}
            </p>
            <div className="relative">
              {COPY.facts.map((f, i) => (
                <div key={f.label.en} className="fact" data-on={(factOn && i === factIndex) || undefined} aria-hidden={!(factOn && i === factIndex)}>
                  <div className="fact-left">
                    <p className="font-display fact-big">{pick(f.big, lang)}</p>
                    <p className="fact-label">{pick(f.label, lang)}</p>
                  </div>
                  <div className="fact-right">
                    <p>{pick(f.body, lang)}</p>
                    <a href="#features" className="fact-link">
                      {pick(COPY.features.more, lang)} <ArrowRight aria-hidden className="size-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <div className="fact-pager" aria-hidden>
              <span className="tabular-nums">{String(factIndex + 1).padStart(2, "0")}</span>
              <span className="fact-track">
                <span style={{ width: `${((factIndex + 1) / 3) * 100}%` }} />
              </span>
              <span className="tabular-nums">03</span>
            </div>
          </div>
        </div>
      </div>

      <span id="ch-practice" aria-hidden className="absolute" style={{ top: "100vh" }} />

      <div className="pointer-events-none absolute inset-0 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
        {/* 1. Hero */}
        <div className="chapter absolute inset-x-0 top-0 h-screen" data-on={active === 0 || undefined} data-layout="hero">
          <div className="chapter-copy hero-copy mx-auto px-5 text-center">
            <h1 className="font-display hero-title">{pick(h.title, lang)}</h1>
            <p className="chapter-body mx-auto">{pick(h.body, lang)}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {live ? (
                <button type="button" onClick={lab.stop} className="journey-btn journey-btn-ghost">
                  <Square aria-hidden className="size-4" /> {t("web.stop")}
                </button>
              ) : (
                <button type="button" onClick={onStart} disabled={lab.phase === "loading"} className="journey-btn">
                  <Mic aria-hidden className="size-4" /> {lab.phase === "loading" ? t("web.starting") : t("web.hero.cta")}
                </button>
              )}
              <button type="button" onClick={() => go(1)} className="journey-btn journey-btn-ghost">
                {pick(COPY.navHow, lang)}
              </button>
            </div>
            {live && (
              <p className="mt-5 text-[13px] text-muted-foreground" aria-live="polite">
                {t(`web.verdict.${lab.verdict}` as TKey)}
              </p>
            )}
          </div>

          <p className="journey-hint">{pick(COPY.scrollHint, lang)}</p>
        </div>

        {/* 5 and 6: the photo ring, and sunrise. */}
        {[4, 5].map((i) => {
          const c = ch[i]!;
          return (
            <div key={c.id} id={`ch-${c.id}`} className="chapter absolute inset-x-0 h-screen" style={{ top: `${i * 100}vh` }} data-on={active === i || undefined} data-layout={i === 4 ? "low" : "center"}>
              <div className="chapter-inner mx-auto grid h-full max-w-6xl items-center px-5 sm:px-8">
                <div className="chapter-copy">
                  <p className="chapter-kicker">
                    <span aria-hidden className="chapter-kicker-line" />
                    {pick(c.rail, lang)}
                  </p>
                  <h2 className="font-display chapter-title">{pick(c.title, lang)}</h2>
                  <p className="chapter-body">{pick(c.body, lang)}</p>
                  {i === 5 && (
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                      <a href="#/signup" className="journey-btn">
                        {pick(COPY.signUp, lang)}
                      </a>
                      <button type="button" onClick={onStart} className="journey-btn journey-btn-ghost">
                        <Mic aria-hidden className="size-4" /> {t("web.hero.cta")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
