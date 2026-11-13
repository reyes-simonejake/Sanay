import { useEffect, useState, type ReactNode } from "react";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AccountPage, Avatar, signOut } from "./pages/AccountPage";
import { AuthPage } from "./pages/AuthPage";
import { GuidePage } from "./pages/GuidePage";
import { AppPreview } from "./pages/AppPreview";
import { navigate, useRoute } from "./router";
import { AudioLines, ChevronDown, CircleCheck, Headphones, House, LogOut, Mic, Monitor, Pause, Play, Send, ShieldCheck, SlidersHorizontal, TriangleAlert, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Splash } from "../src/components/Splash";
import { ErrorBoundary, StatusScreen } from "../src/components/StatusScreen";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { LevelMeter } from "../src/components/LevelMeter";
import { Logo } from "../src/components/Logo";
import { ThemeButton } from "../src/components/ThemeToggle";
import { fill, I18nProvider, useT, type Lang, type TKey } from "../src/i18n";
import type { Strength } from "../src/lib/api";
import { levelFromDb } from "../src/lib/orb";
import type { VoiceType } from "./audio/webEngine";
import { Spectrum } from "./Spectrum";
import { useVoiceLab, type Verdict, type VoiceLab } from "./useVoiceLab";
import { BackToTop } from "./landing/BackToTop";
import { COPY, pick } from "./landing/copy";
import { CallPicker, FinalCta, NoiseTiles, Privacy, World } from "./landing/Sections";
import { Features } from "./landing/Features";
import { WhoItsFor } from "./landing/WhoItsFor";
import "./landing/landing.css";
import { Journey } from "./journey/Journey";

const VOICES: VoiceType[] = ["masculine", "feminine", "natural"];

// Maintenance mode: set VITE_MAINTENANCE=1 (and optionally VITE_MAINTENANCE_UNTIL="around 3:00 PM")
// when deploying. Preview any state with ?preview=maintenance | error | splash.
const preview = new URLSearchParams(location.search).get("preview");
const MAINTENANCE = import.meta.env.VITE_MAINTENANCE === "1" || preview === "maintenance";
const MAINTENANCE_UNTIL = (import.meta.env.VITE_MAINTENANCE_UNTIL as string | undefined) ?? "";

/** Throws on purpose, to preview the error screen (?preview=error). */
function Crash(): never {
  throw new Error("This is a preview of the error screen (?preview=error).");
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem("sanay.lang");
    if (saved === "en" || saved === "fil") return saved;
  } catch {
    /* storage unavailable */
  }
  return /^(fil|tl)\b/i.test(navigator.language) ? "fil" : "en";
}

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang === "fil" ? "fil" : "en";
    try {
      localStorage.setItem("sanay.lang", lang);
    } catch {
      /* ignore */
    }
  }, [lang]);
  return (
    <I18nProvider lang={lang}>
      {MAINTENANCE ? (
        <StatusScreen kind="maintenance" until={MAINTENANCE_UNTIL} />
      ) : (
        <ErrorBoundary onHome={() => navigate("home")}>
          {preview === "error" && <Crash />}
          <AuthProvider>
            <Page lang={lang} setLang={setLang} />
          </AuthProvider>
        </ErrorBoundary>
      )}
    </I18nProvider>
  );
}

function Page({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const route = useRoute();
  const { user, ready } = useAuth();
  // Signed in already? Sign-up and log-in go straight to the account.
  useEffect(() => {
    if (ready && user && (route === "signup" || route === "login")) navigate("account");
  }, [ready, user, route]);
  return (
    <div className="min-h-screen overflow-x-clip">
      <Splash ready={ready && preview !== "splash"} />
      <Nav lang={lang} setLang={setLang} />
      {route === "home" && <Home />}
      {route === "signup" && <AuthPage mode="signup" lang={lang} setLang={setLang} />}
      {route === "login" && <AuthPage mode="login" lang={lang} setLang={setLang} />}
      {route === "account" && <AccountPage lang={lang} setLang={setLang} />}
      {route === "guide" && <GuidePage lang={lang} />}
      {route === "preview" && <AppPreview />}
      {route !== "signup" && route !== "login" && <Footer />}
    </div>
  );
}

function Home() {
  const lab = useVoiceLab();
  const start = () => {
    void lab.connect();
    document.getElementById("lab")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const level = lab.phase === "live" ? levelFromDb(lab.levels.output.rmsDb) : 0;
  return (
    <main>
      <Journey lab={lab} level={level} onStart={start} />
      <Features voice={lab.voice} onTry={start} />
      <CallPicker onTry={start} />
      <NoiseTiles />
      <Privacy voice={lab.voice} />
      <World voice={lab.voice} />
      <WhoItsFor />
      <Lab lab={lab} />
      <Desktop />
      <FinalCta voice={lab.voice} onTry={start} />
      <BackToTop />
    </main>
  );
}

/** Avatar menu: where the account lives, and where you sign out. */
function AccountMenu() {
  const { t } = useT();
  const { user, backend, setUser } = useAuth();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-full border border-glass-edge py-1 pr-2 pl-1 outline-none transition-colors hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-foreground/5" aria-label={t("account.title")}>
        <Avatar user={user} className="size-7 text-[10px]" />
        <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="glass w-60 rounded-xl p-1.5">
        <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal">
          <Avatar user={user} className="size-9 text-[12px]" />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold">{user.name}</span>
            <span className="block truncate text-[12px] text-muted-foreground">{user.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("account", "overview")} className="gap-2.5 rounded-lg px-2 py-2 text-[14px]">
          <House aria-hidden className="size-4" /> {t("account.tab.overview")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("account", "profile")} className="gap-2.5 rounded-lg px-2 py-2 text-[14px]">
          <UserRound aria-hidden className="size-4" /> {t("account.tab.profile")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("account", "preferences")} className="gap-2.5 rounded-lg px-2 py-2 text-[14px]">
          <SlidersHorizontal aria-hidden className="size-4" /> {t("account.tab.preferences")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut(backend, setUser)} className="gap-2.5 rounded-lg px-2 py-2 text-[14px]">
          <LogOut aria-hidden className="size-4" /> {t("account.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Nav({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const { t } = useT();
  const route = useRoute();
  const { user } = useAuth();
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-2.5 px-4 sm:gap-6 sm:px-8" aria-label={t("web.nav.main")}>
        <a href="#/" className="flex items-center gap-2.5">
          <Logo className="size-7" />
          <span className="text-[17px] font-semibold tracking-[-0.01em] font-stretch-[112%]">Sanay</span>
        </a>
        <div className="ml-auto hidden items-center gap-6 text-[14px] text-muted-foreground md:flex">
          {route === "home" && (
            <>
              <a href="#ch-practice" className="transition-colors hover:text-foreground">
                {pick(COPY.navHow, lang)}
              </a>
              <a href="#who" className="transition-colors hover:text-foreground">
                {pick(COPY.navWho, lang)}
              </a>
              <a href="#lab" className="transition-colors hover:text-foreground">
                {t("web.nav.try")}
              </a>
              <a href="#desktop" className="transition-colors hover:text-foreground">
                {t("web.nav.desktop")}
              </a>
            </>
          )}
          <a href="#/guide" aria-current={route === "guide" ? "page" : undefined} className={cn("transition-colors hover:text-foreground", route === "guide" && "text-foreground")}>
            {t("web.nav.guide")}
          </a>
        </div>
        {route !== "home" && <ThemeButton className="ml-auto md:ml-0" />}
        <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
          <SelectTrigger size="sm" aria-label={t("web.language")} className="w-auto gap-2 border-glass-edge bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="fil">Filipino</SelectItem>
          </SelectContent>
        </Select>
        {user ? (
          <AccountMenu />
        ) : (
          route !== "signup" &&
          route !== "login" && (
            <div className="flex items-center gap-2">
              <a href="#/login" className="hidden h-9 items-center rounded-full px-3 text-[14px] text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">
                {t("auth.login.cta")}
              </a>
              <Button asChild size="sm" className="h-9 rounded-full px-4 text-[14px]">
                <a href="#/signup">{t("auth.signup.cta")}</a>
              </Button>
            </div>
          )
        )}
      </nav>
    </header>
  );
}

function VoiceSwatches({ value, onChange, className }: { value: VoiceType; onChange: (v: VoiceType) => void; className?: string }) {
  const { t } = useT();
  return (
    <div role="radiogroup" aria-label={t("web.voice")} className={cn("glass flex max-w-full gap-0.5 rounded-full p-1 sm:gap-1", className)}>
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
              "flex h-10 min-w-0 items-center gap-1.5 rounded-full px-2.5 text-[14px] transition-colors duration-200 sm:h-9 sm:gap-2 sm:px-3.5",
              on ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              aria-hidden
              className="size-3.5 rounded-full"
              style={{
                background: `radial-gradient(circle at 50% 70%, #fff 0%, var(--voice-${v}) 55%)`,
                boxShadow: on ? `0 0 10px var(--voice-${v})` : "none",
              }}
            />
            {t(`web.voice.${v}` as TKey)}
          </button>
        );
      })}
    </div>
  );
}

const VERDICT_TONE: Record<Verdict, string> = {
  waiting: "text-muted-foreground",
  silent: "text-warn",
  quiet: "text-warn",
  good: "text-ok",
  loud: "text-destructive",
};

function Lab({ lab }: { lab: VoiceLab }) {
  const { t } = useT();
  const errorText = lab.error
    ? lab.error.kind === "other"
      ? `${t("web.err.other")} ${lab.error.msg}`
      : t(`web.err.${lab.error.kind}` as TKey)
    : null;

  return (
    <section id="lab" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-24 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h2 className="text-[clamp(1.9rem,3.4vw,2.75rem)] leading-tight font-semibold font-display tracking-[-0.03em]">{t("web.lab.title")}</h2>
          <p className="mt-3 text-[17px] text-muted-foreground">{t("web.lab.body")}</p>
        </div>
        <VoiceSwatches value={lab.voice} onChange={lab.setVoice} />
      </div>

      {errorText && (
        <p role="alert" className="mt-8 flex items-start gap-2 rounded-xl border border-destructive/40 px-4 py-3 text-[14px] text-destructive">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> {errorText}
        </p>
      )}

      {lab.phase !== "live" ? (
        <div className="glass mt-10 flex flex-col items-start gap-4 rounded-2xl p-8 sm:flex-row sm:items-center">
          <div className="flex-1 space-y-1.5 text-[14px] text-muted-foreground">
            <p className="text-[16px] font-medium text-foreground">{t("web.lab.idle")}</p>
            <p>{t("web.allowHint")}</p>
            <p>{t("web.defaultMicHint")}</p>
          </div>
          <Button size="lg" onClick={() => lab.connect()} disabled={lab.phase === "loading"} className="h-12 gap-2 rounded-full px-6 text-[15px]">
            <Mic aria-hidden className="size-4" />
            {lab.phase === "loading" ? t("web.starting") : t("web.hero.cta")}
          </Button>
        </div>
      ) : (
        <LiveLab lab={lab} />
      )}
    </section>
  );
}

function LiveLab({ lab }: { lab: VoiceLab }) {
  const { t } = useT();
  const e = lab.engine!;
  return (
    <div className="mt-10 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
      {/* Live sound */}
      <div className="glass space-y-5 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={cn("text-[16px] font-medium", VERDICT_TONE[lab.verdict])} role="status" aria-live="polite">
            {t(`web.verdict.${lab.verdict}` as TKey)}
          </p>
          <Select value={lab.selectedMic || "__default__"} onValueChange={(v) => lab.connect(v === "__default__" ? "" : v)}>
            <SelectTrigger aria-label={t("home.mic")} className="h-9 max-w-[16rem] bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">{t("web.defaultMic")}</SelectItem>
              {lab.mics.map((m, i) => (
                <SelectItem key={m.deviceId} value={m.deviceId}>
                  {m.label || `Microphone ${i + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {lab.notice && (
          <p role="status" className={cn("text-[14px]", lab.notice.key === "web.switchedBack" ? "text-ok" : "text-warn")}>
            {fill(t(lab.notice.key), { name: lab.notice.name })}
          </p>
        )}
        {lab.humHz > 0 && lab.nc && (
          <p className="flex items-center gap-2 text-[14px] text-ok">
            <CircleCheck aria-hidden className="size-4" /> {fill(t("web.humRemoved"), { hz: String(lab.humHz) })}
          </p>
        )}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted-foreground">
            <span className="font-medium text-foreground">{t("web.spectrum")}</span>
            <span className="flex gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm bg-muted-foreground/40" aria-hidden /> {t("web.spectrum.raw")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-brand" aria-hidden /> {t("web.spectrum.clean")}
              </span>
            </span>
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-2">
            <Spectrum raw={e.rawAnalyser} clean={e.cleanAnalyser} label={t("web.spectrum")} />
          </div>
        </div>
        <div className="space-y-3">
          <LevelMeter label={t("web.spectrum.raw")} reading={lab.levels.input} />
          <LevelMeter label={t("web.spectrum.clean")} reading={lab.levels.output} />
        </div>
      </div>

      {/* Record and compare */}
      <div className="glass space-y-4 rounded-2xl p-6">
        <h3 className="text-[18px] font-semibold">{t("web.compare")}</h3>
        <p className="text-[14px] text-muted-foreground">{t("web.compareBody")}</p>
        {lab.recording ? (
          <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3" role="status">
            <span className="size-2.5 animate-pulse rounded-full bg-destructive" aria-hidden />
            <span className="flex-1 text-[14px] font-medium">
              {t("web.recording")} · {lab.left}s
            </span>
            <Button size="sm" variant="outline" onClick={lab.stopRecording}>
              {t("web.recordStop")}
            </Button>
          </div>
        ) : (
          <Button onClick={lab.record} disabled={!!lab.playing} className="h-11 w-full rounded-full text-[15px]">
            {t("web.record")}
          </Button>
        )}
        {lab.rec && !lab.recording && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(["raw", "clean"] as const).map((w) => (
                <PlayButton key={w} active={lab.playing === w} onClick={() => (lab.playing === w ? lab.stopPlayback() : lab.play(w))} strong={w === "clean"}>
                  {t(w === "raw" ? "web.playRaw" : "web.playClean")}
                </PlayButton>
              ))}
            </div>
            {lab.aiSrv && (
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-[14px] font-medium">{t("web.ai.title")}</p>
                {lab.recVoice !== "natural" ? (
                  <p className="text-[14px] text-warn">{t("web.ai.needNatural")}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {(["masculine", "feminine"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        disabled={!lab.aiSrv!.voices[v]?.ready || (lab.aiWorking !== null && lab.aiWorking !== v)}
                        title={lab.aiSrv!.voices[v]?.ready ? undefined : t("web.ai.notTrained")}
                        onClick={() => (lab.playing === v ? lab.stopPlayback() : lab.playAi(v))}
                        className="flex h-11 items-center justify-center gap-2 rounded-full border border-border text-[14px] font-medium transition-colors hover:bg-foreground/5 disabled:opacity-50"
                      >
                        <span aria-hidden className="size-3 rounded-full" style={{ background: `var(--voice-${v})`, boxShadow: `0 0 10px var(--voice-${v})` }} />
                        {lab.aiWorking === v ? t("web.ai.converting") : lab.playing === v ? t("web.stopPlay") : t(v === "masculine" ? "web.ai.masculine" : "web.ai.feminine")}
                      </button>
                    ))}
                  </div>
                )}
                {lab.aiErr && (
                  <p className="text-[14px] text-destructive" role="alert">
                    {lab.aiErr}
                  </p>
                )}
                {(lab.aiOut.masculine || lab.aiOut.feminine) && (
                  <p className="text-[12px] text-muted-foreground">
                    {(() => {
                      const i = (lab.aiOut[(lab.playing as "masculine" | "feminine") ?? "masculine"] ?? lab.aiOut.masculine ?? lab.aiOut.feminine)!.info;
                      return fill(t(i.realtime_ok ? "web.ai.infoOk" : "web.ai.infoSlow"), {
                        you: String(i.your_pitch_hz),
                        target: String(i.target_pitch_hz),
                        ms: String(i.block_ms_mean),
                      });
                    })()}
                  </p>
                )}
              </div>
            )}
            <p className="text-[12px] text-muted-foreground">{t("test.headphonesHint")}</p>
            <button type="button" className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={lab.discard}>
              {t("web.delete")}
            </button>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="glass grid gap-x-8 gap-y-5 rounded-2xl p-6 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-4">
        <SwitchRow id="nc" label={t("home.nc")} hint={t("home.ncHint")} checked={lab.nc} onChange={lab.setNc} />
        <div className="space-y-2">
          <Label className="text-[14px] font-semibold">{t("home.strength")}</Label>
          <Segmented<Strength>
            value={lab.strength}
            disabled={!lab.nc}
            options={[
              ["light", t("home.strength.light")],
              ["normal", t("home.strength.normal")],
              ["strong", t("home.strength.strong")],
            ]}
            onChange={lab.setStrength}
            label={t("home.strength")}
          />
          <p className="text-[12px] text-muted-foreground">{t("web.noiseLimit")}</p>
        </div>
        <SwitchRow id="clarity" label={t("web.clarity")} hint={t("web.clarityHint")} checked={lab.clarity} onChange={lab.setClarity} />
        <div className="space-y-5">
          <SwitchRow id="agc" label={t("web.agc")} hint={t("web.agcHint")} checked={lab.agc} onChange={lab.setAgc} />
          <SwitchRow id="listen" label={t("web.listen")} hint={t("web.listenHint")} checked={lab.listen} onChange={lab.setListen} />
        </div>
      </div>

      {lab.info && (
        <details className="glass rounded-2xl p-6 lg:col-span-2">
          <summary className="cursor-pointer text-[15px] font-semibold">{t("web.info")}</summary>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-8 gap-y-1.5 text-[14px]">
            <dt className="text-muted-foreground">{t("web.info.name")}</dt>
            <dd className="break-words">{lab.info.label}</dd>
            <dt className="text-muted-foreground">{t("web.info.rate")}</dt>
            <dd>
              {lab.info.trackSampleRate ? `${lab.info.trackSampleRate} Hz` : "—"} → {lab.info.contextSampleRate} Hz
            </dd>
            <dt className="text-muted-foreground">{t("web.info.channels")}</dt>
            <dd>{lab.info.channelCount ?? "—"}</dd>
            <dt className="text-muted-foreground">{t("web.info.browserDsp")}</dt>
            <dd>{lab.info.echoCancellation || lab.info.noiseSuppression || lab.info.autoGainControl ? t("web.info.on") : t("web.info.off")}</dd>
            <dt className="text-muted-foreground">{t("web.info.latency")}</dt>
            <dd>{lab.info.sanayLatencyMs.toFixed(0)} ms</dd>
            <dt className="text-muted-foreground">{t("web.info.hum")}</dt>
            <dd>{lab.humHz ? `${lab.humHz} Hz` : t("web.info.humNone")}</dd>
            <dt className="text-muted-foreground">{t("web.info.voiceLatency")}</dt>
            <dd>{lab.voice === "natural" ? "0 ms" : `${lab.info.voiceLatencyMs.toFixed(0)} ms`}</dd>
            <dt className="text-muted-foreground">{t("web.info.browserLatency")}</dt>
            <dd>{lab.info.browserLatency ? `${(lab.info.browserLatency * 1000).toFixed(0)} ms` : "—"}</dd>
          </dl>
        </details>
      )}
    </div>
  );
}

function PlayButton({ active, strong, onClick, children }: { active: boolean; strong?: boolean; onClick: () => void; children: ReactNode }) {
  const { t } = useT();
  return (
    <Button variant={strong ? "default" : "outline"} onClick={onClick} className={cn("h-11 gap-2 rounded-full text-[14px]", !strong && "bg-transparent")}>
      {active ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
      {active ? t("web.stopPlay") : children}
    </Button>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid grid-cols-3 gap-1 rounded-full border border-border p-1", disabled && "opacity-50")}>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={v === value}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={cn("h-8 rounded-full text-[13px] transition-colors", v === value ? "bg-foreground/10 font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function SwitchRow({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <Label htmlFor={id} className="block cursor-pointer">
        <span className="block text-[14px] font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-snug font-normal text-muted-foreground">{hint}</span>}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </div>
  );
}

/** What the desktop app adds, shown with the real pill styling rather than a picture of it. */
function Desktop() {
  const { t } = useT();
  const steps: [TKey, TKey, typeof Headphones][] = [
    ["web.how1", "web.how1Body", Headphones],
    ["web.how2", "web.how2Body", AudioLines],
    ["web.how3", "web.how3Body", ShieldCheck],
  ];
  return (
    <section id="desktop" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-24 sm:px-8">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <div>
          <h2 className="text-[clamp(1.9rem,3.4vw,2.75rem)] leading-tight font-semibold font-display tracking-[-0.03em]">{t("web.desktop")}</h2>
          <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-muted-foreground">{t("web.desktopBody")}</p>
          <ol className="mt-10 space-y-6">
            {steps.map(([h, b, Icon]) => (
              <li key={h} className="grid grid-cols-[2rem_1fr] gap-x-4">
                <Icon aria-hidden className="mt-0.5 size-5 text-brand" />
                <span>
                  <span className="block text-[16px] font-semibold">{t(h)}</span>
                  <span className="mt-1 block text-[14px] text-muted-foreground">{t(b)}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-10 text-[13px] text-muted-foreground">{t("web.desktopSoon")}</p>
          <OnYourPhone />
        </div>

        <figure className="glass relative overflow-hidden rounded-2xl p-8 sm:p-10">
          <div className="space-y-3">
            {(["masculine", "feminine"] as const).map((v, i) => (
              <div key={v} className={cn("flex", i === 1 && "justify-end")}>
                <PillPreview voice={v} on={i === 1} />
              </div>
            ))}
          </div>
          <figcaption className="mt-8 text-[13px] text-muted-foreground">{t("web.desktop.pillCaption")}</figcaption>
        </figure>
      </div>
    </section>
  );
}

/** Touch screens only: the app is for computers, so offer to send this page to one. */
function OnYourPhone() {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const send = async () => {
    const url = location.href.split("#")[0]!;
    try {
      if (navigator.share) return await navigator.share({ title: "Sanay", url });
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* nothing we can do; the address bar still has it */
    }
  };
  return (
    <div className="mt-8 hidden rounded-2xl border border-border bg-card/60 p-5 pointer-coarse:block">
      <p className="flex items-center gap-2 text-[15px] font-semibold">
        <Monitor aria-hidden className="size-4 text-brand" />
        {t("web.desktop.phoneTitle")}
      </p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{t("web.desktop.phoneBody")}</p>
      <Button type="button" variant="secondary" onClick={() => void send()} className="mt-4 h-11 w-full gap-2 rounded-full text-[15px] sm:w-auto sm:px-5">
        {copied ? <CircleCheck aria-hidden className="text-ok" /> : <Send aria-hidden />}
        {copied ? t("web.desktop.phoneCopied") : t("web.desktop.phoneSend")}
      </Button>
    </div>
  );
}

function PillPreview({ voice, on }: { voice: VoiceType; on: boolean }) {
  const { t } = useT();
  return (
    <div className="flex h-11 w-[212px] items-center gap-2.5 rounded-full border border-pill-edge bg-pill pr-4 pl-1.5 text-pill-foreground shadow-[0_8px_20px_-8px_rgba(0,0,0,0.55)]">
      <span
        aria-hidden
        className={cn("size-8 shrink-0 rounded-full", !on && "border-[1.5px] border-white/30")}
        style={
          on
            ? {
                background: `radial-gradient(circle at 50% 72%, #fff 0%, var(--voice-${voice}) 50%, color-mix(in oklab, var(--voice-${voice}) 35%, black) 100%)`,
                boxShadow: `0 0 14px -1px var(--voice-${voice})`,
              }
            : undefined
        }
      />
      <span className={cn("text-[13px] font-semibold font-stretch-[110%]", on ? "text-white" : "text-pill-foreground/70")}>
        {on ? t("air.on") : t("air.off")}
      </span>
      <span className="truncate text-[13px] text-pill-foreground/70">{on ? t(`web.voice.${voice}` as TKey) : t("pill.yourMic")}</span>
    </div>
  );
}

function Footer() {
  const { t } = useT();
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-[13px] text-muted-foreground sm:px-8">
        <span className="flex items-center gap-2">
          <Logo className="size-5" /> {t("web.footer")}
        </span>
        <a href="#/guide" className="hover:text-foreground">
          {t("guide.title")}
        </a>
      </div>
    </footer>
  );
}
