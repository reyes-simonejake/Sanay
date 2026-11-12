# Vendored: Signalsmith Stretch (MIT)

Header-only C++ pitch/time/formant shifter used for the desktop "Voice type" option.

- `signalsmith-stretch.h`: Signalsmith Stretch v1.3.1, (c) Geraint Luff / Signalsmith Audio Ltd, MIT
- `signalsmith-linear/`: Signalsmith Linear, (c) Signalsmith Audio, MIT

Copied from the `signalsmith-stretch` 0.1.3 crate sources. Vendored instead of depending on that
crate because its build uses `bindgen` (needs LLVM/libclang installed), and its formant-base
binding calls the wrong method. Sanay's own C wrapper is `src-tauri/src/audio/voice.cpp`.
