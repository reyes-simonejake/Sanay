<p align="center"><img src="public/logo-dark.svg" width="88" alt="Sanay logo"></p>

# Sanay

**Sound your best on every call.** Sanay sits between your real microphone and Zoom, Google Meet,
Teams or Discord. It removes the noise around you (the tricycle, the rooster, the neighbour's
karaoke) and can give you a **masculine or feminine AI voice, live**, with a floating on/off pill
you can reach mid-call. Before the call that matters, you can **practise it** with an AI partner
and get a score. Everything runs on your own computer.

"Sanay" means *practised, used to it* in Filipino, as in *"Sanay ka na."* (You've got this.)
It stands for both halves of the product: practise the call, then sound clear on the real one.

Built for the Philippine community (hackathon bucket 04, *Most Useful for the PH Community*):
students, job seekers, OFWs and their families, nurses, freelancers, small businesses, and
Lolo and Lola.

> **Status:** personal testing build. The AI voices use RVC base weights that are cleared for
> testing only, so they are not part of any release until replaced or cleared. Pricing is not
> decided. See [`sanay-spec.md`](sanay-spec.md) for the plan and [`PRODUCT.md`](PRODUCT.md) for
> the product record.

## What's in here

| Part | What it does |
|---|---|
| **Desktop app** (`src/`, `src-tauri/`) | Tauri 2 + React. Pick **Masculine · Feminine · Natural**; noise cleanup is always on. The orb in the window is the on/off switch and shows the live voice. A floating, draggable, always-on-top **pill** switches Sanay on/off during a call. Lives in the tray so a call never drops. |
| **Audio engine** (`src-tauri/src/audio/`) | Rust, real time: capture → 48 kHz → echo cancellation (speaker loopback reference) → hum/rumble removal → denoiser → voice stage → pause cleanup → AGC → limiter → virtual cable. Clock-drift control, hot-plug recovery, mic fallback. |
| **AI voice stage** (`src-tauri/src/audio/ai_voice.rs`) | Streams 100 ms blocks to a local voice server (RVC v2, 40 kHz) over 127.0.0.1 and back, about 0.24 s total delay on an RTX 2050. Falls back to the DSP voice while the AI voice starts or if it is unavailable, without cutting audio. |
| **Landing page** (`web/journey/`, `web/landing/`) | A dark, scroll-driven 3D night city (three.js / React Three Fiber): a skyline of homes and buildings glides under the hero, the camera walks down a lit street whose windows pulse like a voice through three steps (*Practise first*, *Know what to fix*, *Just you*), a ring of cards of real Filipinos and the calls they have coming, and a sunrise close, *Sanay ka na.* English and Filipino. |
| **Voice lab** (`web/App.tsx`, `web/useVoiceLab.ts`) | Press **Test your voice**: live spectrum, meters, record and compare raw vs cleaned, and an AI voice preview when the local voice server is running. Runs in the browser; nothing is uploaded. |
| **Practice** (`web/pages/`, `web/practice/`) | Behind sign-in: practice interviews (call center, job, abroad/visa, scholarship, college) where Sanay asks the questions out loud and scores clarity, pace and filler words; a pronunciation coach; and *Say it in English*. |

## How a call works

```
real mic ─► Sanay engine (Rust) ─► VB-CABLE "CABLE Input" ─► the call app uses "CABLE Output" as its mic
            clean → (AI voice ⇄ local voice server) → level → limit
```

The virtual microphone is [VB-CABLE](https://vb-audio.com/Cable/) for now. Users install it
themselves from VB-Audio (its licence does not allow bundling it). A signed "Sanay Microphone"
driver is planned for later.

## Design

The look is **Luminous Voice**: night ink, frosted surfaces, and one living WebGL orb whose colour
is the voice (Masculine blue, Feminine violet, Natural silver; off is a thin ring). Mona Sans,
Lucide icons, dark by default with a light theme (System / Light / Dark, animated switch). The
website's landing page is dark only: a night city that ends at sunrise.
Tokens and rules: [`DESIGN.md`](DESIGN.md). Logo: [`public/logo.svg`](public/logo.svg)
(adapts to light/dark), with static [`logo-dark.svg`](public/logo-dark.svg) and
[`logo-light.svg`](public/logo-light.svg).

## Development

Prerequisites (Windows): Node 20+, pnpm, Rust (MSVC toolchain), WebView2 (built into Windows 11),
and [VB-CABLE](https://vb-audio.com/Cable/) for real calls.

```sh
pnpm install
pnpm tauri dev          # desktop app (hot-reloads the UI)
pnpm web:dev            # website at http://localhost:5173
pnpm tauri build        # .msi / NSIS installer in src-tauri/target/release/bundle
pnpm web:build          # static site in dist-web/ (mic access needs HTTPS)

cd src-tauri
cargo test --lib        # engine and DSP unit tests
```

**AI voices (personal build).** The voice server and models live outside this repository, in
`D:\dev\SanayAI` (override with the `SANAY_AI_ROOT` environment variable). The desktop app starts
it automatically when you pick Masculine or Feminine. Without it, those voices use the built-in DSP
voice.

### Deploying the website

The website is a static site (`pnpm web:build` → `dist-web/`), so any HTTPS host works.

- **GitHub Pages:** `.github/workflows/deploy-web.yml` publishes it on every push to `main`.
- **Vercel:** import the repo with Build Command `pnpm web:build`, Output Directory `dist-web`,
  Node 24. Pages use `#/` addresses, so no rewrites are needed.

Online, noise removal, the landing page and practice work in the visitor's browser. Accounts are
a demo kept in each browser (no server yet), and the AI voice preview needs the local voice server,
so it only works on your own computer.

**Maintenance mode (website):** build with `VITE_MAINTENANCE=1` (optionally `VITE_MAINTENANCE_UNTIL="around 3:00 PM"`) to show the maintenance page instead of the site. Preview the special screens locally with `?preview=maintenance`, `?preview=error` or `?preview=splash`.

## Layout

| Path | What |
|---|---|
| `src/App.tsx`, `src/pages/` | Main window: home (orb + voices), settings, mic test, setup |
| `src/pill/Pill.tsx` | The floating on/off pill window |
| `src/lib/orb.ts`, `src/components/Orb.tsx` | The WebGL orb (shader, per-voice light) |
| `src/lib/theme.ts` | System / Light / Dark theme with animated switching |
| `src/lib/api.ts` | Typed wrappers for the Rust commands and events |
| `src/i18n/` | English and Filipino strings |
| `src-tauri/src/lib.rs` | Tauri commands, tray, pill window, settings, autostart |
| `src-tauri/src/audio/` | Engine, denoiser, cleanup, voice, AI voice stage, devices |
| `web/App.tsx`, `web/useVoiceLab.ts` | Website shell, navigation and the browser voice lab |
| `web/journey/` | The landing page's 3D scroll journey: `Scene.tsx` (sky, city, cards, sun), `Journey.tsx` (words) |
| `web/landing/` | Landing sections, copy in English and Filipino (`copy.ts`) and photo credits (`photos.ts`) |
| `web/pages/`, `web/practice/` | Sign-in, account, guide, practice interview and its scoring |

## Progress

- [x] Real-time engine with virtual cable, clock-drift control, hot-plug recovery, mic fallback
- [x] Noise cleanup (hum remover, rumble filter, denoiser, pause expander), AGC and limiter
- [x] Echo cancellation for any mic: removes what the speakers play before the voice model, so the other person never hears themselves in the AI voice
- [x] AI voices, live: masculine and feminine (RVC, local GPU server), with DSP fallback
- [x] Desktop UI: orb switch, three voices, floating pill, tray, English and Filipino
- [x] Website: voice lab, AI voice preview
- [x] Landing page: 3D night city of homes and buildings, cards of real Filipinos, sunrise close; English and Filipino
- [x] Practice interviews with a score (call center, job, visa, scholarship, college), pronunciation coach
- [x] Website accounts (preview): sign up, log in, account page (profile, Sanay preferences, plan, security). Stored in the browser for now (`web/auth/backend.ts`, PBKDF2-hashed passwords); a real backend replaces that one file
- [x] Luminous Voice design, new logo, light/dark with animated switching
- [ ] Live-call testing in Zoom / Meet / Teams
- [ ] Word clarity of the AI voices on accented speech
- [ ] Desktop denoiser upgrade (GTCRN or DeepFilterNet3)
- [ ] Real account backend (hosted), subscription, and desktop app activation
- [ ] Licence-clean voice weights; own signed virtual microphone driver

## Privacy

Audio is processed on your own computer. The AI voice server runs locally (127.0.0.1). No
telemetry; mic tests live in memory and are discarded.

## License

Code: MIT OR Apache-2.0. See [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md) for
dependencies, including Mona Sans (OFL-1.1) and VB-CABLE's terms. The landing page's photographs
are from Pexels and Unsplash under their licences, credited on the page and in
[`web/landing/photos.ts`](web/landing/photos.ts). Sanay is not affiliated with
Sanas, Zoom, Google, Microsoft or any other company.
