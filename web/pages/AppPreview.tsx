// A clickable look at the planned in-app screens (Job 2), drawn inside a desktop-app window.
// Everything here is sample content: nothing is recorded, scored or sent anywhere.
// Interface text follows the language switch; the practice-call lines stay in English on purpose
// (English is what the person is practising).
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  Captions,
  ChevronRight,
  GraduationCap,
  Languages,
  Mic,
  MicOff,
  PhoneOff,
  Play,
  Plane,
  RotateCcw,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "../../src/components/Logo";
import { Orb } from "../../src/components/Orb";
import { useT, type TKey } from "../../src/i18n";
import { SayInEnglish } from "./SayInEnglish";
import { BackToPrevious } from "../BackLink";

type Screen = "home" | "pick" | "call" | "score" | "english" | "coach" | "notice" | "subtitles";
const SCREENS: Screen[] = ["home", "pick", "call", "score", "english", "coach", "notice", "subtitles"];

export function AppPreview() {
  const { t } = useT();
  const [screen, setScreen] = useState<Screen>("home");

  return (
    <main className="mx-auto max-w-6xl px-4 pt-24 pb-20 sm:px-6">
      <header className="mb-8 max-w-2xl">
        <BackToPrevious self="preview" className="mb-4" />
        <p className="text-[13px] font-medium text-brand">{t("pv.badge")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{t("pv.title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("pv.body")}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <nav aria-label={t("pv.screens")} className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
          {SCREENS.map((s, i) => (
            <button
              key={s}
              onClick={() => setScreen(s)}
              aria-current={s === screen ? "true" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-[14px] transition-colors",
                s === screen ? "border-brand/50 bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[12px] font-semibold">{i + 1}</span>
              {t(`pv.s.${s}` as TKey)}
            </button>
          ))}
        </nav>

        <div className="flex flex-col items-center gap-4">
          <p className="max-w-md text-center text-[14px] text-muted-foreground" aria-live="polite">
            {t(`pv.s.${screen}.note` as TKey)}
          </p>
          {screen === "subtitles" ? <SubtitlesScene /> : <AppWindow screen={screen} go={setScreen} />}
        </div>
      </div>
    </main>
  );
}

/* ---------- The desktop window ---------- */

function AppWindow({ screen, go }: { screen: Screen; go: (s: Screen) => void }) {
  const { t } = useT();
  const back = screen === "score" ? "pick" : "home";
  return (
    <div className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl shadow-black/40">
      <div className="flex h-8 items-center justify-end gap-4 border-b border-border px-3 text-muted-foreground" aria-hidden>
        <span className="h-px w-2.5 bg-current" />
        <span className="size-2.5 rounded-[2px] border border-current" />
        <X className="size-3.5" />
      </div>
      <header className="flex h-14 items-center gap-2.5 px-5 pt-2">
        {screen === "home" ? (
          <Logo className="size-6" />
        ) : (
          <Button variant="ghost" onClick={() => go(back)} className="-ml-2 h-9 gap-1.5 px-2 text-[14px] text-muted-foreground hover:text-foreground">
            <ArrowLeft />
            {t("pv.back")}
          </Button>
        )}
        {screen === "home" && <span className="text-[17px] font-semibold tracking-[-0.01em] font-stretch-[112%]">Sanay</span>}
        <span className="glass ml-auto flex h-7 items-center gap-2 rounded-full px-3 text-[12px] text-muted-foreground">
          <span className="size-2 rounded-full bg-ok" />
          <span className="font-semibold text-ok">{screen === "call" ? t("pv.practicing") : t("pv.ready")}</span>
        </span>
        {screen === "home" && (
          <Button variant="ghost" size="icon" aria-label={t("pv.settings")} className="-mr-2">
            <SettingsIcon />
          </Button>
        )}
      </header>
      <div className="min-h-[600px] px-5 pt-2 pb-6">
        {screen === "home" && <HomeScreen go={go} />}
        {screen === "pick" && <PickScreen go={go} />}
        {screen === "call" && <CallScreen go={go} />}
        {screen === "score" && <ScoreScreen go={go} />}
        {screen === "english" && <SayInEnglish />}
        {screen === "coach" && <CoachScreen />}
        {screen === "notice" && <NoticeScreen go={go} />}
      </div>
    </div>
  );
}

function useLevel(active = true) {
  const [level, setLevel] = useState(0.3);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = (t: number) => {
      setLevel(0.25 + 0.35 * Math.abs(Math.sin(t / 380) * Math.sin(t / 1170)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return level;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-[13px] font-medium text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Row({ icon, title, sub, onClick, accent }: { icon: ReactNode; title: string; sub: string; onClick?: () => void; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors hover:bg-secondary",
        accent ? "border-brand/40 bg-accent/60" : "border-border bg-card",
      )}
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", accent ? "bg-brand text-brand-foreground" : "bg-secondary text-foreground")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="block truncate text-[13px] text-muted-foreground">{sub}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/* ---------- Screens ---------- */

function HomeScreen({ go }: { go: (s: Screen) => void }) {
  const { t } = useT();
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center">
        <div className="relative aspect-square w-56">
          <Orb on voice="natural" level={0.25} className="absolute inset-0 size-full" />
        </div>
        <p className="text-[15px] font-medium">{t("pv.home.on")}</p>
        <p className="text-[12px] text-muted-foreground">{t("pv.home.onBody")}</p>
      </div>

      <Section title={t("pv.home.before")}>
        <Row accent icon={<Mic className="size-[18px]" />} title={t("pv.home.practice")} sub={t("pv.home.practiceSub")} onClick={() => go("pick")} />
        <Row icon={<Languages className="size-[18px]" />} title={t("pv.home.english")} sub={t("pv.home.englishSub")} onClick={() => go("english")} />
        <Row icon={<BookOpen className="size-[18px]" />} title={t("pv.home.coach")} sub={t("pv.home.coachSub")} onClick={() => go("coach")} />
      </Section>

      <Section title={t("pv.home.during")}>
        <Row icon={<Captions className="size-[18px]" />} title={t("pv.home.subtitles")} sub={t("pv.home.subtitlesSub")} onClick={() => go("subtitles")} />
        <Row icon={<Volume2 className="size-[18px]" />} title={t("pv.home.voice")} sub={t("pv.home.voiceSub")} onClick={() => go("notice")} />
      </Section>
    </div>
  );
}

type Level = "easy" | "medium" | "hard";
const PACKS: { id: string; icon: ReactNode }[] = [
  { id: "jobs", icon: <Briefcase className="size-4" /> },
  { id: "ofw", icon: <Plane className="size-4" /> },
  { id: "students", icon: <GraduationCap className="size-4" /> },
];
const SITUATIONS: Record<string, { id: string; level: Level }[]> = {
  jobs: [
    { id: "firstJob", level: "easy" },
    { id: "late", level: "medium" },
    { id: "bank", level: "hard" },
  ],
  ofw: [
    { id: "employer", level: "easy" },
    { id: "visa", level: "medium" },
  ],
  students: [
    { id: "college", level: "easy" },
    { id: "scholar", level: "medium" },
  ],
};

function PickScreen({ go }: { go: (s: Screen) => void }) {
  const { t } = useT();
  const [pack, setPack] = useState("jobs");
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.01em]">{t("pv.pick.title")}</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">{t("pv.pick.body")}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {PACKS.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={pack === p.id}
            onClick={() => setPack(p.id)}
            className={cn(
              "flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[14px]",
              pack === p.id ? "border-transparent bg-primary text-primary-foreground" : "border-border text-muted-foreground",
            )}
          >
            {p.icon}
            {t(`pv.pack.${p.id}` as TKey)}
          </button>
        ))}
      </div>
      <div className="space-y-2.5">
        {SITUATIONS[pack]!.map((s) => (
          <button key={s.id} onClick={() => go("call")} className="w-full rounded-xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-secondary">
            <span className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-medium">{t(`pv.sit.${s.id}` as TKey)}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  s.level === "hard" ? "bg-destructive/15 text-destructive" : s.level === "medium" ? "bg-warn/15 text-warn" : "bg-ok/15 text-ok",
                )}
              >
                {t(`pv.level.${s.level}` as TKey)}
              </span>
            </span>
            <span className="mt-0.5 block text-[13px] text-muted-foreground">{t(`pv.sit.${s.id}.sub` as TKey)}</span>
          </button>
        ))}
      </div>
      <p className="text-[12px] text-muted-foreground">{t("pv.pick.foot")}</p>
    </div>
  );
}

// What is said in the practice call stays in English: that is the language being practised.
const TURNS = [
  { who: "them", text: "Hi, this is about my order. It was supposed to arrive five days ago!" },
  { who: "you", text: "I'm really sorry about that, ma'am. May I have your order number, please?" },
  { who: "them", text: "It's 4-8-1-7. And I want to know why nobody told me." },
];

function CallScreen({ go }: { go: (s: Screen) => void }) {
  const { t } = useT();
  const level = useLevel();
  const [muted, setMuted] = useState(false);
  return (
    <div className="flex min-h-[580px] flex-col">
      <div className="text-center">
        <p className="text-[13px] text-muted-foreground">{t("pv.call.situation")}</p>
        <p className="mt-0.5 text-[15px] font-medium">{t("pv.call.who")} · 01:24</p>
      </div>
      <div className="relative mx-auto mt-2 aspect-square w-60">
        <Orb on voice="feminine" level={level} className="absolute inset-0 size-full" />
      </div>
      <div className="flex-1 space-y-2.5" aria-live="polite">
        {TURNS.map((turn, i) => (
          <p
            key={i}
            lang="en"
            className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug",
              turn.who === "you" ? "ml-auto rounded-br-md bg-brand text-brand-foreground" : "rounded-bl-md bg-secondary",
              i === TURNS.length - 1 && "ring-1 ring-brand/40",
            )}
          >
            {turn.text}
          </p>
        ))}
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Sparkles className="size-3.5 text-brand" /> {t("pv.call.tip")}
        </p>
      </div>
      <div className="mt-5 flex items-start justify-center gap-6">
        <CallButton label={muted ? t("pv.call.unmute") : t("pv.call.mute")}>
          <button
            onClick={() => setMuted((m) => !m)}
            aria-pressed={muted}
            className={cn("grid size-14 place-items-center rounded-full border", muted ? "border-transparent bg-foreground text-background" : "border-border bg-card")}
          >
            {muted ? <MicOff /> : <Mic />}
          </button>
        </CallButton>
        <CallButton label={t("pv.call.hangup")}>
          <button onClick={() => go("score")} className="grid size-16 place-items-center rounded-full bg-destructive text-white">
            <PhoneOff />
          </button>
        </CallButton>
        <CallButton label={t("pv.home.english")}>
          <button onClick={() => go("english")} className="grid size-14 place-items-center rounded-full border border-border bg-card">
            <Languages />
          </button>
        </CallButton>
      </div>
    </div>
  );
}

/** A round call button with its name written under it (no guessing what an icon means). */
function CallButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex w-20 flex-col items-center gap-1.5 text-center text-[12px] text-muted-foreground">
      {children}
      {label}
    </label>
  );
}

const SKILLS: [TKey, number][] = [
  ["pv.skill.clear", 82],
  ["pv.skill.empathy", 74],
  ["pv.skill.flow", 68],
  ["pv.skill.grammar", 79],
  ["pv.skill.pace", 61],
];

function ScoreScreen({ go }: { go: (s: Screen) => void }) {
  const { t } = useT();
  const ready = 74;
  const r = 52;
  const c = 2 * Math.PI * r;
  const moments = [
    { time: "00:41", text: "“Uhm, parang… we will check it po.”", fix: t("pv.score.m1.fix") },
    { time: "01:58", text: t("pv.score.m2"), fix: t("pv.score.m2.fix") },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-5">
        <div className="relative size-32 shrink-0">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={r} fill="none" stroke="var(--secondary)" strokeWidth="10" />
            <circle cx="60" cy="60" r={r} fill="none" stroke="var(--brand)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - ready / 100)} />
          </svg>
          <span className="absolute inset-0 grid place-items-center text-center">
            <span>
              <span className="block text-3xl font-semibold">{ready}</span>
              <span className="block text-[11px] text-muted-foreground">{t("pv.score.ready")}</span>
            </span>
          </span>
        </div>
        <div>
          <p className="text-lg font-semibold">{t("pv.score.verdict")}</p>
          <p className="mt-1 text-[14px] text-muted-foreground">{t("pv.score.feedback")}</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {SKILLS.map(([k, value]) => (
          <div key={k} className="flex items-center gap-3 text-[14px]">
            <span className="w-28 shrink-0">{t(k)}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${value}%` }} />
            </span>
            <span className="w-8 text-right tabular-nums text-muted-foreground">{value}</span>
          </div>
        ))}
        <p className="text-[13px] text-muted-foreground">
          {t("pv.score.fillers")} <span className="text-foreground">“ahh” ×4, “parang” ×2</span>
        </p>
      </div>

      <Section title={t("pv.score.replay")}>
        {moments.map((m) => (
          <div key={m.time} className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="size-9 shrink-0 rounded-full" aria-label={`${t("pv.score.play")} ${m.time}`}>
                <Play className="size-3.5" />
              </Button>
              <span className="text-[12px] tabular-nums text-muted-foreground">{m.time}</span>
              <span className="truncate text-[14px]">{m.text}</span>
            </div>
            <p className="mt-2 text-[13px] text-ok">{m.fix}</p>
          </div>
        ))}
      </Section>

      <div className="flex gap-2.5">
        <Button className="h-11 flex-1 text-[15px]" onClick={() => go("call")}>
          <RotateCcw /> {t("pv.score.again")}
        </Button>
        <Button variant="outline" className="h-11 flex-1 bg-card text-[15px]" onClick={() => go("coach")}>
          {t("pv.score.sounds")}
        </Button>
      </div>
    </div>
  );
}

function CoachScreen() {
  const { t } = useT();
  const drills: { pair: string; words: string; done: boolean }[] = [
    { pair: "F / P", words: "fan · pan", done: true },
    { pair: "V / B", words: "vote · boat", done: false },
    { pair: "TH", words: "three · tree", done: false },
    { pair: t("pv.coach.shortLong"), words: "ship · sheep", done: false },
    { pair: t("pv.coach.stress"), words: "PREsent · preSENT", done: false },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.01em]">{t("pv.s.coach")}</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">{t("pv.coach.body")}</p>
      </div>
      <div className="rounded-xl border border-brand/40 bg-accent/60 p-4">
        <p className="text-[12px] font-medium text-accent-foreground">{t("pv.coach.now")}</p>
        <p lang="en" className="mt-2 text-center text-3xl font-semibold tracking-[-0.02em]">
          <span className="text-brand">v</span>ery <span className="text-brand">b</span>ig <span className="text-brand">v</span>an
        </p>
        <p className="mt-3 text-[13px] text-muted-foreground">{t("pv.coach.tip")}</p>
        <div className="mt-4 flex justify-center gap-2.5">
          <Button variant="outline" className="h-11 bg-card">
            <Volume2 /> {t("pv.coach.hear")}
          </Button>
          <Button className="h-11">
            <Mic /> {t("pv.coach.say")}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {drills.map((d) => (
          <div key={d.words} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5">
            <span className="w-32 text-[14px] font-medium">{d.pair}</span>
            <span lang="en" className="flex-1 text-[13px] text-muted-foreground">
              {d.words}
            </span>
            {d.done && <span className="text-[12px] text-ok">{t("pv.coach.done")}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function NoticeScreen({ go }: { go: (s: Screen) => void }) {
  const { t } = useT();
  const [agree, setAgree] = useState(false);
  const rules: TKey[] = ["pv.notice.r1", "pv.notice.r2", "pv.notice.r3", "pv.notice.r4"];
  return (
    <div className="space-y-5">
      <div className="relative mx-auto aspect-square w-36">
        <Orb on voice="feminine" level={0.3} className="absolute inset-0 size-full" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold tracking-[-0.01em]">{t("pv.notice.title")}</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">{t("pv.notice.body")}</p>
      </div>
      <ul className="space-y-2.5 text-[14px]">
        {rules.map((r) => (
          <li key={r} className="flex gap-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
            {t(r)}
          </li>
        ))}
      </ul>
      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-[14px]">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="size-5 accent-[var(--brand)]" />
        {t("pv.notice.agree")}
      </label>
      <Button className="h-11 w-full text-[15px]" disabled={!agree} onClick={() => go("home")}>
        {t("pv.notice.use")}
      </Button>
    </div>
  );
}

/* ---------- Subtitles: a floating window over a real call ---------- */

function SubtitlesScene() {
  const { t } = useT();
  return (
    <div className="relative w-full max-w-[680px] overflow-hidden rounded-2xl border border-border bg-[#1b1d22] shadow-2xl shadow-black/40">
      <div className="flex h-9 items-center gap-2 border-b border-white/10 px-3 text-[12px] text-white/60">
        <span className="size-2 rounded-full bg-red-500" /> {t("pv.sub.app")}
      </div>
      <div className="grid aspect-video grid-cols-2 gap-2 p-3">
        <div className="grid place-items-center rounded-lg bg-[#2a2d34] text-[13px] text-white/70">{t("pv.sub.interviewer")}</div>
        <div className="grid place-items-center rounded-lg bg-[#2a2d34] text-[13px] text-white/70">{t("pv.sub.you")}</div>
      </div>
      <div className="glass absolute inset-x-4 bottom-4 rounded-2xl p-3.5 sm:inset-x-auto sm:right-4 sm:w-[340px]">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Logo className="size-4" />
          <span className="font-medium text-foreground">{t("pv.sub.title")}</span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-ok" /> {t("pv.sub.live")}
          </span>
        </div>
        <p lang="en" className="mt-2 text-[12px] text-muted-foreground">
          “Can you walk me through your last job?”
        </p>
        <p lang="fil" className="mt-0.5 text-[16px] font-medium leading-snug">
          {t("pv.sub.fil")}
        </p>
      </div>
    </div>
  );
}
