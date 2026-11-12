// Light/dark theme for the app, the pill and the website.
// The preference is System (follow Windows), Light or Dark; the resolved theme is set as
// <html data-theme="light|dark"> and every change is animated:
//   - switched from a button: a circle of the new theme grows from the button (View Transitions),
//   - Windows changes theme (System): a soft crossfade.
// Browsers without View Transitions get a short colour transition instead.
import { useSyncExternalStore } from "react";

export type ThemePref = "system" | "light" | "dark";
export type Theme = "light" | "dark";

const KEY = "sanay.theme";
const media = () => window.matchMedia("(prefers-color-scheme: light)");
const listeners = new Set<() => void>();

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage unavailable */
  }
  return "system";
}

let pref: ThemePref = "system";
/** A page can hold one theme while it is shown (the website's home page is dark only). */
let locked: Theme | null = null;
const resolve = (p: ThemePref): Theme => locked ?? (p === "system" ? (media().matches ? "light" : "dark") : p);
export const currentTheme = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
export const themePref = () => pref;

type Origin = { x: number; y: number } | null;

function apply(next: Theme, origin: Origin) {
  const root = document.documentElement;
  if (root.dataset.theme === next) return;
  const set = () => {
    root.dataset.theme = next;
    root.style.colorScheme = next;
    listeners.forEach((l) => l());
  };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
  if (reduced || !root.dataset.theme) return set();

  if (doc.startViewTransition) {
    if (origin) {
      const r = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
      root.style.setProperty("--vt-x", `${origin.x}px`);
      root.style.setProperty("--vt-y", `${origin.y}px`);
      root.style.setProperty("--vt-r", `${r}px`);
    }
    root.dataset.vt = origin ? "reveal" : "fade";
    const vt = doc.startViewTransition(set) as { finished: Promise<void>; ready?: Promise<void> };
    vt.ready?.catch(() => {});
    vt.finished.catch(() => {}).finally(() => delete root.dataset.vt);
  } else {
    root.classList.add("theme-changing");
    set();
    setTimeout(() => root.classList.remove("theme-changing"), 600);
  }
}

/** Call once before the first render. */
export function initTheme() {
  pref = readPref();
  apply(resolve(pref), null);
  media().addEventListener("change", () => pref === "system" && apply(resolve("system"), null));
  // The main window and the floating pill share the preference.
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    pref = readPref();
    apply(resolve(pref), null);
    listeners.forEach((l) => l());
  });
}

/** Hold the page in one theme (null releases it back to the preference). */
export function lockTheme(t: Theme | null) {
  locked = t;
  apply(resolve(pref), null);
  listeners.forEach((l) => l());
}

/** Change the preference; `from` is the element the user clicked (the reveal grows from it). */
export function setThemePref(p: ThemePref, from?: Element | null) {
  pref = p;
  try {
    localStorage.setItem(KEY, p);
  } catch {
    /* ignore */
  }
  const b = from?.getBoundingClientRect();
  apply(resolve(p), b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The resolved theme and the stored preference, re-rendering on change. */
export function useTheme(): { theme: Theme; pref: ThemePref } {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "dark" as Theme);
  const p = useSyncExternalStore(subscribe, themePref, () => "system" as ThemePref);
  return { theme, pref: p };
}
