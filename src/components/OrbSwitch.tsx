import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fill, useT, type TKey } from "../i18n";
import { useLevels, type OnAirState, type VoiceType } from "../lib/api";
import { levelFromDb } from "../lib/orb";
import { Orb } from "./Orb";

/**
 * The window's centre: the orb is the on/off switch. Alive and coloured = the call hears the chosen
 * voice; a thin dim ring = the call hears the untouched mic (or nothing reaches the call yet).
 */
export function OrbSwitch({
  state,
  voice,
  onToggle,
}: {
  state: OnAirState;
  voice: VoiceType;
  onToggle: (on: boolean) => void;
}) {
  const { t } = useT();
  const levels = useLevels();
  const live = state !== "off" && state !== "blocked";
  const voiceName = t(`web.voice.${voice}` as TKey);
  const body =
    state === "off"
      ? t("air.offBody")
      : state === "blocked"
        ? t("air.blockedBody")
        : state === "starting"
          ? fill(t("air.starting"), { voice: voiceName })
          : state === "fallback"
            ? fill(t("air.fallback"), { voice: voiceName })
            : t("air.liveBody");
  const title = live ? `${t("air.on")} · ${voiceName}` : t("air.off");

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        role="switch"
        aria-checked={state !== "off"}
        aria-label={`${title}. ${body}. ${state !== "off" ? t("air.turnOff") : t("air.turnOn")}`}
        onClick={() => onToggle(state === "off")}
        className="group relative -my-6 grid size-72 place-items-center rounded-full focus-visible:outline-offset-[-40px]"
      >
        <Orb
          on={live}
          voice={voice}
          level={live ? levelFromDb(levels.output.rmsDb) : 0}
          className="absolute inset-0 size-full transition-transform duration-500 ease-out-expo group-hover:scale-[1.03] group-active:scale-[0.98]"
        />
      </button>
      <p
        aria-hidden
        className={cn(
          "mt-1 text-[22px] leading-tight font-semibold tracking-[-0.02em] font-stretch-[110%]",
          live ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {title}
      </p>
      <p aria-hidden className="mt-1 flex items-center gap-1.5 text-center text-[13px] text-muted-foreground">
        {state === "starting" && <LoaderCircle className="size-3.5 animate-spin" />}
        {body}
      </p>
    </div>
  );
}
