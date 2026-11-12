// Account storage. `AuthBackend` is the contract the UI uses; `localBackend` is a DEMO that keeps
// accounts in this browser only. Replace it with a real backend (Supabase, Firebase or our own
// server) by implementing the same interface; nothing else in the UI changes.
//
// Even in the demo, passwords are never stored as typed: each one is salted and hashed with
// PBKDF2-SHA256 (210,000 iterations, WebCrypto) and only the hash is kept.

export type UseCase = "interviews" | "work" | "streaming" | "other";
export type VoicePref = "masculine" | "feminine" | "natural";
export type Lang = "en" | "fil";

export interface User {
  id: string;
  email: string;
  name: string;
  country: string; // ISO 3166-1 alpha-2, "" = not set
  language: Lang;
  useCase: UseCase | "";
  defaultVoice: VoicePref;
  plan: "testing";
  createdAt: string; // ISO date
}

export type ProfilePatch = Partial<Pick<User, "name" | "email" | "country" | "language" | "useCase" | "defaultVoice">>;

export class AuthError extends Error {
  constructor(
    public code: "email_taken" | "bad_credentials" | "weak_password" | "bad_email" | "not_signed_in" | "too_many_attempts",
  ) {
    super(code);
  }
}

export interface AuthBackend {
  /** True for the in-browser demo, so the UI can say where accounts live. */
  readonly demo: boolean;
  current(): Promise<User | null>;
  signUp(input: { email: string; password: string; name: string } & ProfilePatch): Promise<User>;
  signIn(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  updateProfile(patch: ProfilePatch): Promise<User>;
  changePassword(current: string, next: string): Promise<void>;
  deleteAccount(password: string): Promise<void>;
}

export const MIN_PASSWORD = 8;
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

// ───────────────────────────── in-browser demo ─────────────────────────────

interface Stored {
  user: User;
  salt: string; // base64
  hash: string; // base64
}

const USERS = "sanay.demo.users";
const SESSION = "sanay.demo.session";
const ITERATIONS = 210_000;

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))));
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hashPassword(password: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
  return b64(bits);
}

/** Constant-time comparison of two base64 hashes. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function load(): Record<string, Stored> {
  try {
    return JSON.parse(localStorage.getItem(USERS) ?? "{}");
  } catch {
    return {};
  }
}
const save = (db: Record<string, Stored>) => localStorage.setItem(USERS, JSON.stringify(db));
const norm = (email: string) => email.trim().toLowerCase();

// Slow down guessing: a short delay after each failed sign-in, growing with repeated failures.
let failures = 0;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function verify(rec: Stored, password: string) {
  return same(await hashPassword(password, unb64(rec.salt)), rec.hash);
}

function sessionUser(db = load()): Stored | null {
  const id = localStorage.getItem(SESSION);
  return id ? (Object.values(db).find((r) => r.user.id === id) ?? null) : null;
}

export const localBackend: AuthBackend = {
  demo: true,

  async current() {
    return sessionUser()?.user ?? null;
  },

  async signUp({ email, password, name, ...rest }) {
    const e = norm(email);
    if (!isEmail(e)) throw new AuthError("bad_email");
    if (password.length < MIN_PASSWORD) throw new AuthError("weak_password");
    const db = load();
    if (db[e]) throw new AuthError("email_taken");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const user: User = {
      id: crypto.randomUUID(),
      email: e,
      name: name.trim(),
      country: rest.country ?? "",
      language: rest.language ?? "en",
      useCase: rest.useCase ?? "",
      defaultVoice: rest.defaultVoice ?? "natural",
      plan: "testing",
      createdAt: new Date().toISOString(),
    };
    db[e] = { user, salt: b64(salt), hash: await hashPassword(password, salt) };
    save(db);
    localStorage.setItem(SESSION, user.id);
    return user;
  },

  async signIn(email, password) {
    if (failures >= 8) {
      await pause(4000);
    }
    const rec = load()[norm(email)];
    // Hash even when the email is unknown, so timing does not reveal which emails exist.
    const ok = rec ? await verify(rec, password) : (await hashPassword(password, new Uint8Array(16)), false);
    if (!ok) {
      failures++;
      await pause(Math.min(400 * failures, 2500));
      throw new AuthError(failures >= 8 ? "too_many_attempts" : "bad_credentials");
    }
    failures = 0;
    localStorage.setItem(SESSION, rec!.user.id);
    return rec!.user;
  },

  async signOut() {
    localStorage.removeItem(SESSION);
  },

  async updateProfile(patch) {
    const db = load();
    const rec = sessionUser(db);
    if (!rec) throw new AuthError("not_signed_in");
    const next = { ...rec.user, ...patch, name: (patch.name ?? rec.user.name).trim() };
    if (patch.email !== undefined) {
      const e = norm(patch.email);
      if (!isEmail(e)) throw new AuthError("bad_email");
      if (e !== rec.user.email && db[e]) throw new AuthError("email_taken");
      delete db[rec.user.email];
      next.email = e;
    }
    db[next.email] = { ...rec, user: next };
    save(db);
    return next;
  },

  async changePassword(current, nextPassword) {
    const db = load();
    const rec = sessionUser(db);
    if (!rec) throw new AuthError("not_signed_in");
    if (!(await verify(rec, current))) throw new AuthError("bad_credentials");
    if (nextPassword.length < MIN_PASSWORD) throw new AuthError("weak_password");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    db[rec.user.email] = { ...rec, salt: b64(salt), hash: await hashPassword(nextPassword, salt) };
    save(db);
  },

  async deleteAccount(password) {
    const db = load();
    const rec = sessionUser(db);
    if (!rec) throw new AuthError("not_signed_in");
    if (!(await verify(rec, password))) throw new AuthError("bad_credentials");
    delete db[rec.user.email];
    save(db);
    localStorage.removeItem(SESSION);
  },
};
