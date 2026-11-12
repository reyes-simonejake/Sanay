# Third-party licenses

Every library and model shipped with Sanay (spec §9). **Verify each license before any public
release** — licenses change. Transitive dependencies: generate a full list with
`cargo about` (Rust) and `pnpm licenses list` (UI) before release.

## Runtime (Rust)

| Component | Use | License |
|---|---|---|
| tauri, tauri-plugin-autostart | App shell, tray, autostart | MIT OR Apache-2.0 |
| cpal | Audio I/O (WASAPI) | Apache-2.0 |
| nnnoiseless | RNNoise denoiser (port of Xiph RNNoise) | BSD-3-Clause |
| Signalsmith Stretch + Signalsmith Linear (vendored C++, `src-tauri/vendor/signalsmith`) | Voice type (masculine / feminine) | MIT |
| cc | Builds the vendored C++ | MIT OR Apache-2.0 |
| rubato | Resampling | MIT |
| ringbuf | Lock-free ring buffers | MIT OR Apache-2.0 |
| serde, serde_json, anyhow, log, env_logger, parking_lot, tokio | Utilities | MIT OR Apache-2.0 |

## Runtime (UI)

| Component | Use | License |
|---|---|---|
| React, React DOM | UI | MIT |
| @tauri-apps/api | UI ↔ Rust bridge | MIT OR Apache-2.0 |
| Tailwind CSS | Styling | MIT |
| @sapphi-red/web-noise-suppressor | RNNoise AudioWorklet for the web mic test | MIT |
| shiguredo/rnnoise-wasm (bundled in the above) | RNNoise WASM build | Apache-2.0 (RNNoise: BSD-3-Clause) |
| signalsmith-stretch | Voice type (pitch + formant shift) in the web mic test | MIT |
| GTCRN model + gtcrn-wasm (bundled in web-noise-suppressor) | Main web denoiser | MIT |
| Mona Sans (@fontsource-variable/mona-sans) | Interface typeface, desktop + web | OFL-1.1 |
| Lucide (lucide-react) | Icons | ISC |
| shadcn/ui components + cn | UI components (copied into src/components/ui) | MIT |
| Radix UI (radix-ui) | Accessible primitives behind the shadcn components | MIT |
| tw-animate-css | Animation utilities | MIT |

## Planned

| Component | Use | License |
|---|---|---|
| DeepFilterNet3 (libDF + model weights) | Main denoiser | MIT OR Apache-2.0 |

## Not bundled

| Component | Notes |
|---|---|
| VB-Audio Virtual Cable | Donationware. The user installs it from vb-audio.com; Sanay does not redistribute it. Its licence forbids integrating it into another installer without the author’s agreement. |
