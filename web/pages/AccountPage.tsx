import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AudioLines,
  BookOpen,
  Cable,
  CircleCheck,
  CreditCard,
  ExternalLink,
  House,
  KeyRound,
  Laptop,
  Languages,
  LoaderCircle,
  LogOut,
  Mic,
  Monitor,
  PhoneCall,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Orb } from "../../src/components/Orb";
import { ThemeChoice } from "../../src/components/ThemeToggle";
import { fill, useT, type TKey } from "../../src/i18n";
import { useAuth } from "../auth/AuthContext";
import {
  AuthError,
  isEmail,
  MIN_PASSWORD,
  type Lang,
  type ProfilePatch,
  type UseCase,
  type User,
  type VoicePref,
} from "../auth/backend";
import { navigate, useSubroute } from "../router";
import { PasswordInput } from "./AuthPage";
import { SayInEnglish } from "./SayInEnglish";
import { PracticeInterview } from "./PracticeInterview";
import { PronunciationCoach } from "./PronunciationCoach";
import { BackLink } from "../BackLink";
import {
  CountrySelect,
  LanguageSelect,
  UseCaseChips,
  VoiceTiles,
} from "./fields";

const VB_CABLE_URL = "https://vb-audio.com/Cable/";

type Tab =
  | "overview"
  | "practice"
  | "english"
  | "coach"
  | "profile"
  | "preferences"
  | "devices"
  | "plan"
  | "security";
/** The sidebar: the practice tools first (what people come for), then the account itself. */
const GROUPS: { label: TKey | null; tabs: [Tab, typeof House][] }[] = [
  { label: null, tabs: [["overview", House]] },
  {
    label: "account.group.practice",
    tabs: [
      ["practice", PhoneCall],
      ["english", Languages],
      ["coach", Mic],
    ],
  },
  {
    label: "account.group.account",
    tabs: [
      ["profile", UserRound],
      ["preferences", SlidersHorizontal],
      ["devices", Laptop],
      ["plan", CreditCard],
      ["security", KeyRound],
    ],
  },
];
const TABS = GROUPS.flatMap((g) => g.tabs);

export function AccountPage({
  lang,
  setLang,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
}) {
  const { t } = useT();
  const { user, ready } = useAuth();
  const sub = useSubroute();
  const tab: Tab = (TABS.map(([k]) => k) as string[]).includes(sub)
    ? (sub as Tab)
    : "overview";

  // Opening the account while signed out goes to log-in; signing out or deleting goes home itself.
  const hadUser = useRef(false);
  if (user) hadUser.current = true;
  useEffect(() => {
    if (ready && !user && !hadUser.current) navigate("login");
  }, [ready, user]);
  if (!user) return <div className="min-h-svh" />;

  return (
    <section className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 pt-24 pb-24 sm:px-8 lg:grid-cols-[232px_1fr] lg:pt-28">
      <Sidebar user={user} tab={tab} />
      <div
        key={tab}
        className="min-w-0 animate-in fade-in slide-in-from-bottom-1 duration-500 ease-out-expo"
      >
        <header className="mb-8">
          {tab === "overview" ? (
            <BackLink label={t("back.home")} onClick={() => navigate("home")} className="mb-4" />
          ) : (
            <BackLink label={t("back.overview")} onClick={() => navigate("account")} className="mb-4" />
          )}
          <h1 className="text-[clamp(1.8rem,3vw,2.4rem)] leading-tight font-semibold tracking-[-0.03em] font-stretch-[106%]">
            {tab === "overview"
              ? greeting(t, user)
              : t(`account.tab.${tab}` as TKey)}
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            {tab === "overview" ? (
              <>
                {t("account.planName")}{" "}
                <span aria-hidden className="mx-1.5 opacity-40">
                  ·
                </span>{" "}
                {t("account.devices.none")}
              </>
            ) : (
              t(`account.tab.${tab}.body` as TKey)
            )}
          </p>
        </header>
        {tab === "overview" && <Overview user={user} />}
        {tab === "english" && (
          <Panel>
            <SayInEnglish bare />
          </Panel>
        )}
        {tab === "practice" && (
          <Panel>
            <PracticeInterview />
          </Panel>
        )}
        {tab === "coach" && (
          <Panel>
            <PronunciationCoach />
          </Panel>
        )}
        {tab === "profile" && <ProfileSection lang={lang} setLang={setLang} />}
        {tab === "preferences" && <PreferencesSection />}
        {tab === "devices" && <DevicesSection />}
        {tab === "plan" && <PlanSection />}
        {tab === "security" && <SecuritySection />}
      </div>
    </section>
  );
}

function greeting(t: (k: TKey) => string, user: User) {
  const h = new Date().getHours();
  const k =
    h < 12
      ? "account.hello.morning"
      : h < 18
        ? "account.hello.afternoon"
        : "account.hello.evening";
  return fill(t(k as TKey), { name: user.name.split(" ")[0] ?? user.name });
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** A small avatar in the user's voice light. */
export function Avatar({
  user,
  className,
}: {
  user: User;
  className?: string;
}) {
  const v = user.defaultVoice;
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold text-white",
        className,
      )}
      style={{
        background: `radial-gradient(circle at 50% 74%, #fff -15%, var(--voice-${v}) 52%, color-mix(in oklab, var(--voice-${v}) 38%, black) 100%)`,
        boxShadow: `0 0 18px -4px var(--voice-${v})`,
      }}
    >
      {initials(user.name)}
    </span>
  );
}

export async function signOut(
  backend: ReturnType<typeof useAuth>["backend"],
  setUser: (u: User | null) => void,
) {
  await backend.signOut();
  setUser(null);
  navigate("home");
}

function Sidebar({ user, tab }: { user: User; tab: Tab }) {
  const { t } = useT();
  const { backend, setUser } = useAuth();
  return (
    <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      {/* Identity, once. */}
      <div className="flex items-center gap-3">
        <Avatar user={user} className="size-11 text-[14px]" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{user.name}</p>
          <p className="truncate text-[13px] text-muted-foreground">
            {user.email}
          </p>
        </div>
      </div>
      <nav
        aria-label={t("account.title")}
        className="-mx-5 mt-6 overflow-x-auto px-5 lg:mx-0 lg:overflow-visible lg:px-0"
      >
        <ul className="flex gap-1 lg:flex-col">
          {GROUPS.flatMap((g) => [
            g.label ? (
              <li
                key={g.label}
                aria-hidden
                className="hidden px-3 pt-4 pb-1 text-[11px] font-medium tracking-[0.06em] text-muted-foreground/80 uppercase lg:block"
              >
                {t(g.label)}
              </li>
            ) : null,
            ...g.tabs.map(([k, Icon]) => {
              const on = k === tab;
              return (
                <li key={k}>
                  <a
                    href={`#/account/${k}`}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-lg px-3 text-[14px] whitespace-nowrap transition-colors",
                      on
                        ? "bg-foreground/[0.07] font-medium text-foreground"
                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                    )}
                  >
                    <Icon
                      aria-hidden
                      className={cn("size-4", on && "text-brand")}
                    />{" "}
                    {t(`account.tab.${k}` as TKey)}
                  </a>
                </li>
              );
            }),
          ])}
        </ul>
      </nav>
      <a
        href="#/guide"
        className="mt-6 hidden h-9 items-center gap-2.5 rounded-lg px-3 text-[14px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground lg:flex"
      >
        <BookOpen aria-hidden className="size-4" /> {t("guide.title")}
      </a>
      <button
        type="button"
        onClick={() => signOut(backend, setUser)}
        className="hidden h-9 w-full items-center gap-2.5 rounded-lg px-3 text-[14px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground lg:flex"
      >
        <LogOut aria-hidden className="size-4" /> {t("account.signOut")}
      </button>
    </aside>
  );
}

function Panel({
  title,
  body,
  children,
  className,
}: {
  title?: string;
  body?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("glass rounded-2xl p-6 sm:p-8", className)}>
      {title && (
        <h2 className="text-[18px] font-semibold tracking-[-0.02em]">
          {title}
        </h2>
      )}
      {body && <p className="mt-1 text-[14px] text-muted-foreground">{body}</p>}
      <div className={title || body ? "mt-6" : ""}>{children}</div>
    </section>
  );
}

// ───────────────────────────── overview ─────────────────────────────

type StepId = "account" | "voice" | "cable" | "app" | "call";
const PATH: [StepId, typeof House][] = [
  ["account", UserRound],
  ["voice", AudioLines],
  ["cable", Cable],
  ["app", Monitor],
  ["call", PhoneCall],
];

function Overview({ user }: { user: User }) {
  const { t } = useT();
  // What we can know from the website: the account and voice exist. The rest happens on the computer.
  const done: Record<StepId, boolean> = {
    account: true,
    voice: true,
    cable: false,
    app: false,
    call: false,
  };
  const next = PATH.find(([id]) => !done[id])?.[0] ?? "call";
  const count = PATH.filter(([id]) => done[id]).length;

  return (
    <div className="space-y-6">
      {/* Practice first: the main reason people come. Big, plain buttons. */}
      <section className="glass rounded-2xl p-6 sm:p-8">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em]">{t("account.practiceNow")}</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">{t("account.practiceNow.body")}</p>
        <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
          {(
            [
              ["practice", PhoneCall],
              ["english", Languages],
              ["coach", Mic],
            ] as const
          ).map(([k, Icon]) => (
            <a
              key={k}
              href={`#/account/${k}`}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-[15px] font-medium transition-colors",
                k === "practice" ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90" : "border-border bg-card hover:bg-secondary",
              )}
            >
              <Icon aria-hidden className={cn("size-5 shrink-0", k !== "practice" && "text-brand")} />
              {t(`account.tab.${k}` as TKey)}
            </a>
          ))}
        </div>
      </section>

      {/* Your voice */}
      <section className="glass relative overflow-hidden rounded-2xl">
        <div className="grid items-center gap-2 p-6 sm:p-8 md:grid-cols-[1fr_auto]">
          <div className="relative z-10">
            <p className="text-[13px] font-medium text-muted-foreground">
              {t("account.yourVoice")}
            </p>
            <p className="mt-1 text-[clamp(1.9rem,3.4vw,2.6rem)] leading-tight font-semibold tracking-[-0.03em] font-stretch-[106%]">
              {t(`web.voice.${user.defaultVoice}` as TKey)}
            </p>
            <p className="mt-2 max-w-sm text-[14px] text-muted-foreground">
              {t(`voice.${user.defaultVoice}.desc` as TKey)}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  navigate("home");
                  window.setTimeout(
                    () =>
                      document
                        .getElementById("lab")
                        ?.scrollIntoView({ behavior: "smooth" }),
                    700,
                  );
                }}
                className="h-10 gap-2 rounded-full px-5"
              >
                <AudioLines aria-hidden className="size-4" />{" "}
                {t("web.hero.cta")}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("account", "preferences")}
                className="h-10 rounded-full bg-transparent px-5"
              >
                {t("account.changeVoice")}
              </Button>
            </div>
          </div>
          <div
            className="relative -my-12 -mr-6 hidden aspect-square w-72 md:block"
            style={{ viewTransitionName: "orb" }}
          >
            <Orb
              on
              silk
              voice={user.defaultVoice}
              level={0}
              className="absolute inset-0 size-full"
            />
          </div>
        </div>
      </section>

      {/* Setup as the path your voice travels */}
      <section className="glass rounded-2xl p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em]">
            {t("account.setup.title")}
          </h2>
          <p className="text-[13px] text-muted-foreground tabular-nums">
            {fill(t("account.setup.progress"), {
              done: String(count),
              total: String(PATH.length),
            })}
          </p>
        </div>
        <SignalPath done={done} next={next} />
        <NextStep step={next} />
      </section>

      {/* Guides */}
      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em]">
            {t("account.guides")}
          </h2>
          <a
            href="#/guide"
            className="text-[13px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("account.guidesAll")}
          </a>
        </div>
        <div className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
          {(["calls", "pill", "help"] as const).map((id) => (
            <a
              key={id}
              href={`#/guide/${id}`}
              className="group bg-background p-5 transition-colors hover:bg-card"
            >
              <span className="block text-[15px] font-semibold">
                {t(`account.guide.${id}` as TKey)}
              </span>
              <span className="mt-1 block text-[13px] text-muted-foreground">
                {t(`account.guide.${id}.body` as TKey)}
              </span>
              <span
                className="mt-4 block h-px w-8 bg-brand transition-[width] duration-500 ease-out-expo group-hover:w-16"
                aria-hidden
              />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

/** The setup drawn as the path your voice travels: lit up to where you are, the next stop breathing. */
function SignalPath({
  done,
  next,
}: {
  done: Record<StepId, boolean>;
  next: StepId;
}) {
  const { t } = useT();
  const lit = PATH.findIndex(([id]) => id === next); // nodes before `next` are done
  return (
    <ol
      className="relative mt-8 grid grid-cols-5"
      aria-label={t("account.setup.title")}
    >
      {/* the line: dim track, lit up to the next stop */}
      <span
        aria-hidden
        className="absolute top-5 right-[10%] left-[10%] h-px bg-border"
      />
      <span
        aria-hidden
        className="absolute top-5 left-[10%] h-px bg-gradient-to-r from-brand/40 to-brand shadow-[0_0_10px_var(--brand)] transition-[width] duration-1000 ease-out-expo"
        style={{ width: `${(Math.max(lit, 0) / (PATH.length - 1)) * 80}%` }}
      />
      {PATH.map(([id, Icon]) => {
        const isDone = done[id];
        const isNext = id === next;
        return (
          <li
            key={id}
            className="relative flex flex-col items-center text-center"
          >
            <span
              className={cn(
                "relative grid size-10 place-items-center rounded-full border transition-colors",
                isDone &&
                  "border-transparent bg-brand text-brand-foreground shadow-[0_0_18px_-2px_var(--brand)]",
                isNext && "border-brand bg-background text-brand",
                !isDone &&
                  !isNext &&
                  "border-border bg-background text-muted-foreground",
              )}
            >
              {isNext && (
                <span
                  aria-hidden
                  className="absolute inset-0 animate-ping rounded-full border border-brand/50 [animation-duration:2.4s]"
                />
              )}
              <Icon aria-hidden className="size-4" />
            </span>
            <span
              className={cn(
                "mt-3 text-[12px] leading-tight sm:text-[13px]",
                isDone || isNext
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {t(`account.path.${id}` as TKey)}
            </span>
            <span className="sr-only">
              {isDone ? t("account.setup.done") : t("account.setup.todo")}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** One clear next step, with why it matters and how to do it. */
function NextStep({ step }: { step: StepId }) {
  const { t } = useT();
  return (
    <div className="mt-8 grid gap-4 rounded-xl border border-border p-5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <p className="text-[12px] font-medium text-brand">
          {t("account.next")}
        </p>
        <p className="mt-1 text-[16px] font-semibold">
          {t(`account.next.${step}` as TKey)}
        </p>
        <p className="mt-1 text-[14px] text-muted-foreground">
          {t(`account.next.${step}.body` as TKey)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {step === "cable" && (
          <Button asChild className="h-10 gap-2 rounded-full px-5">
            <a href={VB_CABLE_URL} target="_blank" rel="noreferrer">
              {t("account.setup.cableCta")}{" "}
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          </Button>
        )}
        <Button
          asChild
          variant="outline"
          className="h-10 rounded-full bg-transparent px-5"
        >
          <a
            href={`#/guide/${step === "cable" ? "vbcable" : step === "app" ? "setup" : "calls"}`}
          >
            {t("account.readGuide")}
          </a>
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────────── sections ─────────────────────────────

/** Saves a patch and shows the outcome next to the button. */
function useSave() {
  const { backend, setUser } = useAuth();
  const [state, setState] = useState<"idle" | "busy" | "saved" | TKey>("idle");
  const save = async (patch: ProfilePatch) => {
    setState("busy");
    try {
      setUser(await backend.updateProfile(patch));
      setState("saved");
      window.setTimeout(
        () => setState((s) => (s === "saved" ? "idle" : s)),
        2200,
      );
    } catch (e) {
      setState(
        e instanceof AuthError
          ? (`auth.err.${e.code}` as TKey)
          : ("auth.err.other" as TKey),
      );
    }
  };
  return { state, save };
}

function SaveRow({
  state,
  dirty,
}: {
  state: ReturnType<typeof useSave>["state"];
  dirty: boolean;
}) {
  const { t } = useT();
  return (
    <div className="mt-8 flex items-center gap-4">
      <Button
        type="submit"
        disabled={!dirty || state === "busy"}
        className="h-10 gap-2 rounded-full px-5"
      >
        {state === "busy" && (
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
        )}
        {t("account.save")}
      </Button>
      <span aria-live="polite" className="text-[13px]">
        {state === "saved" && (
          <span className="flex items-center gap-1.5 text-ok animate-in fade-in duration-300">
            <CircleCheck aria-hidden className="size-4" /> {t("account.saved")}
          </span>
        )}
        {state !== "idle" && state !== "busy" && state !== "saved" && (
          <span className="text-destructive">{t(state)}</span>
        )}
      </span>
    </div>
  );
}

function ProfileSection({
  lang,
  setLang,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
}) {
  const { t } = useT();
  const { user } = useAuth();
  const { state, save } = useSave();
  const [name, setName] = useState(user!.name);
  const [email, setEmail] = useState(user!.email);
  const [country, setCountry] = useState(user!.country);
  const [language, setLanguage] = useState<Lang>(user!.language);
  const dirty =
    name !== user!.name ||
    email !== user!.email ||
    country !== user!.country ||
    language !== user!.language;
  const invalid = !name.trim() || !isEmail(email);
  const since = new Date(user!.createdAt).toLocaleDateString(
    lang === "fil" ? "fil-PH" : "en",
    { year: "numeric", month: "long", day: "numeric" },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    void save({ name, email, country, language });
    if (language !== lang) setLang(language);
  };

  return (
    <Panel>
      <form onSubmit={submit} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <LabeledInput
            id="p-name"
            label={t("auth.name")}
            value={name}
            onChange={setName}
            autoComplete="name"
            error={!name.trim() ? t("auth.err.name") : null}
          />
          <LabeledInput
            id="p-email"
            label={t("auth.email")}
            value={email}
            onChange={setEmail}
            type="email"
            autoComplete="email"
            error={!isEmail(email) ? t("auth.err.bad_email") : null}
          />
          <div className="space-y-2">
            <Label htmlFor="p-country" className="text-[14px] font-semibold">
              {t("auth.country")}
            </Label>
            <CountrySelect
              id="p-country"
              value={country}
              onChange={setCountry}
              lang={lang}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-lang" className="text-[14px] font-semibold">
              {t("web.language")}
            </Label>
            <LanguageSelect
              id="p-lang"
              value={language}
              onChange={setLanguage}
            />
          </div>
        </div>
        <SaveRow state={state} dirty={dirty && !invalid} />
        <p className="mt-8 border-t border-border pt-5 text-[13px] text-muted-foreground">
          {fill(t("account.since"), { date: since })}
        </p>
      </form>
    </Panel>
  );
}

function PreferencesSection() {
  const { t } = useT();
  const { user } = useAuth();
  const { state, save } = useSave();
  const [useCase, setUseCase] = useState<UseCase | "">(user!.useCase);
  const [voice, setVoice] = useState<VoicePref>(user!.defaultVoice);
  const dirty = useCase !== user!.useCase || voice !== user!.defaultVoice;
  return (
    <div className="space-y-6">
      <Panel title={t("account.sanay")} body={t("account.sanayBody")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save({ useCase, defaultVoice: voice });
          }}
        >
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-2">
              <span className="block text-[14px] font-semibold">
                {t("auth.voice")}
              </span>
              <VoiceTiles value={voice} onChange={setVoice} />
            </div>
            <div className="space-y-2">
              <span className="block text-[14px] font-semibold">
                {t("auth.useCase")}
              </span>
              <UseCaseChips value={useCase} onChange={setUseCase} />
            </div>
          </div>
          <SaveRow state={state} dirty={dirty} />
        </form>
      </Panel>
      <Panel title={t("theme.title")} body={t("account.appearanceBody")}>
        <div className="max-w-sm">
          <ThemeChoice />
        </div>
      </Panel>
    </div>
  );
}

function DevicesSection() {
  const { t } = useT();
  return (
    <Panel>
      <div className="flex flex-col items-center py-10 text-center">
        <span className="grid size-14 place-items-center rounded-full border border-border text-muted-foreground">
          <Monitor aria-hidden className="size-6" />
        </span>
        <p className="mt-5 text-[17px] font-semibold">
          {t("account.devices.none")}
        </p>
        <p className="mt-2 max-w-md text-[14px] text-muted-foreground">
          {t("account.devices.body")}
        </p>
        <p className="mt-6 text-[13px] text-muted-foreground">
          {t("web.desktopSoon")}
        </p>
      </div>
    </Panel>
  );
}

function PlanSection() {
  const { t } = useT();
  const items: TKey[] = [
    "account.planItem1",
    "account.planItem2",
    "account.planItem3",
  ];
  return (
    <Panel>
      <p className="flex items-center gap-2.5 text-[18px] font-semibold">
        <span
          aria-hidden
          className="size-2 rounded-full bg-brand shadow-[0_0_10px_var(--brand)]"
        />{" "}
        {t("account.planName")}
      </p>
      <p className="mt-2 max-w-xl text-[14px] text-muted-foreground">
        {t("account.planBody")}
      </p>
      <ul className="mt-6 space-y-2.5 text-[14px]">
        {items.map((k) => (
          <li key={k} className="flex items-start gap-2.5">
            <CircleCheck
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-ok"
            />{" "}
            {t(k)}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function SecuritySection() {
  const { t } = useT();
  const { backend, setUser } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | TKey>("idle");
  const mismatch = confirm.length > 0 && next !== confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < MIN_PASSWORD)
      return setState("auth.err.weak_password" as TKey);
    if (next !== confirm) return setState("account.err.mismatch" as TKey);
    setState("busy");
    try {
      await backend.changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setState("done");
    } catch (err) {
      setState(
        err instanceof AuthError
          ? (`auth.err.${err.code}` as TKey)
          : ("auth.err.other" as TKey),
      );
    }
  };

  return (
    <div className="space-y-6">
      <Panel title={t("account.changePassword")}>
        <form onSubmit={submit} noValidate className="max-w-md space-y-4">
          <PwField
            id="s-cur"
            label={t("account.currentPassword")}
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
          />
          <PwField
            id="s-new"
            label={t("account.newPassword")}
            value={next}
            onChange={setNext}
            autoComplete="new-password"
          />
          <PwField
            id="s-conf"
            label={t("account.confirmPassword")}
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
          {mismatch && (
            <p className="text-[13px] text-destructive">
              {t("account.err.mismatch")}
            </p>
          )}
          <div className="flex items-center gap-4 pt-2">
            <Button
              type="submit"
              disabled={!current || !next || !confirm || state === "busy"}
              className="h-10 gap-2 rounded-full px-5"
            >
              {state === "busy" && (
                <LoaderCircle aria-hidden className="size-4 animate-spin" />
              )}
              {t("account.updatePassword")}
            </Button>
            <span aria-live="polite" className="text-[13px]">
              {state === "done" && (
                <span className="flex items-center gap-1.5 text-ok">
                  <CircleCheck aria-hidden className="size-4" />{" "}
                  {t("account.passwordUpdated")}
                </span>
              )}
              {state !== "idle" && state !== "busy" && state !== "done" && (
                <span className="text-destructive">{t(state)}</span>
              )}
            </span>
          </div>
        </form>
      </Panel>

      <Panel title={t("account.session")} body={t("account.sessionBody")}>
        <Button
          variant="outline"
          onClick={() => signOut(backend, setUser)}
          className="h-10 gap-2 rounded-full bg-transparent px-5"
        >
          <LogOut aria-hidden className="size-4" /> {t("account.signOut")}
        </Button>
      </Panel>

      <section className="rounded-2xl border border-destructive/30 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.02em]">
              {t("account.delete")}
            </h2>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {t("account.deleteBody")}
            </p>
          </div>
          <DeleteAccount />
        </div>
      </section>
    </div>
  );
}

function DeleteAccount() {
  const { t } = useT();
  const { backend, setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TKey | null>(null);
  const confirmDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // keep the dialog open until the password checks out
    setBusy(true);
    setError(null);
    try {
      await backend.deleteAccount(password);
      setOpen(false);
      setUser(null);
      navigate("home");
    } catch (err) {
      setError(
        err instanceof AuthError
          ? (`auth.err.${err.code}` as TKey)
          : ("auth.err.other" as TKey),
      );
      setBusy(false);
    }
  };
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => (setOpen(o), o || (setPassword(""), setError(null)))}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="h-10 gap-2 rounded-full border-destructive/40 bg-transparent px-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 aria-hidden className="size-4" /> {t("account.delete")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="glass">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("account.deleteConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("account.deleteConfirmBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="d-pw" className="text-[14px] font-semibold">
            {t("auth.password")}
          </Label>
          <PasswordInput
            id="d-pw"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          {error && <p className="text-[13px] text-destructive">{t(error)}</p>}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">
            {t("account.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDelete}
            disabled={!password || busy}
            className="gap-2 rounded-full bg-destructive text-white hover:bg-destructive/90"
          >
            {busy && (
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
            )}
            {t("account.deleteForever")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function LabeledInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  error?: string | null;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[14px] font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11"
        aria-invalid={!!error}
      />
      {error && <p className="text-[13px] text-destructive">{error}</p>}
    </div>
  );
}

function PwField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.id} className="text-[14px] font-semibold">
        {props.label}
      </Label>
      <PasswordInput
        id={props.id}
        value={props.value}
        onChange={props.onChange}
        autoComplete={props.autoComplete}
      />
    </div>
  );
}
