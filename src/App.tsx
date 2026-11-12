import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ArrowLeft, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./components/Logo";
import { Splash } from "./components/Splash";
import { ThemeButton } from "./components/ThemeToggle";
import { cn } from "@/lib/utils";
import { fill, I18nProvider, useT, type TKey } from "./i18n";
import { api, onAirState, useEvent, useStatus, type DeviceInfo, type Settings as S, type Status, type VoiceType } from "./lib/api";
import { Home } from "./pages/Home";
import { MicTest } from "./pages/MicTest";
import { Settings } from "./pages/Settings";
import { Setup } from "./pages/Setup";

type Page = "home" | "micTest" | "settings" | "setup";

export default function App() {
  const [settings, setSettings] = useState<S | null>(null);
  useEffect(() => {
    api.getSettings().then(setSettings);
  }, []);
  return (
    <>
      <Splash ready={!!settings} minMs={700} />
      {settings && (
        <I18nProvider lang={settings.language}>
          <Shell settings={settings} setSettings={setSettings} />
        </I18nProvider>
      )}
    </>
  );
}

function Shell({ settings, setSettings }: { settings: S; setSettings: React.Dispatch<React.SetStateAction<S | null>> }) {
  const [page, setPage] = useState<Page>(settings.setupDone ? "home" : "setup");
  const [status, refresh] = useStatus();
  const [inputs, setInputs] = useState<DeviceInfo[]>([]);

  const update = (patch: Partial<S>) => setSettings((s) => s && { ...s, ...patch });

  // Refresh the device list whenever the engine state changes (plug/unplug).
  const engineKind = status?.engine.kind;
  useEffect(() => {
    api.listDevices().then((d) => setInputs(d.inputs)).catch(() => {});
  }, [engineKind, page]);

  // The pill and the tray change these too; every view follows the same events.
  useEvent<boolean>("active-changed", (active) => update({ active }));
  useEvent<VoiceType>("voice-changed", (voiceType) => update({ voiceType }));
  useEvent<boolean>("pill-visible-changed", (pillVisible) => update({ pillVisible }));

  // Opening Sanay clears the pill's "something changed" mark.
  useEffect(() => {
    emit("main-window-seen", null).catch(() => {});
    const un = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) emit("main-window-seen", null).catch(() => {});
    });
    return () => void un.then((f) => f());
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <TopBar
        status={status}
        settings={settings}
        page={page}
        onSettings={() => setPage("settings")}
        onBack={() => setPage(page === "micTest" ? "settings" : "home")}
      />
      <main className="flex-1 px-5 pt-2 pb-6">
        {page === "home" && <Home settings={settings} update={update} status={status} />}
        {page === "settings" && (
          <Settings
            settings={settings}
            update={update}
            status={status}
            inputs={inputs}
            refresh={refresh}
            onMicTest={() => setPage("micTest")}
            onRerunSetup={() => setPage("setup")}
          />
        )}
        {page === "micTest" && <MicTest />}
        {page === "setup" && <Setup settings={settings} update={update} inputs={inputs} onDone={() => setPage("home")} />}
      </main>
    </div>
  );
}

function TopBar({
  status,
  settings,
  page,
  onSettings,
  onBack,
}: {
  status: Status | null;
  settings: S;
  page: Page;
  onSettings: () => void;
  onBack: () => void;
}) {
  const { t } = useT();
  const line = statusLine(status, settings);
  return (
    <header className="flex h-14 items-center gap-2.5 px-5 pt-2">
      {page === "home" || page === "setup" ? (
        <Logo className="size-6" />
      ) : (
        <Button variant="ghost" onClick={onBack} className="-ml-2 h-9 gap-1.5 px-2 text-[14px] text-muted-foreground hover:text-foreground">
          <ArrowLeft />
          {t("nav.back")}
        </Button>
      )}
      {(page === "home" || page === "setup") && <span className="text-[17px] font-semibold tracking-[-0.01em] font-stretch-[112%]">Sanay</span>}
      <span className="glass ml-auto flex h-7 min-w-0 items-center gap-2 rounded-full px-3 text-[12px] text-muted-foreground" role="status" aria-live="polite">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", line.tone === "ok" ? "bg-ok" : line.tone === "warn" ? "bg-warn" : "bg-input")} />
        <span className="truncate">
          <span className={cn("font-semibold", line.tone === "ok" ? "text-ok" : line.tone === "warn" ? "text-warn" : "")}>{t(line.key)}</span>
          {line.delay && <span> · {fill(t("top.delay"), { s: line.delay })}</span>}
        </span>
      </span>
      {page === "home" && <ThemeButton className="-mr-1" />}
      {page === "home" && (
        <Button variant="ghost" size="icon" onClick={onSettings} aria-label={t("top.settings")} className="-mr-2">
          <SettingsIcon />
        </Button>
      )}
    </header>
  );
}

function statusLine(s: Status | null, settings: S): { key: TKey; tone: "ok" | "warn" | "off"; delay?: string } {
  if (!s) return { key: "status.starting", tone: "off" };
  if (s.ready) {
    const air = onAirState(settings.active, settings.voiceType, s);
    return { key: "top.ready", tone: "ok", delay: air === "off" ? undefined : (s.latencyMs / 1000).toFixed(2) };
  }
  switch (s.engine.kind) {
    case "stopped":
      return { key: "status.stopped", tone: "off" };
    case "starting":
      return { key: "status.starting", tone: "off" };
    case "deviceLost":
      return { key: "status.deviceLost", tone: "warn" };
    case "error":
      return { key: "status.error", tone: "warn" };
    default:
      return { key: "status.notReady", tone: "warn" };
  }
}
