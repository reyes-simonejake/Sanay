// "Who it's for": a list of communities where the chosen one lights up, beside a portrait drawn in points of
// light (after the Phantom studio's point-cloud team section). The points are sampled from a real photograph
// of someone from that community and flow into the next portrait when the choice changes.
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { COMMUNITIES, COPY, pick, useLang } from "./copy";
import { PHOTOS } from "./photos";

export function WhoItsFor() {
  const lang = useLang();
  const [active, setActive] = useState(0);
  const c = COMMUNITIES[active]!;
  return (
    <section id="who" aria-labelledby="who-title" className="scroll-mt-4 py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <h2 id="who-title" className="text-[clamp(1.9rem,3.4vw,2.75rem)] leading-[1.1] font-semibold font-display tracking-[-0.03em]">
          {pick(COPY.whoTitle, lang)}
        </h2>
        <div className="mt-10 grid items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
          <DotPortrait photoKey={c.photo} label={pick(PHOTOS[c.photo].alt, lang)} />
          <div>
            <ul className="space-y-0.5">
              {COMMUNITIES.map((item, i) => {
                const on = i === active;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setActive(i)}
                      onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
                      onFocus={() => setActive(i)}
                      className={cn(
                        "text-left text-[clamp(1.75rem,4.2vw,3.25rem)] leading-[1.08] font-semibold font-display tracking-[-0.03em] transition-colors duration-300",
                        on ? "text-foreground" : "text-foreground/25 hover:text-foreground/55",
                      )}
                    >
                      {pick(item.name, lang)}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p aria-live="polite" className="mt-8 min-h-[3.4em] max-w-[34rem] text-[17px] leading-relaxed text-muted-foreground">
              {pick(c.body, lang)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

interface Pt {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  r: number;
}

const COUNT = 4200;

/** Samples a photograph into points: brighter areas get more points, and come forward. */
async function sample(src: string): Promise<{ x: number; y: number; z: number }[] | null> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const W = 150;
  const H = 175;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  // Cover-fit, biased to the top, where faces are.
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  g.drawImage(img, (W - dw) / 2, Math.min(0, (H - dh) * 0.2), dw, dh);
  let data: Uint8ClampedArray;
  try {
    data = g.getImageData(0, 0, W, H).data;
  } catch {
    return null;
  }
  const L = new Float32Array(W * H);
  // Warmth: skin, lips and most clothes are warm; studio backdrops, walls and sky are grey or cool.
  const warm = new Float32Array(W * H);
  let mean = 0;
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 4]! / 255;
    const gr = data[i * 4 + 1]! / 255;
    const b = data[i * 4 + 2]! / 255;
    mean += L[i] = 0.3 * r + 0.59 * gr + 0.11 * b;
    warm[i] = Math.min(1, Math.max(0, (r - b) * 3.2));
  }
  mean /= W * H;
  const at = (x: number, y: number) => L[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))]!;
  // Where to put light: on edges (eyes, mouth, hairline, collar) and on areas brighter than the photo's
  // average, so a face reads even against a pale studio backdrop.
  const weight = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      const i = y * W + x;
      const edge = Math.min(1, Math.hypot(gx, gy) * 1.4);
      // Light falls on the warm, lit parts of the person; edges draw the features and the outline.
      weight[i] = Math.min(1, edge * 0.55 + warm[i]! * (0.35 + L[i]!) * 0.75);
    }
  const out: { x: number; y: number; z: number }[] = [];
  let guard = 0;
  while (out.length < COUNT && guard++ < COUNT * 60) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const i = Math.floor(y) * W + Math.floor(x);
    // Soft oval mask keeps the portrait centred and lets the edges dissolve.
    const dx = (x / W - 0.5) / 0.5;
    const dy = (y / H - 0.45) / 0.55;
    const mask = Math.max(0, 1 - (dx * dx + dy * dy) ** 1.6);
    if (Math.random() < weight[i]! * mask) out.push({ x: x / W - 0.5, y: y / H - 0.5, z: (L[i]! - mean) * 0.4 + warm[i]! * 0.12 });
  }
  return out.length > 200 ? out : null;
}

function DotPortrait({ photoKey, label }: { photoKey: keyof typeof PHOTOS; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pts = useRef<Pt[]>([]);
  const [failed, setFailed] = useState(false);

  // Sample the photograph and send every point to its new place.
  useEffect(() => {
    let live = true;
    void sample(PHOTOS[photoKey].src(480)).then((targets) => {
      if (!live) return;
      if (!targets) return setFailed(true);
      setFailed(false);
      const list = pts.current;
      for (let i = 0; i < COUNT; i++) {
        const t = targets[i % targets.length]!;
        const p = list[i];
        if (p) Object.assign(p, { tx: t.x, ty: t.y, tz: t.z });
        else list.push({ x: (Math.random() - 0.5) * 1.4, y: (Math.random() - 0.5) * 1.4, z: 0, tx: t.x, ty: t.y, tz: t.z, r: Math.random() });
      }
    });
    return () => {
      live = false;
    };
  }, [photoKey]);

  useEffect(() => {
    const cv = canvas.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let visible = false;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = cv.clientWidth * dpr;
      cv.height = cv.clientHeight * dpr;
    };
    const draw = (now: number) => {
      const W = cv.width;
      const H = cv.height;
      const size = Math.min(W, H * 0.86);
      const ink = getComputedStyle(cv).color;
      g.clearRect(0, 0, W, H);
      g.fillStyle = ink;
      const still = reduced.matches;
      const turn = still ? 0 : Math.sin(now / 2600) * 0.32;
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      const ease = still ? 1 : 0.075;
      const dot = Math.max(1.2, size / 300);
      for (const p of pts.current) {
        p.x += (p.tx - p.x) * ease;
        p.y += (p.ty - p.y) * ease;
        p.z += (p.tz - p.z) * ease;
        const x = p.x * cos + p.z * sin;
        const z = -p.x * sin + p.z * cos;
        const persp = 1 / (1 - z * 0.6);
        g.globalAlpha = 0.5 + 0.5 * Math.min(1, Math.max(0, 0.6 + z * 2.2));
        const r = dot * (0.7 + p.r * 0.7) * persp;
        g.fillRect(W / 2 + x * size * persp - r / 2, H / 2 + p.y * size * 1.08 * persp - r / 2, r, r);
      }
      g.globalAlpha = 1;
      if (visible) raf = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(draw);
    });
    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    io.observe(cv);
    resize();
    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [failed]);

  return (
    <div className="relative mx-auto aspect-[5/6] w-full max-w-[460px]">
      {failed ? (
        <img src={PHOTOS[photoKey].src(560)} alt={label} className="size-full rounded-2xl object-cover grayscale" />
      ) : (
        <canvas ref={canvas} role="img" aria-label={label} className="size-full text-foreground" />
      )}
    </div>
  );
}
