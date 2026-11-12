// Checks the practice-interview scoring rules and interview detection.
// Run: node tests/practice-score.test.ts   (Node 22.6+ runs TypeScript directly)
import assert from "node:assert/strict";
import { test } from "node:test";
import { detectInterview, interviewOf, INTERVIEWS } from "../web/practice/interviews.ts";
import { overall, scoreAnswer, spokenFeedback } from "../web/practice/score.ts";
import { judge, judgeSentence } from "../web/practice/sounds.ts";

const answer = (text: string, extra: Partial<{ startDelay: number; speaking: number; longPauses: number }> = {}) => ({
  text,
  startDelay: extra.startDelay ?? 1.5,
  speaking: extra.speaking ?? Math.max(1, text.split(/\s+/).length / 2.3), // ~140 words a minute
  longPauses: extra.longPauses ?? 0,
  audio: null,
});

const aboutMe = interviewOf("bpo").questions[0]!;
const GOOD =
  "Good morning. My name is Ana Reyes. I graduated from Cebu Normal University with a degree in education. " +
  "For two years I worked part-time as a tutor, so I am used to explaining things patiently and clearly. " +
  "Now I want to grow my career in customer service and help people every day.";

test("a complete answer scores high and covers every point", () => {
  const s = scoreAnswer(aboutMe, answer(GOOD));
  assert.deepEqual(s.covered, [true, true, true, true]);
  assert.ok(s.total >= 85, `total ${s.total}`);
});

test("a very short answer scores low on length and content", () => {
  const s = scoreAnswer(aboutMe, answer("I am Ana."));
  assert.ok(s.parts.length < 20, `length ${s.parts.length}`);
  assert.ok(s.total < 60, `total ${s.total}`);
});

test("no answer scores zero", () => {
  assert.equal(scoreAnswer(aboutMe, answer("")).total, 0);
});

test("filler words are counted, in English and Filipino", () => {
  const s = scoreAnswer(aboutMe, answer("Uhm my name is Ana, parang I studied ano education, uhm parang I want to work."));
  assert.equal(s.fillers.uhm, 2);
  assert.equal(s.fillers.parang, 2);
  assert.equal(s.fillers.ano, 1);
});

test("speaking very fast lowers the pace score", () => {
  const fast = scoreAnswer(aboutMe, answer(GOOD, { speaking: 15 })); // ~240 words a minute
  assert.ok(fast.pace > 200, `pace ${fast.pace}`);
  assert.ok(fast.parts.pace < 50);
});

test("a long wait before answering lowers confidence", () => {
  assert.ok(scoreAnswer(aboutMe, answer(GOOD, { startDelay: 9 })).parts.confidence < 40);
});

test("overall feedback names the biggest problem first", () => {
  const filler = "parang I studied parang education and parang I want parang to work with parang people and help them every day in the company";
  const turns = [answer(filler), answer(filler)];
  const o = overall(
    turns.map((a) => scoreAnswer(aboutMe, a)),
    turns,
  );
  assert.equal(o.advice[0]?.code, "fillers");
  assert.match(spokenFeedback(o), /Ready score is \d+/);
});

test("the interview type is understood from what people say", () => {
  assert.equal(detectInterview("I'm applying for a call center job"), "bpo");
  assert.equal(detectInterview("visa interview at the embassy"), "abroad");
  assert.equal(detectInterview("a scholarship for college"), "scholarship");
  assert.equal(detectInterview("college entrance interview"), "college");
  assert.equal(detectInterview("my first job"), "job");
  assert.equal(detectInterview("hello there"), null);
});

test("the pronunciation check tells the two words apart", () => {
  assert.equal(judge("fan", "pan", ["fan", "van"]), "right");
  assert.equal(judge("fan", "pan", ["pan", "fan"]), "other");
  assert.equal(judge("three", "tree", ["Three.", "tree"]), "right");
  assert.equal(judge("vote", "boat", ["the boat"]), "other");
  assert.equal(judge("ship", "sheep", ["shape", "ship"]), "right");
  assert.equal(judge("she", "see", ["hello"]), "unclear");
});

test("the sentence check marks each key word", () => {
  assert.deepEqual(judgeSentence(["she", "sells", "shells", "sea"], ["She sells shells by the sea."]), [true, true, true, true]);
  assert.deepEqual(judgeSentence(["she", "sells", "shells", "sea"], ["See sells sells by the sea"]), [false, true, false, true]);
});

test("an impossible speaking speed is 'not measured', never turned into advice", () => {
  const s = scoreAnswer(aboutMe, answer(GOOD, { speaking: 1 })); // ~2400 words a minute: the timing failed
  assert.equal(s.paceKnown, false);
  assert.equal(s.pace, 0);
  assert.ok(s.total >= 80, `still judged on the rest: ${s.total}`);
  const o = overall([s, s], [answer(GOOD, { speaking: 1 }), answer(GOOD, { speaking: 1 })]);
  assert.ok(!o.advice.some((a) => a.code === "fast" || a.code === "slow"));
});


test("every question names each of its points in English and Filipino", () => {
  for (const iv of INTERVIEWS)
    for (const q of iv.questions) {
      assert.equal(q.names.en.length, q.points.length, q.ask);
      assert.equal(q.names.fil.length, q.points.length, q.ask);
    }
});
