// The hero's picture: a practice call, laid out like a phone call screen (caller, timer, controls).
// The orb is the other person, played by Sanay. The voice meter is the visitor's turn to talk, and it
// follows their real mic level while "Test your voice" is on.
import { useEffect, useState } from "react";
import { Captions, Mic, PhoneOff } from "lucide-react";
import { Orb } from "../../src/components/Orb";
import type { VoiceType } from "../audio/webEngine";
import { COPY, pick, useLang } from "./copy";

const BARS = 21;

export function CallPreview({ voice, level }: { voice: VoiceType; level: number }) {
  const lang = useLang();
  const c = COPY.call;
  const [secs, setSecs] = useState(134);
  useEffect(() => {
    const id = window.setInterval(() => setSecs((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const time = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <figure aria-label={pick(c.label, lang)} className="call-card relative w-full max-w-[400px] overflow-hidden rounded-[32px] px-6 pt-5 pb-6">
      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <span className="flex items-center gap-2">
          <span aria-hidden className="call-live size-1.5 rounded-full bg-ok" />
          {pick(c.title, lang)}
        </span>
        <span className="tabular-nums" aria-hidden>
          {time}
        </span>
      </div>

      <div className="relative mx-auto mt-2 aspect-square w-[78%]" style={{ viewTransitionName: "orb" }}>
        <Orb on silk voice={voice} level={level} className="absolute inset-0 size-full" />
      </div>

      <div className="-mt-2 text-center">
        <p className="font-display text-[26px] leading-tight font-semibold tracking-[-0.02em]">{pick(c.topic, lang)}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">{pick(c.them, lang)}</p>
      </div>

      {/* Your turn: a voice meter that breathes on its own and follows the mic when it is on. */}
      <div className="mt-6 flex flex-col items-center gap-2">
        <div aria-hidden className="call-meter flex h-8 items-center gap-[3px]" style={{ ["--lvl" as string]: String(Math.min(1, level * 1.6)) }}>
          {Array.from({ length: BARS }, (_, i) => (
            <span key={i} style={{ animationDelay: `${(i * 97) % 900}ms`, ["--h" as string]: String(0.35 + 0.65 * Math.sin((i / (BARS - 1)) * Math.PI)) }} />
          ))}
        </div>
        <p className="text-[12px] text-muted-foreground">{pick(c.yourTurn, lang)}</p>
      </div>

      <div aria-hidden className="mt-6 grid grid-cols-3 justify-items-center">
        <CallButton label={pick(c.mute, lang)}>
          <Mic className="size-[18px]" />
        </CallButton>
        <CallButton label={pick(c.captions, lang)}>
          <Captions className="size-[18px]" />
        </CallButton>
        <CallButton label={pick(c.end, lang)} end>
          <PhoneOff className="size-[18px]" />
        </CallButton>
      </div>
    </figure>
  );
}

function CallButton({ label, end, children }: { label: string; end?: boolean; children: React.ReactNode }) {
  return (
    <span className="flex flex-col items-center gap-1.5">
      <span className={end ? "call-btn call-btn-end" : "call-btn"}>{children}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </span>
  );
}
