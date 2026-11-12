// End-to-end usability and stress run of the Sanay website in headless Chrome.
import { readFileSync, mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const BASE = process.env.BASE ?? "http://localhost:4173/";
const SHOTS = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
mkdirSync(SHOTS, { recursive: true });
const only = process.argv[2];

const results = [];
async function check(name, fn) {
  // Signing in always runs: the account tests need it.
  if (only && !name.startsWith("sample account") && !name.toLowerCase().includes(only.toLowerCase())) return;
  const t0 = Date.now();
  try {
    const note = await fn();
    results.push({ name, ok: true, ms: Date.now() - t0, note });
    console.log(`PASS  ${name}${note ? "  — " + note : ""}`);
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, note: e.message });
    console.log(`FAIL  ${name}  — ${e.message}`);
  }
}

const b = await launch();
await b.addInit(readFileSync(new URL("./mocks.js", import.meta.url), "utf8"));
await b.size(1440, 900);

const login = async () => {
  await b.goto(BASE + "#/login", 1800);
  if (await b.has("Juan")) {
    await b.click("Juan");
    await sleep(1500);
  }
};
const lang = async (l) => {
  // Only the site's own page may set its language: make sure we're on it first.
  if (!(await b.eval("location.origin")).startsWith("http://localhost")) await b.goto(BASE + "#/account", 1500);
  await b.eval(`localStorage.setItem('sanay.lang', '${l}')`);
};

/* ---------- 1. Pages load in both languages, no errors, no layout break ---------- */
for (const [route, file] of [
  ["#/", "home"],
  ["#/guide", "guide"],
  ["#/login", "login"],
  ["#/signup", "signup"],
]) {
  for (const width of [360, 1440]) {
    await check(`page ${file} @${width}px loads without errors or sideways scroll`, async () => {
      b.console.length = 0;
      await b.size(width, 800, width < 500);
      await b.goto(BASE + route, 2200);
      const o = await b.overflow();
      if (width === 360 || file === "guide") await b.shot(`${SHOTS}${file}-${width}.png`, file !== "home");
      const errs = b.console.filter((c) => !/favicon|DevTools|webgl|WebGL|GPU stall|AudioContext|THREE\.Clock/i.test(c));
      if (o.scroll) throw new Error(`sideways scroll at ${o.w}px: ${o.bad.join(" | ")}`);
      if (errs.length) throw new Error(errs.slice(0, 3).join(" | "));
    });
  }
}
await b.size(1440, 900);

/* ---------- 2. Sign in with the sample account; every account section and its back button ---------- */
await check("sample account signs in and lands on Overview", async () => {
  await lang("en");
  await login();
  await b.waitFor("Get ready for your interview");
  await b.shot(`${SHOTS}account-overview-1440.png`);
});

for (const [tab, title] of [
  ["practice", "Practice interview"],
  ["english", "Say it in English"],
  ["coach", "Pronunciation"],
  ["profile", "Profile"],
  ["preferences", "Preferences"],
  ["devices", "Devices"],
  ["plan", "Plan"],
  ["security", "Security"],
]) {
  await check(`account → ${title}: opens, and "Back to Overview" returns`, async () => {
    await b.goto(BASE + `#/account/${tab}`, 1200);
    await b.waitFor(title);
    await b.click("Back to Overview");
    await sleep(700);
    const hash = await b.eval("location.hash");
    if (hash !== "#/account") throw new Error(`back went to ${hash}`);
  });
}

/* ---------- 3. Say it in English ---------- */
await check("Say it in English: typed Taglish → real English from the free service", async () => {
  await b.goto(BASE + "#/account/english", 1500);
  await b.type("#said", "Pasensya na po, ichecheck ko lang kung nasaan na yung order ninyo.");
  await b.click("Make it English");
  await b.waitFor("Try another", 15000);
  const text = await b.eval(`[...document.querySelectorAll('p[lang=en]')].map(p=>p.innerText).join(' ')`);
  await b.shot(`${SHOTS}english-result-1440.png`, false);
  return text.slice(0, 90);
});

await check("Say it in English: voice → words appear → English", async () => {
  await b.click("Try another");
  await b.eval(`window.__answers.push("Sir pwede po ba akong mag-ask kung kailan ang start ng training")`);
  await b.click("Start speaking");
  await sleep(700);
  await b.click("Stop and make it English");
  await b.waitFor("Try another", 15000);
  return await b.eval(`[...document.querySelectorAll('p[lang=en]')].map(p=>p.innerText).join(' ').slice(0,90)`);
});

await check("Say it in English: empty box keeps the button off (no empty request)", async () => {
  await b.click("Try another");
  const disabled = await b.eval(`[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Make it English')).disabled`);
  if (!disabled) throw new Error("button is clickable with an empty box");
});

await check("Say it in English: very long text is capped at 450 characters", async () => {
  const max = await b.eval(`document.querySelector('#said').maxLength`);
  if (max !== 450) throw new Error("maxLength " + max);
});

await check("Say it in English: odd input (emoji, symbols, numbers) does not crash", async () => {
  await b.type("#said", "😅 order #4817 — ₱1,250 po!!! ???");
  await b.click("Make it English");
  await sleep(6000);
  const ok = (await b.has("Try another")) || (await b.has("couldn't")) || (await b.has("Something went wrong"));
  if (!ok) throw new Error("no result or message shown");
  return (await b.has("Try another")) ? "translated" : "friendly message";
});

await check("Say it in English: no internet → clear message", async () => {
  await b.goto(BASE + "#/account/english", 1200);
  await b.send("Network.enable");
  await b.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await b.type("#said", "Salamat po");
  await b.click("Make it English");
  await b.waitFor("No internet", 8000);
  await b.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
});

await check("Say it in English: mic blocked / no speech → clear message", async () => {
  await b.goto(BASE + "#/account/english", 1200);
  await b.eval(`window.__recErrors.push("not-allowed")`);
  await b.click("Start speaking");
  await b.waitFor("needs your microphone", 4000);
});

/* ---------- 4. Practice interview: full run ---------- */
const GOOD = [
  "Good morning. My name is Ana Reyes and I graduated from Cebu Normal University with a degree in education. I worked part-time as a tutor for two years and now I want to grow my career in customer service.",
  "I want to work in a call center because I enjoy helping customers and I want to improve my communication skills in English. It is also a good place to grow my career.",
  "First I would listen and say sorry so the customer feels understood. Then I would stay calm and patient, and I would check the account and give a clear solution to resolve the problem.",
  "Yes, I am okay with night shifts and holidays. I will adjust my sleep schedule and my family supports me, so I am ready and flexible.",
  "In five years I see myself as a team leader or trainer. I want to keep learning new skills and grow with the company.",
];

async function answerAll(answers) {
  for (const a of answers) {
    await b.eval(`window.__answers.push(${JSON.stringify(a)})`);
    // Wait until it's our turn, then say "I'm done" (the fake mic never goes silent).
    await b.waitFor("Your turn", 15000);
    await sleep(700);
    await b.click("I'm done");
    await sleep(400);
  }
}

await check("Practice interview: choose by voice ('call center') → 5 questions → results", async () => {
  b.console.length = 0;
  await b.goto(BASE + "#/account/practice", 1500);
  await b.shot(`${SHOTS}practice-setup-1440.png`, false);
  await b.click("Start practice interview");
  await b.eval(`window.__answers.push("I'm preparing for a call center job")`);
  await b.waitFor("Your turn", 10000);
  await sleep(600);
  await b.click("I'm done");
  await b.waitFor("Question 1 of 5", 10000);
  await b.shot(`${SHOTS}practice-call-1440.png`, false);
  await answerAll(GOOD);
  await b.waitFor("Ready score", 15000);
  await sleep(500);
  await b.shot(`${SHOTS}practice-results-1440.png`);
  const score = await b.eval(`document.querySelector('.text-3xl')?.innerText`);
  const spoken = await b.eval(`window.__spoken`);
  if (!spoken.some((s) => s.includes("What kind of interview"))) throw new Error("interviewer never asked the interview type");
  if (!spoken.some((s) => s.includes("Ready score is"))) throw new Error("no spoken feedback");
  const errs = b.console.filter((c) => !/webgl|WebGL|GPU stall|AudioContext/i.test(c));
  if (errs.length) throw new Error(errs.slice(0, 2).join(" | "));
  return `Ready score ${score}; interviewer said ${spoken.length} lines`;
});

await check("Practice interview: good answers score high (≥ 70)", async () => {
  const score = Number(await b.eval(`document.querySelector('.text-3xl')?.innerText`));
  if (!(score >= 70)) throw new Error("score " + score);
  return `score ${score}`;
});

await check("Practice interview: 'Practice this again' repeats the same interview without asking the type", async () => {
  await b.eval(`window.__spoken.length = 0`);
  await b.click("Practice this again");
  await b.waitFor("Question 1 of 5", 10000);
  const spoken = await b.eval(`window.__spoken`);
  if (spoken.some((s) => s.includes("What kind of interview"))) throw new Error("asked the type again");
  await b.click("End practice");
  await sleep(800);
});

await check("Practice interview: weak answers (short, fillers) score low with useful advice", async () => {
  await b.goto(BASE + "#/account/practice", 1500);
  await b.click("Start practice interview");
  await b.waitFor("Your turn", 10000);
  await b.click("Call center / BPO");
  await b.waitFor("Question 1 of 5", 10000);
  const weak = ["uhm parang I am Ana", "parang because ano money", "parang I say sorry", "yes", "parang manager ano"];
  // Short answers trigger "tell me more": answer that too.
  for (const a of weak) {
    await b.eval(`window.__answers.push(${JSON.stringify(a)}, "parang ano basta yun")`);
    await b.waitFor("Your turn", 15000);
    await sleep(600);
    await b.click("I'm done");
    await sleep(900);
    if (await b.has("Your turn")) {
      await b.click("I'm done");
      await sleep(400);
    }
  }
  await b.waitFor("Ready score", 20000);
  const score = Number(await b.eval(`document.querySelector('.text-3xl')?.innerText`));
  const advice = await b.eval(`document.body.innerText.includes('What to work on')`);
  const spoken = await b.eval(`window.__spoken`);
  if (!spoken.some((s) => s.includes("tell me a little more"))) throw new Error("never asked for more on short answers");
  if (!(score < 50)) throw new Error("weak answers scored " + score);
  if (!advice) throw new Error("no advice shown");
  await b.shot(`${SHOTS}practice-weak-results-1440.png`);
  return `score ${score}`;
});

await check("Practice interview: 'End practice' halfway shows results for answered questions", async () => {
  await b.goto(BASE + "#/account/practice", 1500);
  await b.click("Start practice interview");
  await b.waitFor("Your turn", 10000);
  await b.click("Scholarship");
  await b.waitFor("Question 1 of 5", 10000);
  await answerAll(GOOD.slice(0, 2));
  await b.waitFor("Question 3 of 5", 10000);
  await b.click("End practice");
  await b.waitFor("Ready score", 10000);
  const answers = await b.eval(`document.querySelectorAll('details').length`);
  if (answers !== 2) throw new Error(`${answers} answers listed, expected 2`);
});

await check("Practice interview: 'End practice' before choosing goes back to the start screen", async () => {
  await b.goto(BASE + "#/account/practice", 1500);
  await b.click("Start practice interview");
  await b.waitFor("Your turn", 10000);
  await b.click("End practice");
  await b.waitFor("Start practice interview", 5000);
});

await check("Practice interview: leaving mid-interview stops it (no voice keeps talking)", async () => {
  await b.click("Start practice interview");
  await b.waitFor("Your turn", 10000);
  await b.click("Job interview");
  await b.waitFor("Question 1 of 5", 10000);
  await b.click("Back to Overview");
  await sleep(1500);
  const n = await b.eval(`window.__spoken.length`);
  await sleep(2500);
  const n2 = await b.eval(`window.__spoken.length`);
  if (n2 !== n) throw new Error("interviewer kept talking after leaving the page");
});

await check("Practice interview: rapid double-click on Start does not start two interviews", async () => {
  await b.goto(BASE + "#/account/practice", 1500);
  await b.eval(`window.__spoken.length = 0`);
  await b.eval(`(() => { const btn = [...document.querySelectorAll('button')].find(x => x.innerText.includes('Start practice interview')); btn.click(); btn.click(); btn.click(); })()`);
  await sleep(2500);
  const hellos = await b.eval(`window.__spoken.filter(s => s.includes('What kind of interview')).length`);
  await b.click("End practice").catch(() => {});
  if (hellos > 1) throw new Error(`greeting spoken ${hellos} times`);
});

await check("Practice interview: Chrome speech service down → clear message", async () => {
  await b.goto(BASE + "#/account/practice", 1500);
  await b.eval(`window.__recErrors.push("network")`);
  await b.click("Start practice interview");
  await b.waitFor("needs internet", 8000);
  await b.click("End practice").catch(() => {});
});

/* ---------- 5. Pronunciation ---------- */
await check("Pronunciation step 1: listen quiz runs 6 rounds and offers step 2", async () => {
  await b.goto(BASE + "#/account/coach", 1500);
  for (let i = 0; i < 6; i++) {
    await b.waitFor(`Round ${i + 1} of 6`, 4000);
    await b.eval(`[...document.querySelectorAll('button[lang=en]')][0].click()`);
    await sleep(200);
    await b.click("Next word");
  }
  await b.waitFor("Go to Step 2", 4000);
  await b.shot(`${SHOTS}coach-listen-done-1440.png`, false);
});

await check("Pronunciation step 2: right word passes and moves on by itself", async () => {
  await b.click("Go to Step 2");
  await b.eval(`window.__answers.push({text: "fan", alts: ["van"]})`);
  await b.click("Say it");
  await b.waitFor("Nice!", 4000);
  await sleep(1900);
  await b.waitFor("Word 2 of 5", 3000);
});

await check("Pronunciation step 2: wrong word shows tries left; 3 misses then Next", async () => {
  const expect = ["Tries left: 2", "Tries left: 1", "That's all the tries"];
  for (let i = 0; i < 3; i++) {
    await b.eval(`window.__answers.push({text: "pine"})`);
    await b.click("Say it");
    await b.waitFor(expect[i], 5000);
  }
  if (!(await b.has("That's all the tries"))) throw new Error("no 'out of tries' message");
  const sayOff = await b.eval(`[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Say it').disabled`);
  if (!sayOff) throw new Error("Say it still clickable after 3 tries");
  await b.click("Next word");
  await b.waitFor("Word 3 of 5", 3000);
});

await check("Pronunciation: finish words → sentence challenge → summary → practise missed", async () => {
  for (const [n, w] of [[3, "fast"], [4, "coffee"], [5, "file"]]) {
    await b.waitFor(`Word ${n} of 5`, 4000);
    await b.eval(`window.__answers.push({text: ${JSON.stringify(w)}})`);
    await b.click("Say it");
    await b.waitFor("Nice!", 4000);
    await sleep(1900);
  }
  await b.waitFor("Sentence challenge", 4000);
  await b.eval(`window.__answers.push({text: "Five friends found fresh copy"})`);
  await b.click("Say it");
  await b.waitFor("key words came out clear", 4000);
  await b.shot(`${SHOTS}coach-sentence-1440.png`, false);
  await b.click("See my results");
  await b.waitFor("Practice the missed words", 3000);
  await b.shot(`${SHOTS}coach-summary-1440.png`, false);
  await b.click("Practice the missed words");
  await b.waitFor("Word 1 of 1", 3000);
});

/* ---------- 6. Filipino everywhere ---------- */
await check("Filipino: account sections show Filipino, no leftover English labels", async () => {
  await lang("fil");
  const leftovers = [];
  for (const tab of ["", "/practice", "/english", "/coach"]) {
    await b.goto(BASE + "#/account" + tab, 1500);
    const text = await b.eval("document.body.innerText");
    for (const en of ["Back to", "Start practice", "Make it English", "Hear this voice", "Step 1: Listen", "Your interviewer", "Get ready for", "Try another"]) if (text.includes(en)) leftovers.push(`${tab || "/"}: "${en}"`);
  }
  await b.shot(`${SHOTS}fil-practice-1440.png`, false);
  if (leftovers.length) throw new Error(leftovers.join(", "));
});

await check("Filipino: interview shows each question's Filipino meaning", async () => {
  await b.goto(BASE + "#/account/practice", 1500);
  await b.waitFor("Simulan ang practice interview", 6000);
  await b.click("Simulan ang practice interview");
  await b.waitFor("Ikaw na", 10000);
  await b.click("Job interview");
  await b.waitFor("Tanong 1 sa 5", 10000);
  if (!(await b.has("Ikuwento mo ang tungkol sa sarili mo"))) throw new Error("no Filipino meaning shown");
  await b.shot(`${SHOTS}fil-call-1440.png`, false);
  await b.click("Tapusin");
  await sleep(800);
});

/* ---------- 7. Phone width for the practice tools ---------- */
await lang("en");
await b.size(360, 760, true);
for (const tab of ["practice", "english", "coach"]) {
  await check(`phone 360px: account/${tab} fits without sideways scroll`, async () => {
    await b.goto(BASE + `#/account/${tab}`, 1800);
    const o = await b.overflow();
    await b.shot(`${SHOTS}phone-${tab}.png`);
    if (o.scroll) throw new Error(o.bad.join(" | "));
  });
}
await check("phone 360px: practice interview call screen fits", async () => {
  await b.goto(BASE + "#/account/practice", 1800);
  await b.click("Start practice interview");
  await b.waitFor("Your turn", 10000);
  await b.click("Call center / BPO");
  await b.waitFor("Question 1 of 5", 10000);
  await sleep(500);
  const o = await b.overflow();
  await b.shot(`${SHOTS}phone-call.png`);
  await b.click("End practice");
  if (o.scroll) throw new Error(o.bad.join(" | "));
});

/* ---------- 8. Tap sizes (phones) ---------- */
await check("phone 360px: buttons are big enough to tap (≥ 40px)", async () => {
  const small = [];
  for (const tab of ["practice", "english", "coach"]) {
    await b.goto(BASE + `#/account/${tab}`, 1500);
    const s = await b.eval(`[...document.querySelectorAll('main button, main a, main [role=tab]')].filter(e=>e.offsetParent).map(e=>{const r=e.getBoundingClientRect();return {t:(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,30),h:Math.round(r.height)}}).filter(x=>x.h && x.h<40)`);
    s.forEach((x) => small.push(`${tab}: "${x.t}" ${x.h}px`));
  }
  if (small.length) throw new Error(small.slice(0, 8).join(", "));
});

await b.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
