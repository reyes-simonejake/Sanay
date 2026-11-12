import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "../i18n";
import { setThemePref, useTheme, type ThemePref } from "../lib/theme";

/** One button: switch between light and dark (the new theme grows from the button). */
export function ThemeButton({ className }: { className?: string }) {
  const { t } = useT();
  const { theme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={(e) => setThemePref(next, e.currentTarget)}
      aria-label={next === "light" ? t("theme.toLight") : t("theme.toDark")}
      title={next === "light" ? t("theme.toLight") : t("theme.toDark")}
      className={cn(
        "grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground",
        className,
      )}
    >
      {theme === "dark" ? <Sun aria-hidden className="size-[18px]" /> : <Moon aria-hidden className="size-[18px]" />}
    </button>
  );
}

const OPTIONS: [ThemePref, typeof Sun][] = [
  ["system", Monitor],
  ["light", Sun],
  ["dark", Moon],
];

/** Settings control: System / Light / Dark. */
export function ThemeChoice() {
  const { t } = useT();
  const { pref } = useTheme();
  return (
    <div role="radiogroup" aria-label={t("theme.title")} className="grid grid-cols-3 gap-1 rounded-full border border-border p-1">
      {OPTIONS.map(([p, Icon]) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={pref === p}
          onClick={(e) => setThemePref(p, e.currentTarget)}
          className={cn(
            "flex h-8 items-center justify-center gap-1.5 rounded-full text-[13px] transition-colors",
            pref === p ? "bg-foreground/10 font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          {t(`theme.${p}`)}
        </button>
      ))}
    </div>
  );
}
