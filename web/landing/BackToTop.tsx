// A small "back to top" button that appears once you have scrolled past the first screen.
// On phones it shows only while you scroll back up (or at the very bottom), so it never sits on
// top of what you are reading.
import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { COPY, pick, useLang } from "./copy";

export function BackToTop() {
  const lang = useLang();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const past = y > window.innerHeight * 0.9;
      if (wide.matches) setShown(past);
      else {
        const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 80;
        if (Math.abs(y - lastY) > 8 || atEnd) setShown(past && (y < lastY || atEnd));
      }
      if (Math.abs(y - lastY) > 8) lastY = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const label = pick(COPY.backToTop, lang);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      onClick={() => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
        document.getElementById("top")?.focus({ preventScroll: true });
      }}
      className={cn(
        "fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 grid size-12 place-items-center rounded-full border border-pill-edge bg-pill text-white shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md transition-[opacity,transform] duration-300 hover:-translate-y-0.5 active:scale-95 sm:right-6 sm:bottom-6",
        shown ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <ArrowUp aria-hidden className="size-5" />
    </button>
  );
}
