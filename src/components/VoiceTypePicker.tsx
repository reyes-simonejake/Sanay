import { useT, type TKey } from "../i18n";
import type { VoiceType } from "../lib/api";

const TYPES: VoiceType[] = ["natural", "masculine", "feminine"];

/** Natural / Masculine / Feminine plus an amount slider. */
export function VoiceTypePicker({
  type,
  amount,
  onChange,
}: {
  type: VoiceType;
  amount: number;
  onChange: (type: VoiceType, amount: number) => void;
}) {
  const { t } = useT();
  return (
    <div>
      <div className="mb-2 font-medium">{t("web.voice")}</div>
      <div role="radiogroup" aria-label={t("web.voice")} className="grid grid-cols-3 gap-1 rounded-xl bg-slate-200 p-1 dark:bg-slate-700">
        {TYPES.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={type === v}
            onClick={() => onChange(v, amount)}
            className={`rounded-lg py-2 text-sm font-medium transition-colors ${
              type === v
                ? "bg-white text-teal-700 shadow dark:bg-slate-900 dark:text-teal-300"
                : "text-slate-700 hover:bg-white/50 dark:text-slate-300 dark:hover:bg-slate-800/50"
            }`}
          >
            {t(`web.voice.${v}` as TKey)}
          </button>
        ))}
      </div>
      {type !== "natural" && (
        <p className="mt-2 text-sm font-medium text-teal-700 dark:text-teal-300">
          {t(type === "masculine" ? "web.voice.masculineDesc" : "web.voice.feminineDesc")}
        </p>
      )}
      {type !== "natural" && (
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium">{t("web.voiceAmount")}</span>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={amount}
            onChange={(e) => onChange(type, Number(e.target.value))}
            className="w-full accent-teal-600"
          />
          <span className="flex justify-between text-xs text-slate-500" aria-hidden>
            <span>{t("web.voiceAmount.subtle")}</span>
            <span>{t("web.voiceAmount.strong")}</span>
          </span>
        </label>
      )}
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t("web.voiceHint")}</p>
    </div>
  );
}
