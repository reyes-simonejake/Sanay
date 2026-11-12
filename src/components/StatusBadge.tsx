import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { fill, useT, type TKey } from "../i18n";
import type { Status } from "../lib/api";

/** Shown only while something is wrong: which part is missing and what Sanay is doing about it. */
export function StatusBadge({ status }: { status: Status }) {
  const { t } = useT();
  const checks: [TKey, boolean][] = [
    ["status.mic", status.micOk],
    ["status.cable", status.cableOk],
    ["status.denoiser", status.denoiserOk],
  ];
  return (
    <div className="space-y-2 rounded-xl border border-warn/40 bg-card p-4 text-[15px]" role="status" aria-live="polite">
      <p className="flex items-center gap-2 font-semibold text-warn">
        <TriangleAlert aria-hidden className="size-4" />
        {t(headline(status))}
      </p>
      {status.engine.kind === "error" && <p className="text-[13px] text-muted-foreground">{status.engine.message}</p>}
      {status.input?.fallback && <p className="text-[13px]">{fill(t("status.fallback"), { name: status.input.name })}</p>}
      <ul className="space-y-1 text-[13px]">
        {checks.map(([k, ok]) => (
          <li key={k} className="flex items-center gap-2">
            {ok ? <CircleCheck aria-hidden className="size-4 text-ok" /> : <CircleX aria-hidden className="size-4 text-warn" />}
            <span className={ok ? "text-muted-foreground" : "font-medium"}>{t(k)}</span>
          </li>
        ))}
      </ul>
      {status.fellBackToLight && <p className="text-[13px] text-muted-foreground">{t("status.fellBack")}</p>}
    </div>
  );
}

function headline(s: Status): TKey {
  switch (s.engine.kind) {
    case "stopped":
      return "status.stopped";
    case "starting":
      return "status.starting";
    case "deviceLost":
      return "status.deviceLost";
    case "error":
      return "status.error";
    default:
      return "status.notReady";
  }
}
