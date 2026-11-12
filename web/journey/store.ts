// Shared state between the scrolling page and the 3D scene. Written on scroll, read every frame; a plain
// object so scrolling never re-renders React.
import type { VoiceType } from "../audio/webEngine";

export const CHAPTERS = 6;

export const journey = {
  /** Scroll position through the journey in chapters: 0 at the start, CHAPTERS - 1 at the end. */
  at: 0,
  /** The visitor's mic level, 0..1, while "Test your voice" is on. */
  level: 0,
  voice: "natural" as VoiceType,
  theme: "dark" as "light" | "dark",
};

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const smooth = (t: number) => t * t * (3 - 2 * t);
