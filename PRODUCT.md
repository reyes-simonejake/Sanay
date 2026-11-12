# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Windows desktop app built with Tauri 2: the interface is a React web view. Plus a planned account website.)

## Users

Anyone on live calls (Zoom, Google Meet, Teams, Discord and similar) who wants to sound clearer, or to sound different, while they talk. The original audience, job applicants in noisy Filipino homes using cheap headsets, is still a core case. The user is mid-call when they touch Sanay: attention is on the other person, not on the app.

## Product Purpose

Sanay sits between the user's real microphone and the call app. It removes background noise and can change the voice in real time to an AI masculine or feminine voice, delivered through a virtual microphone the call app selects. Success: the other side hears clear words, with no noise and no noticeable delay (about a quarter second), and the user can switch it on or off instantly mid-call.

## Positioning

Sanas-like live voice conversion that runs locally on the user's own PC (GPU), with noise cleanup always applied under every voice. Audio stays on the computer.

## Operating Context

- Main window: small. The user picks one of three voices: **Masculine**, **Feminine**, **Natural** (their own voice, cleaned). Noise cleanup is always on; it is not a separate choice.
- After choosing, the user minimises the window. A small floating on/off toggle stays on top of every window (including the call app), can be dragged anywhere on screen, and is the in-call control: On = chosen voice, Off = the user's untouched voice. Window, toggle and tray stay in sync.
- Sanay keeps running in the system tray when the window is closed, so a call never drops.
- Setup needs a virtual audio cable (VB-Cable for now, which users install themselves from vb-audio.com; it may not be bundled). Own "Sanay Microphone" driver is on hold (needs Microsoft signing).
- Planned: an account website (sign-up, login, account and subscription management); the desktop app activates after sign-in.

## Capabilities and Constraints

- AI voices need a local voice server and a GPU; the app falls back to the DSP voice if the AI voice is not ready, without cutting audio.
- Interface languages: English and Filipino/Tagalog (both kept).
- Undecided: pricing (free, subscription, or free + paid tier). Design must not assume pricing.
- The AI voice models use base weights cleared for testing only; no commercial release until replaced or cleared.

## Brand Commitments

- Name: Sanay ("practiced, used to it" in Filipino: *"Sanay ka na"*). Logo (chosen by the user 2026-11-09, "Voice Line"): a white voice wave passing through an indigo orb on a night-ink rounded tile, public/logo.svg; app icons generated from it. The previous teal waveform tile is retired.
- Visual direction pinned by the user (2026-11-09): the references in src/sources (luminous voice orb and waves, night ink, frosted glass). Dark by default with a light version.
- No emoji in the interface; icons come from an icon library.

## Evidence on Hand

No testimonials, customers, benchmarks or pricing exist. Do not invent any.

## Product Principles

- The call comes first: never drop or block audio; failures fall back gracefully.
- One glance, one action: in-call controls must be readable and usable in under a second.
- User in control: on/off is instant and always reachable.
- Private by default: audio is processed on the user's computer.
