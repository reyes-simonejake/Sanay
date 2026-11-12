import { useEffect, useState } from "react";

/**
 * The opening moment: a ring of light draws itself (the app's "off" ring), blooms into the orb,
 * and the wordmark settles in. Pure CSS/SVG, so it shows instantly, before WebGL or data load.
 * Stays at least `minMs`, then dissolves once `ready`.
 */
export function Splash({ ready, minMs = 900 }: { ready: boolean; minMs?: number }) {
  const [elapsed, setElapsed] = useState(false);
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");
  useEffect(() => {
    const id = window.setTimeout(() => setElapsed(true), minMs);
    return () => window.clearTimeout(id);
  }, [minMs]);
  useEffect(() => {
    if (ready && elapsed && phase === "in") {
      setPhase("out");
      const id = window.setTimeout(() => setPhase("gone"), 520);
      return () => window.clearTimeout(id);
    }
  }, [ready, elapsed, phase]);
  if (phase === "gone") return null;

  return (
    <div className="splash" data-phase={phase} role="status" aria-live="polite" aria-label="Sanay">
      <svg viewBox="0 0 120 120" className="splash-mark" aria-hidden>
        <defs>
          <radialGradient id="splash-core" cx="50%" cy="72%" r="62%">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.45" stopColor="#b9c4ff" />
            <stop offset="1" stopColor="#5b5fe8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="splash-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7fd8ff" />
            <stop offset="0.5" stopColor="#8f9bff" />
            <stop offset="1" stopColor="#c58bff" />
          </linearGradient>
        </defs>
        <circle className="splash-core" cx="60" cy="60" r="34" fill="url(#splash-core)" />
        <circle className="splash-ring" cx="60" cy="60" r="44" fill="none" stroke="url(#splash-ring)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="splash-word">Sanay</span>
    </div>
  );
}
