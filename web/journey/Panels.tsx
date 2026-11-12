// The product screens shown in the journey chapters: the score after a practice call, and a real video
// call with Sanay's pill switching the noise off. (The practice call itself is landing/CallPreview.)
import { useEffect, useState } from "react";
import { Lightbulb, Play, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { COPY, pick, useLang } from "../landing/copy";
import type { VoiceType } from "../audio/webEngine";

export function ScorePanel({ run }: { run: boolean }) {
  const lang = useLang();
  const s = COPY.score;
  const target = 82;
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(target);
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 1500);
      setN(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run]);
  const r = 46;
  const len = 2 * Math.PI * r;
  return (
    <div className="panel w-[420px] max-w-full p-6">
      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <span className="font-medium text-foreground">{pick(s.title, lang)}</span>
        <span>{pick(s.done, lang)}</span>
      </div>
      <div className="mt-5 flex items-center gap-6">
        <div className="relative grid shrink-0 place-items-center">
          <svg viewBox="0 0 120 120" className="size-[118px] -rotate-90">
            <circle cx="60" cy="60" r={r} className="score-track" />
            <circle cx="60" cy="60" r={r} className="score-fill" style={{ ["--light" as string]: "var(--brand)" }} strokeDasharray={len} strokeDashoffset={len * (1 - n / 100)} />
          </svg>
          <span className="font-display absolute text-[34px] font-semibold tracking-[-0.03em] tabular-nums">{n}</span>
        </div>
        <div>
          <p className="font-display text-[26px] leading-none font-semibold">{pick(s.ready, lang)}</p>
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">{pick(s.goodBody, lang)}</p>
        </div>
      </div>
      <div className="mt-5 space-y-3 border-t border-border pt-5 text-[14px]">
        <p className="flex gap-3">
          <ThumbsUp aria-hidden className="mt-0.5 size-4 shrink-0 text-ok" />
          <span>
            <span className="block text-[12px] text-muted-foreground">{pick(s.good, lang)}</span>
            {pick(s.goodBody, lang)}
          </span>
        </p>
        <p className="flex gap-3">
          <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
          <span>
            <span className="block text-[12px] text-muted-foreground">{pick(s.next, lang)}</span>
            {pick(s.nextBody, lang)}
          </span>
        </p>
      </div>
      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-foreground/[0.05] p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background">
          <Play aria-hidden className="size-4 translate-x-px" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] text-muted-foreground">{pick(s.replay, lang)}</span>
          <span aria-hidden className="replay-wave mt-1.5 flex h-5 items-center gap-[2px]">
            {Array.from({ length: 40 }, (_, i) => (
              <i key={i} style={{ height: `${25 + 70 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23))}%` }} className={cn(i > 14 && i < 22 && "hot")} />
            ))}
          </span>
        </span>
      </div>
    </div>
  );
}

/** A video call: your tile's sound is noisy until Sanay's pill turns on, then only your voice is left. */
export function RealCallPanel({ voice }: { voice: VoiceType }) {
  const lang = useLang();
  const m = COPY.meet;
  const N = 30;
  const noisy = Array.from({ length: N }, (_, i) => 0.25 + 0.75 * Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1));
  const clean = Array.from({ length: N }, (_, i) => 0.12 + 0.8 * Math.sin((i / N) * Math.PI * 3.2) ** 2);
  return (
    <div className="panel meet w-[520px] max-w-full p-3">
      <div className="flex items-center gap-1.5 px-2 pt-1 pb-3 text-[12px] text-muted-foreground">
        <i className="size-2.5 rounded-full bg-foreground/20" />
        <i className="size-2.5 rounded-full bg-foreground/20" />
        <i className="size-2.5 rounded-full bg-foreground/20" />
        <span className="ml-2">{pick(m.title, lang)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="meet-tile">
          <span className="meet-avatar">MS</span>
          <span className="meet-name">{pick(m.them, lang)}</span>
        </div>
        <div className="meet-tile meet-you" style={{ ["--light" as string]: `var(--voice-${voice})` }}>
          <div className="clean !w-[80%] !h-[56px]">
            <div className="clean-layer clean-noisy">
              {noisy.map((h, i) => (
                <span key={i} style={{ height: `${h * 100}%` }} />
              ))}
            </div>
            <div className="clean-layer clean-voice">
              {clean.map((h, i) => (
                <span key={i} style={{ height: `${h * 100}%` }} />
              ))}
            </div>
            <span className="clean-scan" />
          </div>
          <span className="meet-name">{pick(m.you, lang)}</span>
          <span className="meet-noise">{pick(m.noise, lang)}</span>
          <span className="meet-clean">{pick(m.clean, lang)}</span>
        </div>
      </div>
      {/* Sanay's floating pill, switching on in step with the sweep. */}
      <div className="meet-pill">
        <span className="meet-pill-dot" style={{ ["--light" as string]: `var(--voice-${voice})` }} />
        <span className="font-semibold">On</span>
        <span className="text-white/70">Sanay</span>
      </div>
    </div>
  );
}
