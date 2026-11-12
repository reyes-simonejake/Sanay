import { Briefcase, Gamepad2, MessagesSquare, UserRoundSearch } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useT, type TKey } from "../../src/i18n";
import { countries } from "../auth/countries";
import type { Lang, UseCase, VoicePref } from "../auth/backend";

const VOICES: VoicePref[] = ["masculine", "feminine", "natural"];

/** The three voices as tiles, each carrying its light. */
export function VoiceTiles({ value, onChange }: { value: VoicePref; onChange: (v: VoicePref) => void }) {
  const { t } = useT();
  return (
    <div role="radiogroup" aria-label={t("auth.voice")} className="grid grid-cols-3 gap-2">
      {VOICES.map((v) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            className={cn(
              "flex flex-col items-start gap-3 rounded-xl border p-3 text-left transition-[border-color,background-color] duration-200",
              on ? "border-foreground/40 bg-card" : "border-border bg-card/40 hover:border-input hover:bg-card",
            )}
          >
            <span
              aria-hidden
              className={cn("size-6 rounded-full transition-opacity", !on && "opacity-70")}
              style={{
                background: `radial-gradient(circle at 50% 72%, #fff 0%, var(--voice-${v}) 48%, color-mix(in oklab, var(--voice-${v}) 40%, black) 100%)`,
                boxShadow: on ? `0 0 16px -2px var(--voice-${v})` : "none",
              }}
            />
            <span className="text-[14px] leading-tight font-semibold">{t(`web.voice.${v}` as TKey)}</span>
          </button>
        );
      })}
    </div>
  );
}

const USES: [UseCase, typeof Briefcase][] = [
  ["interviews", UserRoundSearch],
  ["work", Briefcase],
  ["streaming", Gamepad2],
  ["other", MessagesSquare],
];

export function UseCaseChips({ value, onChange }: { value: UseCase | ""; onChange: (v: UseCase) => void }) {
  const { t } = useT();
  return (
    <div role="radiogroup" aria-label={t("auth.useCase")} className="grid grid-cols-2 gap-2">
      {USES.map(([u, Icon]) => {
        const on = u === value;
        return (
          <button
            key={u}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(u)}
            className={cn(
              "flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[14px] leading-tight transition-colors duration-200",
              on ? "border-foreground/40 bg-card font-medium text-foreground" : "border-border bg-card/40 text-muted-foreground hover:border-input hover:text-foreground",
            )}
          >
            <Icon aria-hidden className={cn("size-4 shrink-0", on && "text-brand")} />
            {t(`auth.use.${u}` as TKey)}
          </button>
        );
      })}
    </div>
  );
}

export function CountrySelect({ id, value, onChange, lang }: { id: string; value: string; onChange: (v: string) => void; lang: Lang }) {
  const { t } = useT();
  return (
    <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
      <SelectTrigger id={id} className="h-11 w-full bg-transparent">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value="__none__">{t("auth.countryNone")}</SelectItem>
        {countries(lang).map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LanguageSelect({ id, value, onChange }: { id: string; value: Lang; onChange: (v: Lang) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Lang)}>
      <SelectTrigger id={id} className="h-11 w-full bg-transparent">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">English</SelectItem>
        <SelectItem value="fil">Filipino</SelectItem>
      </SelectContent>
    </Select>
  );
}
