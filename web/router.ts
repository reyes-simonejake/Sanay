// Tiny hash router (works on any static host, including GitHub Pages).
// Page changes run inside a View Transition: the page fades and lifts, and the orb, which carries
// `view-transition-name: orb` on every page, glides from its old place to its new one.
// Routes: #/  #/signup  #/login  #/account[/<tab>]  #/guide[/<chapter>]
import { useSyncExternalStore } from "react";

export type Route = "home" | "signup" | "login" | "account" | "guide" | "preview";
const ROUTES: Route[] = ["home", "signup", "login", "account", "guide", "preview"];

interface Location {
  route: Route;
  /** Second path segment, e.g. the account tab. */
  sub: string;
}

function parse(): Location {
  const [first = "", sub = ""] = location.hash.replace(/^#\/?/, "").split(/[?#]/)[0]!.split("/");
  return (ROUTES as string[]).includes(first) ? { route: first as Route, sub } : { route: "home", sub: "" };
}

const subs = new Set<() => void>();
let current: Location = parse();
/** The page before this one (for "Back" links), or null when the site was opened here. */
let previous: Location | null = null;
const emit = () => subs.forEach((s) => s());

function commit(next: Location, scroll: boolean) {
  if (next.route !== current.route) previous = current;
  current = next;
  emit();
  if (scroll) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
}

function transition(next: Location) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // A new page scrolls to the top; a tab inside the same page keeps its place.
  const scroll = next.route !== current.route;
  if (doc.startViewTransition && !reduced) quiet(doc.startViewTransition(() => commit(next, scroll)));
  else commit(next, scroll);
}

/** A transition skipped because another started is expected; keep it out of the console. */
function quiet(vt: unknown) {
  const v = vt as { ready?: Promise<void>; finished?: Promise<void>; updateCallbackDone?: Promise<void> };
  v.ready?.catch(() => {});
  v.finished?.catch(() => {});
  v.updateCallbackDone?.catch(() => {});
}

window.addEventListener("hashchange", () => {
  const next = parse();
  if (next.route !== current.route || next.sub !== current.sub) {
    // In-page anchors (#lab, #desktop) parse as home: no page transition for those.
    if (next.route === "home" && current.route === "home") current = next;
    // Chapters inside the guide scroll smoothly instead of replaying the page transition.
    else if (next.route === "guide" && current.route === "guide") commit(next, false);
    else transition(next);
  }
});

/** Go to a page (and optionally a tab). Home anchors (#lab, #desktop) still work as plain links. */
export function navigate(route: Route, sub = "") {
  const hash = route === "home" ? "#/" : `#/${route}${sub ? `/${sub}` : ""}`;
  if (location.hash !== hash) location.hash = hash;
  else if (current.route !== route || current.sub !== sub) transition({ route, sub });
}

const subscribe = (l: () => void) => {
  subs.add(l);
  return () => subs.delete(l);
};

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => current.route);
}

export function useSubroute(): string {
  return useSyncExternalStore(subscribe, () => current.sub);
}

/** Where "Back" should go: the previous page on this site, or home. */
export function usePrevious(): Location {
  return useSyncExternalStore(subscribe, () => previous ?? HOME);
}
const HOME: Location = { route: "home", sub: "" };
