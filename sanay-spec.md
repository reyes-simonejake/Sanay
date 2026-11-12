# Sanay — Voice Clarity for Online Interviews

> Working name. "Sanay" = clarity. Rename freely.

**Goal:** Help job applicants (especially in noisy areas, using cheap headsets) sound clear in online interviews — first by removing background noise, later by improving speech clarity and offering pronunciation practice, with accent conversion as an optional advanced feature.

**Core principles**
- **Works with any headset/mic** — all processing is software.
- **Free & open source** — no paid APIs, no subscriptions.
- **Offline & private** — audio never leaves the user's computer. No recording unless the user explicitly starts a practice session.
- **User in control** — every feature is opt-in and can be toggled instantly.

---

## 1. Roadmap overview

| Phase | Feature | Difficulty | Target |
|---|---|---|---|
| **1** | Noise cancellation + virtual mic (Windows) | Medium | MVP — usable in real interviews |
| 2 | Speech clarity enhancement (EQ, de-muffle, leveling) | Medium | Better sound on cheap mics |
| 3 | Practice mode + pronunciation feedback | Medium–Hard | Help users improve on their own |
| 4 | Real-time accent conversion (opt-in) | Hard | Advanced / research feature |
| — | macOS & Linux support | Medium | After Phase 1 is stable |

---

## 2. Phase 1 — Noise Cancellation + Virtual Mic (MVP)

### 2.1 User story
> "I'm in a job interview on Zoom. There's a tricycle outside, a rooster, and my neighbor's karaoke. I open Sanay, pick my headset, select **Sanay Mic** in Zoom, and the interviewer only hears my voice."

### 2.2 How it works

```
 ┌──────────────┐     ┌───────────────────────────────┐     ┌──────────────────┐     ┌────────────────┐
 │ Real mic     │ ──► │ Sanay audio engine            │ ──► │ Virtual cable    │ ──► │ Zoom / Meet /  │
 │ (any headset)│     │ capture → resample → denoise  │     │ (playback side)  │     │ Teams uses the │
 └──────────────┘     │ → level/limiter → output      │     │ appears as a mic │     │ virtual mic    │
                      └───────────────────────────────┘     └──────────────────┘     └────────────────┘
                                   │
                                   └──► (optional) monitor to user's earphones for testing
```

The interview app never touches the real mic. It reads from the virtual mic, which carries Sanay's cleaned audio.

### 2.3 Functional requirements

| ID | Requirement |
|---|---|
| F1 | List all input devices; user selects the real mic. Remember the choice. |
| F2 | Detect if a virtual audio cable is installed; if not, show a setup wizard with a download link and steps. |
| F3 | Route cleaned audio to the virtual cable output automatically. |
| F4 | **Noise Cancellation toggle** (on/off, instant, no audio dropout). |
| F5 | **Strength slider** (Light / Normal / Strong) — maps to the denoiser's attenuation limit (e.g. 12 / 24 / 100 dB). Light keeps voice most natural. |
| F6 | **Live level meters** — input (raw) vs output (cleaned). |
| F7 | **Mic test**: record 5 seconds, play back raw vs cleaned (A/B) so the user hears the difference before the interview. Recording is kept in memory only and discarded. |
| F8 | **Monitor** (optional): hear yourself in earphones. Off by default. |
| F9 | Auto-gain / limiter so quiet speakers aren't too soft and shouting doesn't clip. |
| F10 | Handle device unplug/replug without crashing; auto-reconnect when the same device returns. |
| F11 | System tray icon: toggle NC, open window, quit. Optional "start with Windows." |
| F12 | Simple "Ready for interview" status: green when mic + virtual cable + denoiser are all working. |
| F13 | Tagalog and English UI. |

### 2.4 Non-functional requirements

| Area | Target |
|---|---|
| Latency added | ≤ 40 ms end-to-end (interviewers won't notice) |
| CPU | ≤ 10% on a mid-range laptop (e.g. Intel i5 8th gen / Ryzen 5 3500U) |
| RAM | ≤ 300 MB |
| Audio format | 48 kHz mono internally, 10 ms frames (480 samples) |
| Stability | Runs 2+ hours without dropouts or memory growth |
| Install size | ≤ 100 MB (excluding virtual cable driver) |
| Privacy | No network calls except optional update check; no telemetry by default |
| Offline | Fully functional with no internet |

### 2.5 Audio pipeline detail

1. **Capture** from selected mic (whatever the device's native rate: 16k / 44.1k / 48k).
2. **Downmix to mono** if stereo.
3. **Resample to 48 kHz** if needed.
4. **Ring buffer** between the audio callback thread and the DSP thread (never do heavy work in the callback).
5. **Denoise** with DeepFilterNet3, frame by frame.
6. **High-pass filter** at ~80 Hz (removes rumble and fan hum).
7. **AGC + soft limiter** (target around −18 dBFS speech level, ceiling −1 dBFS).
8. **Resample** to the virtual cable's rate if different.
9. **Output** to the virtual cable (and optionally the monitor device).

Fallback: if the CPU is too slow for DeepFilterNet (frames take longer than real time), automatically switch to **RNNoise** (much lighter) and tell the user.

---

## 3. Recommended stack

### 3.1 Option A — Production app (recommended)

| Layer | Choice | Why |
|---|---|---|
| App shell | **Tauri 2** | Small installer, low RAM, cross-platform later |
| UI | **React + TypeScript + Vite**, Tailwind CSS | Familiar web stack, fast to build |
| Audio engine | **Rust** | Real-time safe, no garbage-collection pauses |
| Audio I/O | **cpal** (Rust crate) | WASAPI on Windows, CoreAudio on Mac, ALSA/PipeWire on Linux |
| Noise cancellation | **DeepFilterNet** (`deep_filter` / libDF Rust crate) | State-of-the-art, real-time, native Rust |
| Fallback denoiser | **RNNoise** (via `nnnoiseless` Rust port) | Very light CPU use |
| Resampling | **rubato** (Rust crate) | High-quality real-time resampler |
| Ring buffer | **ringbuf** (Rust crate) | Lock-free, real-time safe |
| Settings | Tauri store plugin (JSON) | Simple local storage |
| Installer | Tauri bundler → `.msi` / NSIS `.exe` | Built in |

### 3.2 Option B — Quick prototype (to validate in a week)

| Layer | Choice |
|---|---|
| Language | Python 3.11 |
| Audio I/O | `sounddevice` (PortAudio) |
| Denoiser | `deepfilternet` (pip) or `pyrnnoise` |
| UI | PySide6 (Qt) or just a CLI first |
| Packaging | PyInstaller |

Trade-off: easier to write, but higher latency, higher RAM, and a much bigger installer. Use it to prove the idea, then build Option A.

### 3.3 Virtual microphone

| OS | Option | Notes |
|---|---|---|
| Windows | **VB-Audio Virtual Cable** | Free (donationware). User installs it themselves; **check the license before bundling** it in your installer. |
| Windows | Open-source virtual audio driver projects on GitHub | Possible later, but shipping your own driver requires driver signing (costly, complex). Not for MVP. |
| macOS | **BlackHole** | Open source (GPL-3.0) |
| Linux | **PipeWire / PulseAudio** virtual source | Built into the OS, no extra install |

MVP decision: the setup wizard guides the user to install VB-Cable once.

---

## 4. Open-source components (all phases)

> Verify each license yourself before any public or commercial release. Licenses change.

### 4.1 Noise & enhancement
| Project | Use | License (verify) |
|---|---|---|
| DeepFilterNet | Main noise cancellation | MIT / Apache-2.0 |
| RNNoise / nnnoiseless | Light fallback denoiser | BSD-3-Clause |
| Silero VAD | Detect when the user is speaking (for gating, Phase 2–3) | MIT |

### 4.2 Speech recognition (Phase 3–4)
| Project | Use | License (verify) |
|---|---|---|
| faster-whisper / whisper.cpp | Transcription, pronunciation checks | MIT |
| Vosk | Very light offline ASR alternative | Apache-2.0 |

### 4.3 Speech synthesis & voice conversion (Phase 4)
| Project | Use | License (verify) |
|---|---|---|
| Kokoro TTS | Neutral-accent speech output | Apache-2.0 |
| Piper TTS | Fast, light offline TTS | Check current repo (newer versions changed license) |
| OpenVoice V2 | Keep the user's own voice timbre | MIT |
| RVC | Voice conversion | MIT |
| Amphion (Vevo) | Direct accent/style conversion research models | MIT |
| Seed-VC | Zero-shot voice conversion | Check repo (may be GPL) |

### 4.4 Datasets (Phase 3–4 training/evaluation)
| Dataset | Use | License (verify) |
|---|---|---|
| L2-ARCTIC | Non-native English ↔ native pairs | Non-commercial only |
| CMU ARCTIC | Native English reference | Permissive |
| VCTK | Many English accents | CC BY 4.0 |
| LibriTTS | Large clean English speech | CC BY 4.0 |
| Mozilla Common Voice | Accent-labeled speech (filter for Filipino English) | CC0 |
| Speech Accent Archive | Includes Filipino speakers | Non-commercial |
| Microsoft DNS Challenge data | Noise samples for testing NC | Check per subset |
| **Own recordings** | Filipino-English speakers + local noise (tricycle, rooster, karaoke, rain on roof) | Get written consent |

---

## 5. Project structure (Option A)

```
sanay/
├─ src/                    # React UI
│  ├─ pages/ (Home, Setup, MicTest, Settings)
│  ├─ components/ (LevelMeter, Toggle, StrengthSlider, StatusBadge)
│  └─ i18n/ (en.json, fil.json)
├─ src-tauri/
│  ├─ src/
│  │  ├─ main.rs           # Tauri setup, tray, commands
│  │  ├─ audio/
│  │  │  ├─ devices.rs     # list/select/hot-plug devices
│  │  │  ├─ engine.rs      # capture → DSP → output threads
│  │  │  ├─ dsp.rs         # resample, HPF, AGC, limiter
│  │  │  ├─ denoise.rs     # DeepFilterNet + RNNoise fallback
│  │  │  └─ meters.rs      # RMS/peak levels sent to UI
│  │  ├─ setup.rs          # virtual cable detection
│  │  └─ settings.rs
│  └─ tauri.conf.json
├─ models/                 # DeepFilterNet model files
├─ tests/audio_samples/    # noisy test clips
└─ docs/
```

### Tauri commands (UI ↔ engine)
| Command | Purpose |
|---|---|
| `list_devices()` | Input/output devices |
| `start_engine(input_id)` / `stop_engine()` | Run the pipeline |
| `set_nc(enabled)` / `set_strength(level)` | Live controls |
| `get_status()` | Mic OK, cable OK, denoiser OK, CPU load |
| `run_mic_test()` | 5-second A/B test |
| Event `levels` (≈20×/sec) | Input/output meter values |

---

## 6. Testing plan

| Test | How |
|---|---|
| Noise quality | Record the same sentences with local noises; compare raw vs cleaned using **DNSMOS** (no clean reference needed). |
| Speech preserved | Run faster-whisper on raw vs cleaned. Word error rate should not get worse. |
| Latency | Loopback test: play a click, measure delay at the virtual mic. |
| CPU/RAM | Run 2 hours on a low-end laptop; log usage. |
| Headset variety | Test at least: cheap wired earphones, USB headset, Bluetooth headset, laptop built-in mic. |
| Real apps | Zoom, Google Meet, Microsoft Teams, Discord. |
| User testing | 5–10 real applicants run a mock interview; collect feedback. |

---

## 7. Phase 1 milestones (suggested ~6 weeks)

| Week | Deliverable |
|---|---|
| 1 | Python prototype: mic → DeepFilterNet → VB-Cable working in Zoom |
| 2 | Tauri + Rust skeleton; device listing; passthrough audio (no denoise) |
| 3 | DeepFilterNet in Rust engine; resampling; toggle + strength |
| 4 | Level meters, mic test A/B, AGC/limiter, RNNoise fallback |
| 5 | Setup wizard, tray, hot-plug handling, Tagalog/English UI |
| 6 | Testing on low-end laptops and different headsets; installer; v0.1 release |

---

## 8. Later phases (summary)

### Phase 2 — Speech clarity
- Adaptive EQ to fix "muffled" or "tinny" cheap mics.
- De-esser, gentle compression, VAD-based noise gate between sentences.
- "Clarity" toggle separate from noise cancellation.

### Phase 3 — Practice mode
- Mock interview questions (common BPO and entry-level IT questions).
- User answers; faster-whisper transcribes locally.
- Highlights words recognized with low confidence (likely unclear pronunciation).
- Shows speaking pace (words per minute) and filler words ("ahh," "parang," "ano").
- All recordings stay local and can be deleted with one click.

### Phase 4 — Accent conversion (opt-in, advanced)
- **v1 (cascade):** ASR → neutral TTS → voice conversion to the user's own voice. 1–2 s delay; practice and demo use.
- **v2 (direct):** speech-to-speech model (e.g. Amphion Vevo family), fine-tuned on Filipino-English recordings. Target under 300 ms on GPU.
- Clearly labeled, off by default, user decides when to use it.

---

## 9. Ethics, privacy & legal notes

- **Transparency:** Users should understand that an employer will later hear their natural voice at work if the tool isn't used there. Practice mode helps them improve directly.
- **Consent:** Never record without a visible indicator. Any dataset of volunteers' voices needs written consent.
- **Patents:** Sanas holds a patent on real-time accent translation. Noise cancellation and practice features are unaffected; get advice before commercializing Phase 4.
- **Branding:** Don't use Sanas's name, logo, or UI design.
- **Licenses:** Keep a `THIRD_PARTY_LICENSES.md` listing every library and model used.

---

## 10. Definition of done (Phase 1)

- [ ] Installs on Windows 10/11 in under 5 minutes, including the virtual cable setup.
- [ ] Works with any connected mic/headset.
- [ ] Noise clearly reduced in a real Zoom/Meet call with local background noise.
- [ ] ≤ 40 ms added latency, ≤ 10% CPU on a mid-range laptop.
- [ ] Mic test A/B works; meters accurate.
- [ ] No crash on unplug/replug; 2-hour stability test passed.
- [ ] Tested by at least 5 real users.
