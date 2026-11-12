import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Info, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Orb } from "../../src/components/Orb";
import { useT, type TKey } from "../../src/i18n";
import { useAuth } from "../auth/AuthContext";
import { AuthError, isEmail, MIN_PASSWORD, type Lang, type UseCase, type VoicePref } from "../auth/backend";
import { DEMO_ACCOUNT } from "../auth/demoAccount";
import { BackToPrevious } from "../BackLink";
import { navigate } from "../router";
import { CountrySelect, LanguageSelect, UseCaseChips, VoiceTiles } from "./fields";

/** Sign up (two steps) and log in, beside the living orb. */
export function AuthPage({ mode, lang, setLang }: { mode: "signup" | "login"; lang: Lang; setLang: (l: Lang) => void }) {
  const { t } = useT();
  const [voice, setVoice] = useState<VoicePref>("natural");
  const [pulse, setPulse] = useState(0);
  const [bloom, setBloom] = useState(false);
  const decay = useRef<number | undefined>(undefined);

  // The light follows you: every keystroke gives the orb a small pulse.
  const onType = () => {
    setPulse(0.55 + Math.random() * 0.3);
    window.clearTimeout(decay.current);
    decay.current = window.setTimeout(() => setPulse(0), 90);
  };

  const done = () => {
    setBloom(true); // the orb blooms, then the account opens
    window.setTimeout(() => navigate("account"), 650);
  };

  return (
    <section
      className="relative isolate grid min-h-svh overflow-hidden lg:grid-cols-[1.1fr_1fr]"
      style={{ ["--hero-voice" as string]: `var(--voice-${voice})` }}
    >
      {/* The light spans the whole page and fades softly under the form: no edges. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0 transition-[background] duration-1000"
          style={{ background: "radial-gradient(48% 55% at 27% 46%, color-mix(in oklab, var(--hero-voice) 13%, transparent), transparent 72%)" }}
        />
        <div className="absolute inset-0 [mask-image:linear-gradient(to_right,black_0%,black_38%,transparent_82%)] max-lg:[mask-image:none]">
          <div
            className="absolute top-[82%] left-1/2 aspect-square w-[150vw] -translate-x-1/2 rounded-full transition-[box-shadow,border-color] duration-1000 lg:top-[88%] lg:left-[27.5%] lg:w-[110vw]"
            style={{
              borderTop: "1.5px solid color-mix(in oklab, var(--hero-voice) 55%, white)",
              boxShadow: "0 -24px 100px -30px var(--hero-voice), inset 0 40px 120px -70px color-mix(in oklab, var(--hero-voice) 60%, transparent)",
            }}
          />
        </div>
      </div>

      {/* Stage */}
      <div className="relative hidden flex-col items-center justify-center lg:flex">
        <div className="relative -my-16 aspect-square w-[min(46vw,700px)]" style={{ viewTransitionName: "orb" }}>
          <Orb on silk voice={voice} level={bloom ? 1 : pulse} className={cn("absolute inset-0 size-full transition-transform duration-700 ease-out-expo", bloom && "scale-110")} />
        </div>
        <p className="relative max-w-sm text-center text-[15px] text-muted-foreground">{t(mode === "signup" ? "auth.stage.signup" : "auth.stage.login")}</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-5 pt-24 pb-12 sm:px-8 lg:pt-16">
        <div className="w-full max-w-[420px]">
          <BackToPrevious self={mode} className="mb-4" />
          <div className="mb-8 flex justify-center lg:hidden" style={{ viewTransitionName: "orb" }}>
            <div className="relative size-36">
              <Orb on voice={voice} level={bloom ? 1 : pulse} className="absolute inset-0 size-full" />
            </div>
          </div>
          {mode === "signup" ? (
            <SignUp voice={voice} setVoice={setVoice} onType={onType} onDone={done} lang={lang} setLang={setLang} />
          ) : (
            <LogIn onType={onType} onDone={done} setLang={setLang} />
          )}
        </div>
      </div>
    </section>
  );
}

const errorKey = (e: unknown): TKey =>
  e instanceof AuthError ? (`auth.err.${e.code}` as TKey) : ("auth.err.other" as TKey);

function SignUp({
  voice,
  setVoice,
  onType,
  onDone,
  lang,
  setLang,
}: {
  voice: VoicePref;
  setVoice: (v: VoicePref) => void;
  onType: () => void;
  onDone: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}) {
  const { t } = useT();
  const { backend, setUser } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [useCase, setUseCase] = useState<UseCase | "">("");
  const [country, setCountry] = useState("PH");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TKey | null>(null);
  const [touched, setTouched] = useState(false);

  const step1Errors = {
    name: !name.trim() ? ("auth.err.name" as TKey) : null,
    email: !isEmail(email) ? ("auth.err.bad_email" as TKey) : null,
    password: password.length < MIN_PASSWORD ? ("auth.err.weak_password" as TKey) : null,
  };

  const next = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.values(step1Errors).some(Boolean)) return;
    setError(null);
    setStep(2);
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await backend.signUp({ name, email, password, useCase, defaultVoice: voice, country, language: lang });
      setUser(u);
      onDone();
    } catch (err) {
      setError(errorKey(err));
      if (err instanceof AuthError && (err.code === "email_taken" || err.code === "bad_email")) setStep(1);
      setBusy(false);
    }
  };

  return (
    <div>
      <StepDots step={step} />
      {step === 1 ? (
        <form key="s1" onSubmit={next} noValidate className="animate-in fade-in slide-in-from-left-3 duration-500 ease-out-expo">
          <Heading title={t("auth.signup.title")} body={t("auth.signup.body")} />
          <div className="mt-8 space-y-4" onKeyDown={onType}>
            <Field id="name" label={t("auth.name")} error={touched ? step1Errors.name : null}>
              <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
            </Field>
            <Field id="email" label={t("auth.email")} error={touched ? step1Errors.email : null}>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
            </Field>
            <Field id="password" label={t("auth.password")} error={touched ? step1Errors.password : null} hint={t("auth.passwordHint")}>
              <PasswordInput id="password" autoComplete="new-password" value={password} onChange={setPassword} />
              <Strength password={password} />
            </Field>
          </div>
          {error && <FormError k={error} />}
          <Button type="submit" className="mt-8 h-12 w-full rounded-full text-[15px]">
            {t("auth.continue")}
          </Button>
          <SwitchLink text={t("auth.haveAccount")} action={t("auth.login.cta")} to="login" />
        </form>
      ) : (
        <form key="s2" onSubmit={create} className="animate-in fade-in slide-in-from-right-3 duration-500 ease-out-expo">
          <Heading title={t("auth.step2.title")} body={t("auth.step2.body")} />
          <div className="mt-8 space-y-6">
            <div className="space-y-2">
              <span className="block text-[14px] font-semibold">{t("auth.voice")}</span>
              <VoiceTiles value={voice} onChange={setVoice} />
            </div>
            <div className="space-y-2">
              <span className="block text-[14px] font-semibold">{t("auth.useCase")}</span>
              <UseCaseChips value={useCase} onChange={setUseCase} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="country" className="text-[14px] font-semibold">
                  {t("auth.country")}
                </Label>
                <CountrySelect id="country" value={country} onChange={setCountry} lang={lang} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="language" className="text-[14px] font-semibold">
                  {t("web.language")}
                </Label>
                <LanguageSelect id="language" value={lang} onChange={setLang} />
              </div>
            </div>
          </div>
          {error && <FormError k={error} />}
          <div className="mt-8 flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(1)} className="h-12 gap-2 rounded-full bg-transparent px-5 text-[15px]">
              <ArrowLeft aria-hidden className="size-4" />
              {t("setup.back")}
            </Button>
            <Button type="submit" disabled={busy} className="h-12 flex-1 gap-2 rounded-full text-[15px]">
              {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {t("auth.create")}
            </Button>
          </div>
        </form>
      )}
      <DemoNote />
    </div>
  );
}

function LogIn({ onType, onDone, setLang }: { onType: () => void; onDone: () => void; setLang: (l: Lang) => void }) {
  const { t } = useT();
  const { backend, setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TKey | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => emailRef.current?.focus(), []);

  /** Preview only: create the sample account if needed, then sign in to it. */
  const tryDemo = async () => {
    setBusy(true);
    setError(null);
    const d = DEMO_ACCOUNT;
    try {
      const u = await backend.signIn(d.email, d.password).catch(async (err) => {
        if (!(err instanceof AuthError) || err.code !== "bad_credentials") throw err;
        return backend.signUp({ email: d.email, password: d.password, name: d.name, ...d.profile });
      });
      setUser(u);
      setLang(u.language);
      onDone();
    } catch (err) {
      setError(errorKey(err));
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setError("auth.err.missing" as TKey);
    setBusy(true);
    setError(null);
    try {
      const u = await backend.signIn(email, password);
      setUser(u);
      setLang(u.language);
      onDone();
    } catch (err) {
      setError(errorKey(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out-expo">
      <Heading title={t("auth.login.title")} body={t("auth.login.body")} />
      <div className="mt-8 space-y-4" onKeyDown={onType}>
        <Field id="lemail" label={t("auth.email")}>
          <Input ref={emailRef} id="lemail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </Field>
        <Field id="lpassword" label={t("auth.password")}>
          <PasswordInput id="lpassword" autoComplete="current-password" value={password} onChange={setPassword} />
        </Field>
      </div>
      {error && <FormError k={error} />}
      <Button type="submit" disabled={busy} className="mt-8 h-12 w-full gap-2 rounded-full text-[15px]">
        {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
        {t("auth.login.cta")}
      </Button>
      <SwitchLink text={t("auth.noAccount")} action={t("auth.signup.cta")} to="signup" />
      {backend.demo && <DemoAccountCard busy={busy} onPick={tryDemo} />}
      <DemoNote />
    </form>
  );
}

// ───────────────────────────── pieces ─────────────────────────────

function Heading({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h1 className="text-[clamp(2rem,3.2vw,2.6rem)] leading-[1.05] font-semibold tracking-[-0.03em] font-stretch-[106%]">{title}</h1>
      <p className="mt-3 text-[15px] text-muted-foreground">{body}</p>
    </div>
  );
}

function StepDots({ step }: { step: 1 | 2 }) {
  const { t } = useT();
  return (
    <p className="mb-6 flex items-center gap-2 text-[12px] text-muted-foreground" aria-label={`${t("auth.step")} ${step} / 2`}>
      {[1, 2].map((s) => (
        <span
          key={s}
          aria-hidden
          className={cn("h-1 rounded-full transition-all duration-500 ease-out-expo", s === step ? "w-8 bg-brand" : s < step ? "w-4 bg-brand/50" : "w-4 bg-foreground/15")}
        />
      ))}
      <span className="ml-1">
        {t("auth.step")} {step} / 2
      </span>
    </p>
  );
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: TKey | null; hint?: string; children: ReactNode }) {
  const { t } = useT();
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[14px] font-semibold">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-[13px] text-destructive" role="alert">
          {t(error)}
        </p>
      ) : (
        hint && <p className="text-[12px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 pr-11" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
      </button>
    </div>
  );
}

/** Strength as a line of light that fills up (length, mixed case, digits, symbols). */
function Strength({ password }: { password: string }) {
  const { t } = useT();
  const score = !password
    ? 0
    : Math.min(4, (password.length >= MIN_PASSWORD ? 1 : 0) + (password.length >= 12 ? 1 : 0) + (/[a-z]/.test(password) && /[A-Z]/.test(password) ? 1 : 0) + (/\d/.test(password) && /[^A-Za-z0-9]/.test(password) ? 1 : 0));
  const label = (["auth.strength.0", "auth.strength.1", "auth.strength.2", "auth.strength.3", "auth.strength.4"] as TKey[])[score];
  return (
    <div className="flex items-center gap-3 pt-1" aria-live="polite">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full transition-[width,background-color] duration-500 ease-out-expo"
          style={{ width: `${(score / 4) * 100}%`, background: score >= 3 ? "var(--brand)" : score >= 2 ? "var(--ok)" : "var(--warn)" }}
        />
      </div>
      <span className="w-16 text-right text-[12px] text-muted-foreground">{password ? t(label) : ""}</span>
    </div>
  );
}

function FormError({ k }: { k: TKey }) {
  const { t } = useT();
  return (
    <p role="alert" className="mt-5 rounded-xl border border-destructive/40 px-4 py-3 text-[14px] text-destructive animate-in fade-in slide-in-from-top-1 duration-300">
      {t(k)}
    </p>
  );
}

function SwitchLink({ text, action, to }: { text: string; action: string; to: "login" | "signup" }) {
  return (
    <p className="mt-6 text-center text-[14px] text-muted-foreground">
      {text}{" "}
      <a href={`#/${to}`} className="font-medium text-foreground underline-offset-4 hover:underline">
        {action}
      </a>
    </p>
  );
}

/** The sample account, shown the way an account looks in Sanay: its orb avatar, name and voice. */
function DemoAccountCard({ busy, onPick }: { busy: boolean; onPick: () => void }) {
  const { t } = useT();
  const d = DEMO_ACCOUNT;
  const v = d.profile.defaultVoice;
  const initials = d.name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 text-[12px] text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        className="group mt-6 flex w-full items-center gap-3.5 rounded-2xl border border-border bg-card/40 p-3 pr-4 text-left transition-[border-color,background-color] duration-200 hover:border-input hover:bg-card disabled:opacity-60"
      >
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-white transition-shadow duration-300"
          style={{
            background: `radial-gradient(circle at 50% 74%, #fff -15%, var(--voice-${v}) 52%, color-mix(in oklab, var(--voice-${v}) 38%, black) 100%)`,
            boxShadow: `0 0 18px -4px var(--voice-${v})`,
          }}
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">{t("auth.demoTitle")}</span>
          <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
            {d.name} · {t(`web.voice.${v}` as TKey)}
          </span>
        </span>
        {busy ? (
          <LoaderCircle aria-hidden className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <ArrowRight aria-hidden className="size-4 text-muted-foreground transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
        )}
      </button>
    </div>
  );
}

function DemoNote() {
  const { t } = useT();
  const { backend } = useAuth();
  if (!backend.demo) return null;
  return (
    <p className="mt-10 flex items-start gap-2 text-[12px] text-muted-foreground">
      <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      {t("auth.demo")}
    </p>
  );
}
