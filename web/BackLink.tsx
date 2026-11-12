// One back button for the whole site: an arrow plus plain words that say where it goes
// ("Back to home", "Back to Overview"), never an arrow alone. Big enough to tap on a phone.
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "../src/i18n";
import { navigate, usePrevious, type Route } from "./router";

export function BackLink({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group -ml-3 inline-flex h-11 items-center gap-2 rounded-full px-3 text-[15px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
    >
      <ArrowLeft aria-hidden className="size-[18px] transition-transform duration-300 ease-out-expo group-hover:-translate-x-0.5" />
      {label}
    </button>
  );
}

/**
 * Back to wherever the person came from on this site (home or their account),
 * never to the page they are on or to log-in / sign-up.
 */
export function BackToPrevious({ self, className }: { self: Route; className?: string }) {
  const { t } = useT();
  const prev = usePrevious();
  const skip = prev.route === self || prev.route === "login" || prev.route === "signup";
  const target = skip ? { route: "home" as Route, sub: "" } : prev;
  const label = target.route === "account" ? t("back.account") : target.route === "guide" ? t("back.guide") : t("back.home");
  return <BackLink label={label} onClick={() => navigate(target.route, target.sub)} className={className} />;
}
