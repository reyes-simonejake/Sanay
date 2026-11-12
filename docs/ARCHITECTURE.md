# Engine architecture

```
mic callback ─► in ring ─► DSP thread ──────────────────────────────► cable ring ─► cable callback
 (downmix)               resample→48k → [denoise ⇄ dry crossfade]    └► monitor ring ► monitor callback
                         → HPF 80 Hz → AGC → limiter
                         → per-sink resample (+ clock-drift trim)
```

* **Callbacks never do work**: they copy samples into/out of lock-free rings and wake the DSP thread.
* **NC toggle / strength** never restart anything. The denoiser always runs; output is
  `m·denoised + (1−m)·dry`, where `dry` is delayed by the denoiser latency (RNNoise: exactly
  480 samples, checked by a unit test). `m` ramps over 20 ms, so changes don't click.
  Strength sets `m = 1 − 10^(−limit/20)`, so noise can't drop below the limit.
* **Clock drift**: the mic and VB-CABLE run on different clocks. Each output sink's async
  resampler trims its ratio (±0.2%) to keep its ring ~20 ms full. Without this, a 2-hour call
  would end in glitches.
* **Hot-plug**: stream errors or 2 s without input mark the engine `DeviceLost`. A watchdog
  thread restarts it when the device comes back. It also restarts when VB-CABLE is installed mid-session.
* **CPU fallback**: if a heavy denoiser's DSP load stays > 90% for 3 s, swap to RNNoise and tell the user.

Latency budget (estimate): 10 ms input chunk + 10 ms RNNoise + 20 ms output ring ≈ 40 ms,
plus device buffers. To be confirmed by a loopback measurement (spec §6).
