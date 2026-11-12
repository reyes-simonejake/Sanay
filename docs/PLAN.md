# Sanay — Build plan

> **Sanay** ("practiced, used to it"): practice any important conversation before it happens, then sound clear when it does.
> Hackathon bucket **04 — Most Useful for the PH Community**: "Build what helps Filipinos most, starting tomorrow."

Two jobs, in order. **Job 1** makes the website sell Sanay to Filipinos. **Job 2** builds the new features. A short **Job 0** comes first because both depend on it.

---

## Job 0 — Foundations (before both jobs, ~1 h)

| # | Task | Why |
|---|---|---|
| 0.1 | Finish the rebrand: point the AI voice server at `D:\dev\SanayAI` (folder shortcut + small launcher), remove the last Linaw names, rerun all tests and both builds | The repo must say Sanay everywhere and still work |
| 0.2 | Update `PRODUCT.md`: new users (job seekers, OFWs, students, everyday callers), new purpose (practice + clarity), bucket 04 | Design tools and every later decision read this file |
| 0.3 | Write `CONTEXT.md` (glossary in plain words) and decision records in `docs/adr/`: bucket 04 + scope, voice option rules, translation A + B, live-call demo, disclosure of earlier work | One shared language; decisions don't get re-argued |
| 0.4 | **Check the hackathon rule on earlier code** and agree the disclosure line: *"Sanay is built on our voice-clarity engine, made earlier; at this event we built practice calls, scoring, the pronunciation coach, translation help and the scenario packs."* | Avoid disqualification |

---

## Job 1 — Website: marketing-friendly, clearly for the PH community

**Lead: you** (UI). **Support: me** (copy in English + Filipino, i18n wiring, reviews, accessibility and performance checks).

### Goal
A Filipino visitor understands in **10 seconds**: *it's free, it's for people like me, it helps me practice and sound clear, and I can try it now on my phone.*

### Today → target
Today the site is a voice-clarity landing page (orb hero, voice lab, desktop app). Target story, top to bottom:

| # | Section | Content | Notes |
|---|---|---|---|
| 1 | **Hero** | Headline idea: *"Practice the call. Sound clear on the real one."* / Filipino: *"Mag-practice muna. Sanay ka na sa totoong tawag."* Primary button **Try a practice call** (until Job 2 ships: **Test your voice**), secondary **Download for Windows** | Keep the orb: it's the brand |
| 2 | **Para kanino (Who it's for)** | Cards: **Job seekers & BPO**, **OFWs & families**, **Students**, **Freelancers**, **Everyday calls** (bank, telco, hotline), each with one real situation in one line | Real PH situations; no stock-photo clichés |
| 3 | **The problem, here** | Tricycle, karaoke, roosters, a cheap headset, nobody to practice with, nerves before the call | Make it feel local and true |
| 4 | **How it works** | 3 steps: **Practice** (AI plays the other person) → **Get feedback** (clarity, pronunciation, what to say) → **Sound clear on the real call** (noise removed, optional voice) | Plain words only; never "agents", "model", "pipeline" |
| 5 | **Practice preview** | A designed preview of a practice call and its scorecard (static now; live after Job 2) | Shows the new value before it's built |
| 6 | **Hear it yourself** | The existing voice lab, reframed: *"Hear Sanay remove a tricycle"* | Already works |
| 7 | **Your voice, your choice** | The voice option as confidence and comfort, with its rules shown openly | Builds trust; see the voice rules ADR |
| 8 | **Libre. Sa phone mo. Private.** | Free, works in Chrome on a budget phone, low data, audio stays on your device (state exactly what goes to the cloud once Job 2 decides it) | Key barriers for Filipinos |
| 9 | **For PESO offices & schools** | "Free for every PESO office, school and pre-departure seminar": a contact/partner call to action | The reach story for judges |
| 10 | **FAQ** | Both languages: Is it free? Does it work on my phone? Is my voice recorded? Is the voice option allowed in interviews? | |
| 11 | **Footer** | Disclosure line, licences, not affiliated with any call app | |

### Rules for Job 1
- **English + Filipino for every new string** (`src/i18n/en.json`, `fil.json`), using `web.*` / `landing.*` keys.
- **No invented testimonials, numbers, partners or logos** (PRODUCT.md "Evidence on hand"). Use honest placeholders or leave them out.
- Keep the **Luminous Voice** design (`DESIGN.md`): night ink, the orb, frosted glass, Mona Sans, no emoji.
- **Mobile-first:** test at 360 px on a mid-range Android in Chrome. The orb needs a light fallback on weak phones.
- Accessibility: contrast in both themes, keyboard focus, reduced motion.
- Design skills available in this repo: `impeccable`, `design-taste-frontend`, `frontend-design`, `ui-ux-pro-max`.

### Done when
- [ ] The 11 sections are live in both languages and both themes.
- [ ] `pnpm web:build` passes, with no layout break at 360 px or 1440 px.
- [ ] Someone non-technical can say what Sanay is and who it's for after 10 seconds on the page.

---

## Job 2 — New features

**Lead: me**, with your review on every screen. Order = value for the demo.

### Architecture decisions (needed before coding)
| Decision | Proposal | Why |
|---|---|---|
| No paid AI, no API keys | **Decided:** Sanay runs free with no account or key. No Claude/LLM server | We don't have an API key; free also fits "Libre" |
| Translation (F4, F8) | **MyMemory**, a free translation service called straight from the browser (Filipino/Taglish → English; ~5,000 characters a day per connection, no key). Tested: good on Taglish | Free and keyless; only the text is sent, and the app says so |
| The other person in a practice call (F1) | **Written scenarios**: each situation is a short script with branches (calm / upset / follow-up), picked by keywords in your answer | Reliable on demo day, no AI bill; honest wording: "practice partner", not "AI" |
| Scoring (F2) | **Rules we write**: words per minute, filler words ("ahh", "parang", "ano"), long pauses, key phrases per situation (e.g. apology, asking for the order number) | Measurable and explainable; no AI needed |
| Speech to text in the browser | **Chrome's built-in speech recognition** (live captions while you speak) | Free and fast. Note: it sends audio to Google. Say so in the app |
| Cleaned audio into practice | With the Sanay desktop app on, set Chrome's mic to the Sanay (CABLE) mic → practice hears the **noise-cleaned** voice | Uses the existing engine; better scores in noisy homes |
| The other person's voice | Browser text-to-speech with American / British / Australian English voices; better voices are a stretch | Good enough to start; "real-sounding" is a known risk |
| Recording for replay | Record the user's mic in the browser during the call, with timestamps per turn, kept on the device | "Replay your weak moments" |

### Features, in build order
| # | Feature | What the user gets | Est. |
|---|---|---|---|
| F1 | **Practice call** | Pick a situation → a call screen (the orb is the other person, live captions, mute, hang up) → the AI talks, you answer, turn by turn | 3 h |
| F2 | **Score + replay** | After the call: clarity of words, empathy, call flow, grammar, pace, filler words (incl. "ahh", "parang", "ano"), a **Ready score**, and your weak moments to replay and retry | 2 h |
| F3 | **Scenario packs** | **Jobs/BPO** (late order, refund, confused senior; telco, bank, e-commerce; easy → irate), **OFW** (visa/embassy interview, foreign employer video call), **Students** (scholarship, admission interview) | 1.5 h |
| F4 | **"Say it in English"** (translation B) | Say it in Filipino or Taglish → see the English sentence (simple and formal) to read out in your own voice | 1 h |
| F5 | **Pronunciation coach** | Drills for sounds Filipinos often mix up (F/P, V/B, TH, ship/sheep, word stress), feedback explained in Taglish; also flagged automatically from practice calls | 2 h |
| F6 | **Voice option rules in the app** | First-use notice with "I understand", a reminder when turning it on for a live call, terms text | 0.5 h |
| F7 | **Job requirements checklist** (Jobs pack) | NBI, PSA, SSS, PhilHealth, Pag-IBIG, TIN, and free documents for first-time job seekers (RA 11261). **Verify against the official text before shipping** | 1 h |
| F8 | **Filipino subtitles of the other side** (translation A) | During a real call, the other person's English shows as Filipino subtitles in a small floating window (desktop app; uses the speaker audio the engine already captures) | 3 h, hardest, last |

### Status (2026-11-12)
| Feature | Status | Where |
|---|---|---|
| F1 + F3 Practice interview (5 types: call center/BPO, job, work abroad, scholarship, college; spoken partner, masculine or feminine voice) | **Built** | Account → Practice interview (`web/pages/PracticeInterview.tsx`, `web/practice/`) |
| F2 Score + replay + spoken feedback | **Built**, rules unit-tested (`tests/practice-score.test.ts`) | Results screen after the interview |
| F4 Say it in English (free, MyMemory) | **Built** | Account → Say it in English |
| F5 Pronunciation coach (F/P, V/B, TH, i/ee, SH/S) | **Built** | Account → Pronunciation |
| F6 Voice option notice + live reminder | **Built** | Desktop app: first masculine/feminine pick, Home reminder |
| F7 Job requirements checklist | **Removed** (user decision, 2026-11-12) | — |
| F8 Filipino subtitles of the other side | **Roadmap**: needs speech-to-text of the call audio on the computer (Chrome can't hear other apps); free option is a local Whisper model on the GPU | — |

### Rules for Job 2
- Every screen uses plain words: "practice call", "your score", "say it in English"; never technical terms.
- English + Filipino interface; the AI's feedback can be in Taglish.
- Scores judge skills (words, empathy, flow), never the voice option.
- Tests: scoring heuristics and API contracts unit-tested; one end-to-end practice call checked by hand in Chrome.

### Done when
- [ ] F1–F4 and F6 work end to end in Chrome on a laptop and an Android phone.
- [ ] F5 and F7 are in, or clearly marked "coming soon" on the site.
- [ ] F8 works on the desktop app, or it's cut to the roadmap by **hour 7** (decide then).

---

## The demo (live call)
1. **Practice** (~1 min): a short AI practice call → the scorecard → replay one weak moment.
2. **The real call** (~1 min): call a judge on Google Meet with karaoke/tricycle noise playing beside you → tap the pill → silence. Show the voice option with its notice. (F8 subtitles if built.)
3. **Close:** "Libre. Sa phone mo. For job seekers, OFWs and students — and free for every PESO office and school."

**Before going on stage:** test the call on the venue Wi-Fi; phone hotspot as backup; VB-Cable and the call app's mic checked; AI voice server warmed up; noise clip and speaker tested; **recorded backup video**.

---

## Can the two jobs overlap?
Yes, if they keep to their own files: Job 1 owns the landing page (`web/App.tsx` sections) and `web.*`/`landing.*` strings; Job 2 adds new pages (`web/pages/Practice*.tsx`, `SayInEnglish.tsx`, the `#/practice` and `#/preview` routes) and `practice.*` strings. The only shared files are `router.ts` and the two i18n files: merge those carefully.

## Open decisions for you
1. ~~Claude API key~~ **Decided: no API key; Sanay is free and keyless** (see the architecture table).
2. **How many build hours are left.** This decides whether F5, F7 and F8 make it.
3. **The rule on earlier code** (Job 0.4).
