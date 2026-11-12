import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { OrbRenderer, type OrbVoice } from "../lib/orb";
import { useTheme } from "../lib/theme";

/**
 * The living orb. `level` is 0..1 (the live voice). Renders with WebGL; if WebGL is unavailable
 * it falls back to a still gradient so the state is never lost.
 */
export function Orb({
  on,
  voice,
  level,
  silk = false,
  className,
}: {
  on: boolean;
  voice: OrbVoice;
  level: number;
  /** Silk lines of light behind the orb (for large, hero-sized orbs). */
  silk?: boolean;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<OrbRenderer | null>(null);
  const [fallback, setFallback] = useState(false);
  const { theme } = useTheme();
  const latest = useRef({ on, voice, level });
  const silkRef = useRef(silk);
  silkRef.current = silk;
  latest.current = { on, voice, level };

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    let r: OrbRenderer | null = null;
    try {
      r = OrbRenderer.create(c);
    } catch (e) {
      console.warn("[orb] WebGL unavailable, using the still fallback:", e);
      r = null;
    }
    if (!r) {
      setFallback(true);
      return;
    }
    renderer.current = r;
    r.target = latest.current;
    r.silk = silkRef.current;
    if (import.meta.env.DEV) (window as unknown as { __orb?: OrbRenderer }).__orb = r; // screenshot checks step frames by hand
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      r!.light = document.documentElement.dataset.theme === "light";
      r!.reducedMotion = motion.matches;
    };
    sync();
    motion.addEventListener("change", sync);
    // Only animate while visible.
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? r!.run() : r!.stop()));
    io.observe(c);
    const onVis = () => (document.hidden ? r!.stop() : r!.run());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      motion.removeEventListener("change", sync);
      r!.destroy();
      renderer.current = null;
    };
  }, []);

  useEffect(() => {
    if (renderer.current) renderer.current.target = { on, voice, level };
  }, [on, voice, level]);
  useEffect(() => {
    if (renderer.current) renderer.current.light = theme === "light";
  }, [theme]);

  if (fallback) {
    return (
      <div
        aria-hidden
        className={cn("rounded-full", className)}
        style={{
          background: on
            ? `radial-gradient(circle at 50% 70%, #fff 0%, var(--voice-${voice}) 45%, transparent 70%)`
            : "radial-gradient(circle, transparent 52%, var(--input) 54%, transparent 57%)",
        }}
      />
    );
  }
  return <canvas ref={canvas} aria-hidden className={cn("block", className)} />;
}
