import { useT } from "../i18n";
import type { Strength } from "../lib/api";

const LEVELS: Strength[] = ["light", "normal", "strong"];

/** Three-step segmented control (F5): Light / Normal / Strong. */
export function StrengthSlider({
  value,
  onChange,
  disabled,
}: {
  value: Strength;
  onChange: (s: Strength) => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  return (
    <div>
      <div className="mb-2 font-medium">{t("home.strength")}</div>
      <div role="radiogroup" aria-label={t("home.strength")} className="grid grid-cols-3 gap-1 rounded-xl bg-slate-200 p-1 dark:bg-slate-700">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={value === l}
            disabled={disabled}
            onClick={() => onChange(l)}
            className={`rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              value === l
                ? "bg-white text-teal-700 shadow dark:bg-slate-900 dark:text-teal-300"
                : "text-slate-700 hover:bg-white/50 dark:text-slate-300 dark:hover:bg-slate-800/50"
            }`}
          >
            {t(`home.strength.${l}`)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t("home.strengthHint")}</p>
    </div>
  );
}
