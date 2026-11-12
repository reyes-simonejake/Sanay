<p align="center"><img src="public/logo-dark.svg" width="88" alt="Sanay logo"></p>

# Sanay

**Sound clear on every call.** Sanay sits between your real microphone and Zoom, Google Meet,
Teams or Discord. It removes background noise and can give you a **masculine or feminine AI voice,
live**, with a floating on/off pill you can reach mid-call. Everything runs on your own computer.

"Sanay" means *practiced, used to it* in Filipino, as in *"Sanay ka na."* (You've got this.)

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
| **Website** (`web/`) | A landing page whose hero *is* the demo: press **Test your voice** and the orb follows your voice. Below it, the voice lab: live spectrum, meters, record and compare raw vs cleaned, and an AI voice preview when the local voice server is running. Runs in the browser; nothing is uploaded. |

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
Lucide icons, dark by default with a light theme (System / Light / Dark, animated switch).
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

`.github/workflows/deploy-web.yml` publishes the website to GitHub Pages on push to `main`.

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
| `web/App.tsx`, `web/useVoiceLab.ts` | Website and the browser voice lab |

## Progress

- [x] Real-time engine with virtual cable, clock-drift control, hot-plug recovery, mic fallback
- [x] Noise cleanup (hum remover, rumble filter, denoiser, pause expander), AGC and limiter
- [x] Echo cancellation for any mic: removes what the speakers play before the voice model, so the other person never hears themselves in the AI voice
- [x] AI voices, live: masculine and feminine (RVC, local GPU server), with DSP fallback
- [x] Desktop UI: orb switch, three voices, floating pill, tray, English and Filipino
- [x] Website: landing + voice lab, AI voice preview
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
dependencies, including Mona Sans (OFL-1.1) and VB-CABLE's terms. Sanay is not affiliated with
Sanas, Zoom, Google, Microsoft or any other company.
