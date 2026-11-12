import { Component, useState, type ErrorInfo, type ReactNode } from "react";
import { Check, Copy, House, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "../i18n";

/**
 * Full-page states in the app's own language of light:
 *  - error: the ring of light is broken (a gap), with reload / home and copyable details,
 *  - maintenance: the ring keeps a slow light travelling around it while Sanay is updated.
 */
export function StatusScreen({
  kind,
  error,
  until,
  onHome,
}: {
  kind: "error" | "maintenance";
  error?: Error | null;
  /** Maintenance: when Sanay is expected back (free text, e.g. "around 3:00 PM"). */
  until?: string;
  onHome?: () => void;
}) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const details = error ? `${error.name}: ${error.message}\n${error.stack ?? ""}`.trim() : "";

  return (
    <main className="grid min-h-svh place-items-center px-6 py-16">
      <div className="flex max-w-md flex-col items-center text-center">
        <svg viewBox="0 0 120 120" className={cn("status-ring size-28", kind === "maintenance" && "status-ring--travel")} aria-hidden>
          <defs>
            <linearGradient id="status-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7fd8ff" />
              <stop offset="0.5" stopColor="#8f9bff" />
              <stop offset="1" stopColor="#c58bff" />
            </linearGradient>
          </defs>
          {/* Dim track */}
          <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="2" />
          {/* Light: broken for an error, travelling for maintenance */}
          <circle className="status-arc" cx="60" cy="60" r="44" fill="none" stroke="url(#status-ring)" strokeWidth="2" strokeLinecap="round" pathLength="100" />
        </svg>

        <h1 className="mt-8 text-[clamp(1.8rem,4vw,2.4rem)] leading-tight font-semibold tracking-[-0.03em] font-stretch-[106%]">
          {t(kind === "error" ? "statusPage.error.title" : "statusPage.maintenance.title")}
        </h1>
        <p className="mt-3 text-[15px] text-muted-foreground">
          {t(kind === "error" ? "statusPage.error.body" : "statusPage.maintenance.body")}
        </p>
        {kind === "maintenance" && until && (
          <p className="mt-2 text-[14px] font-medium">
            {t("statusPage.maintenance.until")} {until}
          </p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button onClick={() => location.reload()} className="h-11 gap-2 rounded-full px-5">
            <RotateCw aria-hidden className="size-4" />
            {t(kind === "error" ? "statusPage.reload" : "statusPage.checkAgain")}
          </Button>
          {kind === "error" && onHome && (
            <Button variant="outline" onClick={onHome} className="h-11 gap-2 rounded-full bg-transparent px-5">
              <House aria-hidden className="size-4" /> {t("statusPage.home")}
            </Button>
          )}
        </div>

        {kind === "error" && details && (
          <details className="mt-10 w-full text-left">
            <summary className="cursor-pointer text-center text-[13px] text-muted-foreground hover:text-foreground">{t("statusPage.details")}</summary>
            <div className="glass mt-3 rounded-xl p-4">
              <pre className="max-h-48 overflow-auto text-[12px] leading-relaxed whitespace-pre-wrap text-muted-foreground">{details}</pre>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(details).then(() => setCopied(true))}
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand"
              >
                {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
                {copied ? t("statusPage.copied") : t("statusPage.copy")}
              </button>
            </div>
          </details>
        )}
      </div>
    </main>
  );
}

/** Catches a crash anywhere below it and shows the error screen instead of a blank window. */
export class ErrorBoundary extends Component<{ children: ReactNode; onHome?: () => void; fallback?: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[sanay] crashed:", error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <StatusScreen
        kind="error"
        error={this.state.error}
        onHome={
          this.props.onHome &&
          (() => {
            this.setState({ error: null });
            this.props.onHome!();
          })
        }
      />
    );
  }
}
