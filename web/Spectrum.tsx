import { useEffect, useRef } from "react";

const F_MIN = 60;
const F_MAX = 12_000;
const DB_MIN = -100;
const DB_MAX = -20;

/**
 * Overlaid live spectra: the raw mic (grey area) and Sanay's output (teal line).
 * The gap between them is the noise Sanay removes.
 */
export function Spectrum({ raw, clean, label }: { raw: AnalyserNode; clean: AnalyserNode; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current!;
    const g = c.getContext("2d")!;
    const rawBuf = new Float32Array(raw.frequencyBinCount);
    const cleanBuf = new Float32Array(clean.frequencyBinCount);
    const nyquist = raw.context.sampleRate / 2;
    let frame = 0;

    const draw = () => {
      frame = requestAnimationFrame(draw);
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      const style = getComputedStyle(c);
      const grid = style.getPropertyValue("--spec-grid");
      const rawFill = style.getPropertyValue("--spec-raw");
      const cleanStroke = style.getPropertyValue("--spec-clean");
      const text = style.getPropertyValue("--spec-text");

      // Frequency grid (log scale)
      g.strokeStyle = grid;
      g.fillStyle = text;
      g.lineWidth = 1;
      g.font = "11px system-ui, sans-serif";
      const xOf = (f: number) => (Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN)) * w;
      for (const f of [100, 250, 500, 1000, 2000, 4000, 8000]) {
        const x = Math.round(xOf(f)) + 0.5;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, h - 16);
        g.stroke();
        g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x + 3, h - 4);
      }

      raw.getFloatFrequencyData(rawBuf);
      clean.getFloatFrequencyData(cleanBuf);
      const yOf = (db: number) => {
        const v = (Math.max(DB_MIN, Math.min(DB_MAX, db)) - DB_MIN) / (DB_MAX - DB_MIN);
        return (h - 16) * (1 - v);
      };
      // One point per pixel column, taking the max bin in the column's frequency span.
      const path = (buf: Float32Array) => {
        const pts: [number, number][] = [];
        for (let x = 0; x <= w; x += 2) {
          const f0 = F_MIN * Math.pow(F_MAX / F_MIN, x / w);
          const f1 = F_MIN * Math.pow(F_MAX / F_MIN, (x + 2) / w);
          const b0 = Math.floor((f0 / nyquist) * buf.length);
          const b1 = Math.max(b0 + 1, Math.floor((f1 / nyquist) * buf.length));
          let m = -Infinity;
          for (let b = b0; b < b1 && b < buf.length; b++) m = Math.max(m, buf[b]);
          pts.push([x, yOf(m)]);
        }
        return pts;
      };

      const rp = path(rawBuf);
      g.fillStyle = rawFill;
      g.beginPath();
      g.moveTo(0, h - 16);
      for (const [x, y] of rp) g.lineTo(x, y);
      g.lineTo(w, h - 16);
      g.closePath();
      g.fill();

      const cp = path(cleanBuf);
      g.strokeStyle = cleanStroke;
      g.lineWidth = 2;
      g.lineJoin = "round";
      g.beginPath();
      cp.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [raw, clean]);

  return <canvas ref={canvas} className="spectrum h-44 w-full" role="img" aria-label={label} />;
}
