# Tests

## Noise-cancellation benchmark (`noise-bench.js`)

Scores the web denoisers on clean speech mixed with interview-style noise (fan, traffic,
tricycle engine, background chatter) at 5 dB SNR. Reports noise reduction in pauses, SI-SDR
(speech quality) and voice level kept.

1. Generate the clean speech once (kept out of git): `powershell -File tests/make-speech.ps1`
2. `pnpm web:dev`, open http://localhost:5173, then in the devtools console:
   ```js
   const b = await import('/@fs/C:/Sanay/tests/noise-bench.js');
   b.summarize(await b.run())
   ```

Results (Chrome, 2026-11-07), averaged over male + female voice:

| Denoiser | Noise reduction | SI-SDR | Tricycle NR |
|---|---|---|---|
| none | 0 dB | 5.1 dB | 0 dB |
| RNNoise Strong | 16.3 dB | 6.2 dB | 5.0 dB |
| GTCRN Strong | 22.8 dB | 8.4 dB | 34.9 dB |

Background chatter (other voices) is not reduced by either model.

## Voice presets, live web pipeline (`voice-e2e.js`)

Plays the sample voices (incl. `speech_typical_*.wav`, written by the Rust render test below)
through the real `WebEngine` graph and measures the output with a second copy of the
`sanay-pitch` analyser (pitch + vocal-tract length).

1. `cd src-tauri && cargo test --release --lib real_speech_render -- --ignored` (writes the
   typical voices and the desktop `out_*.wav` renders for listening)
2. `pnpm web:dev`, open http://localhost:5173, devtools console:
   `(await import('/@fs/C:/Sanay/tests/voice-e2e.js')).arm()`, then click "Run voice e2e"
3. ~3 minutes later: `window.__voiceE2E`

## Rust

`cd src-tauri && cargo test --lib`: DSP, AGC (incl. "doesn't boost background noise"),
RNNoise latency, voice type pitch shift.

## Website end-to-end and usability run (`e2e/run.mjs`)

Drives the real website in headless Chrome (no extra packages; Node 22+ and Chrome). Speech
recognition and the interviewer's voice are replaced by a simulated speaker (`e2e/mocks.js`) that
answers with scripted lines, so every flow runs without a microphone. Say it in English calls the
real free translation service. Screenshots (phone 360 px and desktop 1440 px) go to `e2e/shots/`.

```sh
pnpm web:build && pnpm web:preview --port 4173   # in one terminal
node tests/e2e/run.mjs                           # all checks
node tests/e2e/run.mjs "Practice interview"      # one group (also: page, Say it, Pronunciation, Filipino, phone)
```

On a computer with little free memory, run one group at a time.

Scoring rules: `node tests/practice-score.test.ts`.
