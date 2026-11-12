---
name: Sanay
description: Live-call voice cleanup and conversion; one living orb of light is the switch, the status and the voice.
colors:
  luminous-indigo: "#6f7bff"
  ember: "#ff8a4c"
  voice-masculine: "#3f6bff"
  voice-feminine: "#a35cff"
  voice-natural: "#c4ccd8"
  night-ink: "#06070c"
  cool-paper: "#f5f6fa"
  night-card: "#0d0f17"
  night-raised: "#161925"
  moonlight-text: "#eef0f6"
  dusk-muted: "#959cae"
  high-contrast-button: "#f3f4f8"
  focus-ring: "#7d88ff"
  hairline: "rgb(255 255 255 / 0.08)"
  input-edge: "rgb(255 255 255 / 0.14)"
  glass: "rgb(17 20 31 / 0.62)"
  glass-edge: "rgb(255 255 255 / 0.09)"
  pill-ground: "rgb(12 14 22 / 0.88)"
  pill-edge: "rgb(255 255 255 / 0.12)"
  ok-green: "#5fd39a"
  warn-amber: "#f2b45a"
  signal-red: "#ff6b5e"
typography:
  display:
    fontFamily: "Mona Sans Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 6.4vw, 5.25rem)"
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 108"
  headline:
    fontFamily: "Mona Sans Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(1.9rem, 3.4vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 106"
  title:
    fontFamily: "Mona Sans Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 110"
  body-lead:
    fontFamily: "Mona Sans Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Mona Sans Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum'"
  label:
    fontFamily: "Mona Sans Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "Mona Sans Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.375
rounded:
  sm: "7px"
  md: "10.5px"
  lg: "14px"
  xl: "18.2px"
  2xl: "23.8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  gutter: "20px"
  lg: "24px"
  xl: "32px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.high-contrast-button}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "40px"
  button-hero:
    backgroundColor: "{colors.high-contrast-button}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.full}"
    padding: "0 24px"
    height: "48px"
  button-outline:
    backgroundColor: "{colors.night-card}"
    textColor: "{colors.moonlight-text}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "40px"
  status-chip:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.dusk-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "0 12px"
    height: "28px"
  voice-tile:
    backgroundColor: "{colors.night-card}"
    textColor: "{colors.moonlight-text}"
    rounded: "{rounded.xl}"
    padding: "12px"
  card:
    backgroundColor: "{colors.night-card}"
    textColor: "{colors.moonlight-text}"
    rounded: "{rounded.xl}"
    padding: "16px"
  glass-panel:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.moonlight-text}"
    rounded: "{rounded.2xl}"
    padding: "24px"
  pill:
    backgroundColor: "{colors.pill-ground}"
    textColor: "{colors.moonlight-text}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: "44px"
    width: "212px"
---

# Design System: Sanay

## Overview

**Creative North Star: "Luminous Voice"**

Your voice, made visible. One living orb of light is the switch, the status and the voice choice at once: alive and coloured means the call hears Sanay; a thin dim ring means the call hears your untouched mic. Everything else is night ink, quiet frosted surfaces and hairline edges, so the light has nothing to compete with. The same world runs the small desktop window (~400x640), the floating always-on-top pill, and the website, where the orb listens to the visitor's own mic in the first viewport.

Density is low and calm: the user is mid-call, attention on the other person, so every surface answers one question at a glance. Dark is the default (most calls happen at night, and the references are dark); a light version on cool paper follows the Windows setting through `prefers-color-scheme`. It refuses the generic dark panel with a toggle switch and the retired "On Air" lamp it replaces. The logo, "Voice Line" (`public/logo.svg`), is the system in miniature: a white voice wave through an indigo orb on a night-ink tile.

**Key Characteristics:**
- One saturated element per view: the orb (or its small swatch echo). Its colour is the voice.
- Night ink (dark) / cool paper (light) grounds; frosted glass with a 1px hairline edge.
- Mona Sans Variable throughout; headlines slightly wide (`wdth` 106-112) with tight tracking.
- Lucide icons at 16px, never emoji.
- High-contrast neutral buttons; indigo is for focus, links and small brand marks, not for fills.

## Colors

A cool, nearly colourless night palette where light itself carries the only saturation. Frontmatter values are the dark (default) theme; each token's light-theme value is in `.impeccable/design.json` (`colorMeta.<token>.light`) and in `src/index.css`.

### Primary
- **Luminous Indigo** (`luminous-indigo`): the brand. Focus rings (`focus-ring`), the text caret, text selection (35% mix), in-text links (the Settings mic-test link), small icon marks (the cable hint icon, desktop step icons), the clean line in the web spectrum, and the logo orb.

### Secondary
- **Ember** (`ember`): the warm rim of the light. Defined as a token and reserved; no shipped surface paints it yet. Use it sparingly, for a single warm accent, never as a fill.

### Tertiary: the voice light
Masculine Blue (`voice-masculine`), deep blue light; Feminine Violet (`voice-feminine`), violet with a rose rim; Natural Silver (`voice-natural`), silver-white with a cyan rim. These are UI swatch values. The orb shader carries full five-stop palettes (deep, mid, high, rim, glow) in `src/lib/orb.ts`, recorded in the sidecar; the `mid` stop matches the swatch. Palette changes cross-fade.

### Neutral
- **Night Ink** (`night-ink`) / **Cool Paper** (`cool-paper`): page ground.
- **Night Card** (`night-card`; white on paper): cards and voice tiles.
- **Night Raised** (`night-raised`): secondary and muted fills; popovers sit one step lighter.
- **Moonlight** (`moonlight-text`; ink on paper): primary text.
- **Dusk** (`dusk-muted`): secondary text, labels, unchosen states.
- **Hairline** (`hairline`) and **Input Edge** (`input-edge`): borders are white/ink at 8-16% alpha, never a solid grey.
- **Glass** (`glass`, `glass-edge`): frosted surfaces.
- **Pill Ground** (`pill-ground`, `pill-edge`): the pill stays dark in both themes, because it floats over any app.
- **Status:** OK Green (`ok-green`) for "Ready" and success; Warn Amber (`warn-amber`) for not ready, fallback and the pill's unseen mark; Signal Red (`signal-red`) for errors and the recording dot.

### Named Rules
**The Only Light Rule.** The only saturated colour on a screen is the voice light: the orb, its swatches, and the glow under the hero's primary action and horizon arc. Status colours appear as small text and dots, never as fills.

**The Colour Is the Voice Rule.** Blue means Masculine, violet means Feminine, silver means Natural, everywhere: orb, tile swatch, pill dot, web swatch, horizon arc. Never use a voice colour for anything else.

**The White Button Rule.** shadcn's `primary` is the high-contrast neutral (white on night, ink on paper). Indigo never fills a button.

## Typography

**Display Font:** Mona Sans Variable (with Segoe UI, system-ui), self-hosted via `@fontsource-variable/mona-sans/wdth.css` (OFL), weight and width axes.
**Body Font:** the same family at normal width.

**Character:** One geometric grotesque doing everything; the width axis does the work a second family would. Headlines stretch slightly and tighten; UI text stays at 100% width for legibility at small sizes.

### Hierarchy
- **Display** (600, clamp 2.75-5.25rem, 0.98, -0.035em, wdth 108): the web hero headline only.
- **Headline** (600, clamp 1.9-2.75rem, 1.25, -0.03em, wdth 106): web section titles.
- **Title** (600, 22px, 1.25, -0.02em, wdth 110): the app's state line under the orb ("Live · Feminine"); muted when off.
- **Wordmark** (600, 17px, -0.01em, wdth 112): "Sanay" beside the logo; the pill's On/Off word uses 13px at wdth 110 (prose-only role).
- **Body lead** (400, 17px, 1.625): web supporting paragraphs, max ~34rem.
- **Body** (400-600, 15px, 1.5): app rows, tile names, setting labels (600).
- **Label** (500, 13px): section labels ("Your voice"), state body, chip text. Sentence case, no uppercase tracking.
- **Caption** (400, 12px): hints and tile descriptions.

### Named Rules
**The Tabular Numbers Rule.** The body sets `font-variant-numeric: tabular-nums`, so delay ("0.24 s") and load figures never jitter.

**The Wide Only When Large Rule.** Width above 100% is for headlines, the wordmark and the On/Off word; never body or labels. h1-h3 also get `text-wrap: balance` and -0.02em.

## Layout

- **Desktop window:** a single column, `max-width: 448px`, 20px side gutter, 24px between blocks. Top bar 56px (logo 24px, wordmark, status chip pushed right, settings icon). The orb switch is 288px (bleeds -24px vertically so the glow is not clipped), then the state lines, then three voice tiles in a 3-column grid with 8px gaps, then the mic hint. The pill is a 212x52 transparent window; only the 44px capsule paints.
- **Website:** `max-width: 1152px`, 20px gutter (32px from 640px). Hero is a two-column grid from 1024px (`1.05fr 1fr`, 48px gap): text left, orb right at up to 600px; on small screens the orb comes first at 300px. Sections pad 96px vertically. The voice lab is `1.35fr 1fr` on large screens, stacking below.

## Elevation & Depth

Depth comes from light and translucency, not shadows. Surfaces are flat at rest; the frosted `.glass` material (`backdrop-filter: blur(18px) saturate(140%)` with a 1px `glass-edge` border) is the one raised layer. Glow belongs to the voice light: the orb's shader glow, a selected swatch's halo, and the hero CTA's voice-coloured underglow.

### Shadow Vocabulary
- **Pill float** (`0 8px 20px -8px rgba(0,0,0,0.55)`): only the pill, which floats over arbitrary windows.
- **Voice halo** (`0 0 18px -2px var(--voice-*)`; 10-14px on small dots): a selected swatch or the lit pill dot.
- **Hero underglow** (`0 10px 40px -12px var(--voice-*)`): the web's "Test your voice" button.

### Named Rules
**The One Elevation Rule.** A frosted surface gets a hairline edge and no wide shadow. Never pair a border with a broad drop shadow.

**The Horizon Rule.** On the web hero, an arc of light (a 175vw circle with a 1.5px voice-tinted top edge and a soft voice glow) sits under the orb and fades into the ground. It is the hero's own device; don't repeat it elsewhere.

## Shapes

Round and soft. The base radius is 14px (`--radius: 0.875rem`) with steps 7, 10.5, 14, 18.2 and 23.8px. Buttons use 14px; app cards and voice tiles 18px; web glass panels 24px. Anything you press in the world of the voice (the orb, the pill, status chip, web swatches, hero buttons, segmented choices) is a full circle or capsule. The logo tile uses about 23% corners. Borders are always 1px hairlines; the off-state pill dot uses a 1.5px ring.

## Components

### Orb (signature)
A WebGL fragment shader on a square canvas. **On:** a liquid orb with a deep top, white-hot underside, a thin rim crescent strongest upper-left, and a soft outer glow; its edge waves with three slow sine waves whose amplitude follows the live output level (fast attack, slow release). **Off:** it shrinks to a thin dim ring tinted 30% toward the voice's rim. Switching on blooms slowly; the colour cross-fades. In light mode the body lifts 22% toward its highlight and the glow drops to 60%. Reduced motion runs time at 15% and level at 30%. Without WebGL a still radial gradient keeps the state. In the app the orb is a `role="switch"` button; hover scales 1.03, press 0.98, with `cubic-bezier(0.16, 1, 0.3, 1)` over 500ms.

### Pill
The in-call control, 44px capsule on `pill-ground` with a `pill-edge` hairline and `backdrop-blur-xl`. Left: a 32px voice dot (radial white-to-voice gradient with a halo when on; a 1.5px white/30 ring when off; pulsing while starting). Then the On/Off word (13px, 600, wdth 110) and the voice name (muted). Click toggles, drag beyond 4px moves the window, right-click opens Sanay. An amber `TriangleAlert` appears while blocked or while a fallback is unseen.

### Voice Tiles
Three side-by-side radio tiles (12px padding, 18px corners). Each has a 28px swatch of its voice light, a 15px name and a 12px description. Selected: `foreground/40` border, solid card, swatch halo. Unchosen: hairline border, card at 40%, swatch at 70% opacity, text fully readable. Focus draws a 2px ring outline on the whole tile.

### Buttons
Primary is the high-contrast neutral: 14px corners and 40px tall in the app, a 48px capsule with 24px padding on the web hero; hover drops to 80% opacity, press nudges 1px down. Outline is a card or transparent fill with the input edge (a glass capsule on the web). Ghost icon buttons are 32px squares with a 16px Lucide icon; hover fills `muted`.

### Status Chip
A glass capsule (28px, 12px text) in the top bar: an 8px dot (green ready, amber warn, input-edge grey idle), the bold status word in its tone, then " · 0.24 s" when live. `role="status"`, polite.

### Cards / Containers
App cards: 18px corners, `night-card`, hairline border, 16px padding, no shadow, rows split by `Separator`. Web glass panels: `.glass`, 24px corners, 24-32px padding. Warning card: a `warn/40` border and an amber title with an icon.

### Inputs / Fields
shadcn radix-nova `Select` (40px in settings, on card fill) and `Switch` (32x18, checked = primary neutral, unchecked = input edge). Focus: a 3px `ring/50` halo plus the ring-coloured border; globally `:focus-visible` draws a 2px `focus-ring` outline at 2px offset.

### Navigation
App: a 56px top bar; inner pages swap the logo for a ghost back arrow. Web: a 64px transparent nav over the hero (logo 28px, wordmark, 14px muted links that brighten on hover, a transparent language select with a glass edge). Web voice swatches are a glass capsule radiogroup of three 36px buttons with 14px voice dots; selected gets `foreground/10` fill and the dot's halo.

## Do's and Don'ts

### Do:
- **Do** let the lamp never lie: blocked or not ready means the orb shows the unlit ring and the pill shows no voice dot colour, never a lit orb.
- **Do** keep a change lit until seen: when the AI voice falls back, the pill keeps its amber `TriangleAlert` until the user opens Sanay.
- **Do** keep unchosen voices readable: only the border, fill and swatch dim; names and descriptions keep full contrast.
- **Do** colour every voice mark from `--voice-masculine`, `--voice-feminine` or `--voice-natural`, and keep the shader palettes in `src/lib/orb.ts` in step with them.
- **Do** use `.glass` for any frosted surface, and Lucide icons at 16px (14px in captions), `aria-hidden`, beside a text label.
- **Do** ship every token for both themes; the pill alone stays dark.
- **Do** honour `prefers-reduced-motion`: transitions collapse to 0.01ms and the orb slows to a near-still breath.

### Don't:
- **Don't** add a second saturated colour; status hues stay small (text, dots, icons).
- **Don't** fill buttons, cards or backgrounds with Luminous Indigo or a voice colour.
- **Don't** put a wide drop shadow on a bordered or frosted surface; the pill float is the only drop shadow.
- **Don't** use emoji or icon fonts; icons come from Lucide.
- **Don't** stretch body or label text wider than 100%.
- **Don't** bring back the On Air red lamp, felt ground or teal waveform tile; that world is retired.
