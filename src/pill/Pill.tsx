import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { TriangleAlert } from "lucide-react";
import { I18nProvider, useT, type TKey } from "../i18n";
import { api, onAirState, useEvent, useStatus, type Settings, type VoiceType } from "../lib/api";
import { cn } from "@/lib/utils";

/** The floating pill window: always on top of the call. Click = on/off, drag = move, right-click = open Sanay. */
export function PillApp() {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    document.documentElement.classList.add("pill-window");
    api.getSettings().then(setSettings);
  }, []);
  useEvent<boolean>("active-changed", (active) => setSettings((s) => s && { ...s, active }));
  useEvent<VoiceType>("voice-changed", (voiceType) => setSettings((s) => s && { ...s, voiceType }));
  useEvent<string>("language-changed", (language) =>
    setSettings((s) => s && { ...s, language: language as Settings["language"] }),
  );
  if (!settings) return null;
  return (
    <I18nProvider lang={settings.language}>
      <Pill active={settings.active} voice={settings.voiceType} />
    </I18nProvider>
  );
}

const DRAG_PX = 4;

function Pill({ active, voice }: { active: boolean; voice: VoiceType }) {
  const { t } = useT();
  const [status] = useStatus();
  const state = onAirState(active, voice, status);
  const on = state !== "off" && state !== "blocked";

  // A fallback stays marked until the user has opened Sanay and seen it.
  const [unseen, setUnseen] = useState(false);
  useEffect(() => {
    if (state === "fallback") setUnseen(true);
  }, [state]);
  useEvent<null>("main-window-seen", () => setUnseen(false));

  // Click vs drag: only a press that moves past a few pixels starts a window drag.
  const press = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    press.current = { x: e.screenX, y: e.screenY, dragging: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (!p || p.dragging) return;
    if (Math.hypot(e.screenX - p.x, e.screenY - p.y) > DRAG_PX) {
      p.dragging = true;
      getCurrentWindow().startDragging().catch(() => {});
    }
  };
  const onPointerUp = () => {
    const p = press.current;
    press.current = null;
    if (p && !p.dragging) api.setActive(!active);
  };

  const label = on ? t("air.on") : t("air.off");
  const name = on ? t(`web.voice.${voice}` as TKey) : state === "blocked" ? t("pill.notReady") : t("pill.yourMic");

  return (
    <div className="flex h-screen w-screen items-center justify-center p-1">
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={`${label}, ${name}. ${active ? t("air.turnOff") : t("air.turnOn")}`}
        title={t("pill.help")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            api.setActive(!active);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setUnseen(false);
          api.showMainWindow();
        }}
        className={cn(
          "flex h-11 w-full cursor-grab touch-none items-center gap-2.5 rounded-full pr-4 pl-1.5 select-none active:cursor-grabbing",
          "border border-pill-edge bg-pill text-pill-foreground backdrop-blur-xl transition-colors duration-200",
          // No drop shadow: the pill window is only as big as the capsule, so a shadow would be cut
          // off at the window edge and show as a rectangle. The hairline edge separates it instead.
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-8 shrink-0 rounded-full transition-[background-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            on ? "" : "border-[1.5px] border-white/30",
            state === "starting" && "animate-pulse",
          )}
          style={
            on
              ? {
                  background: `radial-gradient(circle at 50% 72%, #fff 0%, var(--voice-${voice}) 50%, color-mix(in oklab, var(--voice-${voice}) 35%, black) 100%)`,
                  boxShadow: `0 0 8px -2px var(--voice-${voice})`, // stays inside the capsule
                }
              : undefined
          }
        />
        <span
          className={cn(
            "text-[13px] leading-none font-semibold whitespace-nowrap font-stretch-[110%]",
            on ? "text-white" : "text-pill-foreground/70",
          )}
        >
          {label}
        </span>
        <span className="min-w-0 flex-1 truncate text-left text-[13px] text-pill-foreground/70">{state === "blocked" ? null : name}</span>
        {(unseen || state === "blocked") && <TriangleAlert aria-hidden className="size-4 shrink-0 text-warn-bright" />}
      </button>
    </div>
  );
}
