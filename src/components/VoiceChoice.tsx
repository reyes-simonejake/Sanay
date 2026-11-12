import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { useT, type TKey } from "../i18n";
import type { VoiceType } from "../lib/api";

const VOICES: VoiceType[] = ["masculine", "feminine", "natural"];

/** The voice option's rules are shown once, before the first masculine or feminine voice. */
const NOTICE_KEY = "sanay.voiceNotice.accepted";
const accepted = () => {
  try {
    return localStorage.getItem(NOTICE_KEY) === "1";
  } catch {
    return false;
  }
};
const RULES: TKey[] = ["voiceNotice.r1", "voiceNotice.r2", "voiceNotice.r3", "voiceNotice.r4"];

/** Three tiles side by side; each carries its voice's light. Unchosen voices stay fully readable. */
export function VoiceChoice({ value, onChange }: { value: VoiceType; onChange: (v: VoiceType) => void }) {
  const { t } = useT();
  const [pending, setPending] = useState<VoiceType | null>(null);
  const pick = (v: VoiceType) => (v === "natural" || accepted() ? onChange(v) : setPending(v));
  return (
    <section aria-labelledby="voice-title">
      <h2 id="voice-title" className="mb-3 text-[13px] font-medium text-muted-foreground">
        {t("voice.title")}
      </h2>
      <RadioGroup value={value} onValueChange={(v) => pick(v as VoiceType)} className="grid grid-cols-3 gap-2">
        {VOICES.map((v) => {
          const selected = v === value;
          return (
            <label
              key={v}
              className={cn(
                "relative flex cursor-pointer flex-col gap-3 rounded-xl border p-3 transition-[border-color,background-color] duration-200",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                selected ? "border-foreground/40 bg-card" : "border-border bg-card/40 hover:border-input hover:bg-card",
              )}
            >
              <span
                aria-hidden
                className={cn("size-7 rounded-full transition-[box-shadow,opacity] duration-300", selected ? "" : "opacity-70")}
                style={{
                  background: `radial-gradient(circle at 50% 72%, #fff 0%, var(--voice-${v}) 48%, color-mix(in oklab, var(--voice-${v}) 40%, black) 100%)`,
                  boxShadow: selected ? `0 0 18px -2px var(--voice-${v})` : "none",
                }}
              />
              <span>
                <span className="block text-[15px] leading-tight font-semibold">{t(`web.voice.${v}` as TKey)}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{t(`voice.${v}.desc` as TKey)}</span>
              </span>
              <RadioGroupItem value={v} className="sr-only" />
            </label>
          );
        })}
      </RadioGroup>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("voiceNotice.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("voiceNotice.body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="space-y-2.5 text-[14px]">
            {RULES.map((r) => (
              <li key={r} className="flex gap-2.5">
                <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                {t(r)}
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("voiceNotice.keepNatural")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                try {
                  localStorage.setItem(NOTICE_KEY, "1");
                } catch {
                  /* still allow this time */
                }
                if (pending) onChange(pending);
                setPending(null);
              }}
            >
              {t("voiceNotice.agree")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
