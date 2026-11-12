// Pronunciation drills: pairs of English words that differ by one sound Filipinos often mix up.
// The coach says a word, you say it, and speech recognition tells us which word it heard.

export interface Drill {
  id: "fp" | "vb" | "th" | "ii" | "ssh";
  /** The two sounds, as shown ("F / P"). */
  pair: string;
  /** Word pairs: [target, the word it often turns into]. */
  words: [string, string][];
  /** How to make the target sound. */
  how: { en: string; fil: string };
  /** A short sentence full of the target sound, and the words in it that must come out right. */
  sentence: string;
  targets: string[];
}

export const DRILLS: Drill[] = [
  {
    id: "fp",
    pair: "F / P",
    words: [["fan", "pan"], ["fine", "pine"], ["fast", "past"], ["coffee", "copy"], ["file", "pile"]],
    how: {
      en: "For F, rest your top teeth lightly on your lower lip and blow air. For P, close both lips and pop them open.",
      fil: "Sa F, idampi ang ngipin sa itaas sa lower lip mo at umihip ng hangin. Sa P, isara ang dalawang labi tapos ibuka nang mabilis.",
    },
    sentence: "Five friends found fresh coffee.",
    targets: ["five", "friends", "found", "fresh", "coffee"],
  },
  {
    id: "vb",
    pair: "V / B",
    words: [["vote", "boat"], ["very", "berry"], ["van", "ban"], ["vest", "best"], ["vowel", "bowel"]],
    how: {
      en: "For V, rest your top teeth on your lower lip and use your voice, so it buzzes. For B, just close your lips, like “ba”.",
      fil: "Sa V, idampi ang ngipin sa itaas sa lower lip mo at gamitin ang boses mo, para may ugong. Sa B, labi lang, parang “ba”.",
    },
    sentence: "Victor has a very big van.",
    targets: ["victor", "very", "big", "van"],
  },
  {
    id: "th",
    pair: "TH / T",
    words: [["three", "tree"], ["thank", "tank"], ["think", "tink"], ["thin", "tin"], ["path", "pat"]],
    how: {
      en: "For TH, put the tip of your tongue lightly between your teeth and blow air. Don't press it like a T.",
      fil: "Sa TH, ilagay nang bahagya ang dulo ng dila sa pagitan ng mga ngipin at umihip ng hangin. Huwag diinan na parang T.",
    },
    sentence: "Thank you for the three things.",
    targets: ["thank", "three", "things"],
  },
  {
    id: "ii",
    pair: "i / ee",
    words: [["ship", "sheep"], ["live", "leave"], ["sit", "seat"], ["fill", "feel"], ["hit", "heat"]],
    how: {
      en: "The short i (ship) is quick and relaxed. The long ee (sheep) is longer, with a wide smile.",
      fil: "Mabilis at relaxed ang maikling i (ship). Mas mahaba ang ee (sheep), parang nakangiti nang malapad.",
    },
    sentence: "The sheep is on the big ship.",
    targets: ["sheep", "big", "ship"],
  },
  {
    id: "ssh",
    pair: "SH / S",
    words: [["she", "see"], ["ship", "sip"], ["shell", "sell"], ["shoe", "sue"], ["sheet", "seat"]],
    how: {
      en: "For SH, round your lips a little and push them forward, like asking someone to be quiet: “shhh”.",
      fil: "Sa SH, bilugan nang kaunti ang labi at itulak pasulong, parang nagpapatahimik: “shhh”.",
    },
    sentence: "She sells shells by the sea.",
    targets: ["she", "sells", "shells", "sea"],
  },
];

/** Did the person say the target word? Checks every guess speech recognition offers. */
export function judge(target: string, other: string, guesses: string[]): "right" | "other" | "unclear" {
  const words = guesses.map((g) => g.toLowerCase().replace(/[^a-z' ]/g, " ").trim().split(/\s+/));
  const first = words[0] ?? [];
  if (first.includes(target)) return "right";
  if (first.includes(other)) return "other";
  // Not the first guess, but close: count it if the target is among the alternatives and the other word is not.
  const any = (w: string) => words.some((ws) => ws.includes(w));
  if (any(target) && !any(other)) return "right";
  if (any(other)) return "other";
  return "unclear";
}

/** Which of the sentence's key words came out right. */
export function judgeSentence(targets: string[], guesses: string[]): boolean[] {
  const words = new Set(guesses.flatMap((g) => g.toLowerCase().replace(/[^a-z' ]/g, " ").split(/\s+/)));
  return targets.map((t) => words.has(t));
}
