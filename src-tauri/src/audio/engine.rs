//! The real-time pipeline (spec §2.5):
//!
//! ```text
//! mic callback ──► in ring ──► DSP thread ───────────────────────────────────────► cable ring ──► cable callback
//!  (downmix)                  resample→48k → echo cancel → denoise → HPF → AGC/limit └► monitor ring ─► monitor callback
//! speaker loopback ─► far ring ──┘ (what the call plays, so its echo can be removed)
//!                             → resample→device rate (+ clock-drift trim)
//! ```
//!
//! * Audio callbacks only copy samples; all heavy work happens on the DSP thread (step 4).
//! * Each output sink trims its resampling ratio by a few hundred ppm to keep its ring at a
//!   constant fill level. The mic and the virtual cable run on different clocks; without this
//!   the buffer would slowly overflow or starve during a long interview.
//! * cpal streams are created, owned and dropped by the DSP thread.

use super::denoise::{DenoiserKind, NoiseStage, Rnnoise, Strength};
use super::devices;
use super::dsp::{self, Agc, HighPass, Limiter, FRAME, SAMPLE_RATE};
use super::meters::{AtomicF32, Levels, Meter};
use super::cleanup::{Expander, HumRemover};
use super::aec::{self, EchoCanceller, RefBuffer};
use super::ai_voice::{AiStage, AiStatus};
use super::voice::{VoiceStage, VoiceType};
use anyhow::{anyhow, Context, Result};
use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::{FromSample, Sample, SampleFormat, SizedSample};
use parking_lot::Mutex;
use ringbuf::traits::{Consumer, Observer, Producer, Split};
use ringbuf::{HeapCons, HeapProd, HeapRb};
use rubato::audioadapter_buffers::direct::InterleavedSlice;
use rubato::{Async, FixedAsync, PolynomialDegree, Resampler};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicU8, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

/// Target fill of each output ring. Big enough to absorb DSP-thread wake-up jitter.
const OUTPUT_TARGET_MS: f32 = 20.0;
/// Mic test length (F7).
pub const MIC_TEST_SECONDS: usize = 10;
/// No input for this long while running ⇒ treat the mic as gone (some drivers never error).
const INPUT_STALL: Duration = Duration::from_secs(2);

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum EngineState {
    Stopped,
    Starting,
    Running,
    /// The mic or an output device went away; the watchdog will reconnect (F10).
    DeviceLost,
    Error(String),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TestState {
    Idle,
    Recording,
    Ready,
}

pub struct MicTest {
    pub state: TestState,
    pub raw: Vec<f32>,
    pub clean: Vec<f32>,
}

/// State shared between the engine owner, the DSP thread and the UI.
pub struct Shared {
    pub nc_enabled: AtomicBool,
    pub strength: AtomicU8,
    pub monitor_enabled: AtomicBool,
    /// Voice type (masculine / feminine) and how strongly to apply it (0..1).
    pub voice_type: AtomicU8,
    pub voice_amount: AtomicF32,
    /// Clarity boost (de-mud, presence, de-essing) for the natural voice.
    pub clarity: AtomicBool,
    /// Use the AI voice model (local voice server) for Masculine / Feminine when available.
    pub ai_enabled: AtomicBool,
    /// Master on/off (the floating pill). Off = the untouched mic goes to the call.
    pub active: AtomicBool,
    /// Remove the speakers' sound (the other person) from the mic, so they never hear themselves.
    pub echo_cancel: AtomicBool,
    /// True while the speakers are being listened to (the echo canceller has a reference).
    pub echo_ref: AtomicBool,
    /// Speakers the echo reference is taken from (device id), to notice when Windows switches them.
    pub echo_device: Mutex<Option<String>>,
    pub ai: Arc<AiStatus>,
    /// Detected mains hum frequency being removed (0 = none).
    pub hum_hz: AtomicF32,
    pub in_meter: Meter,
    pub out_meter: Meter,
    /// DSP time per frame / frame duration (1.0 = 100% of real time).
    pub dsp_load: AtomicF32,
    pub frames: AtomicU64,
    pub state: Mutex<EngineState>,
    pub denoiser: Mutex<Option<DenoiserKind>>,
    /// Set when we had to switch to the lighter denoiser for CPU reasons.
    pub fell_back: AtomicBool,
    pub cable_active: AtomicBool,
    pub latency_ms: AtomicF32,
    pub test: Mutex<MicTest>,
    /// The mic currently open (may be the default-mic fallback).
    pub active_input: Mutex<Option<devices::ActiveInput>>,
}

impl Shared {
    fn new() -> Self {
        Self {
            nc_enabled: AtomicBool::new(true),
            strength: AtomicU8::new(Strength::Normal.to_u8()),
            monitor_enabled: AtomicBool::new(false),
            voice_type: AtomicU8::new(VoiceType::Natural.to_u8()),
            voice_amount: AtomicF32::new(0.8),
            clarity: AtomicBool::new(true),
            ai_enabled: AtomicBool::new(true),
            active: AtomicBool::new(true),
            echo_cancel: AtomicBool::new(true),
            echo_ref: AtomicBool::new(false),
            echo_device: Mutex::new(None),
            ai: Arc::new(AiStatus::default()),
            hum_hz: AtomicF32::new(0.0),
            in_meter: Meter::default(),
            out_meter: Meter::default(),
            dsp_load: AtomicF32::new(0.0),
            frames: AtomicU64::new(0),
            state: Mutex::new(EngineState::Stopped),
            denoiser: Mutex::new(None),
            fell_back: AtomicBool::new(false),
            cable_active: AtomicBool::new(false),
            latency_ms: AtomicF32::new(0.0),
            test: Mutex::new(MicTest { state: TestState::Idle, raw: Vec::new(), clean: Vec::new() }),
            active_input: Mutex::new(None),
        }
    }

    pub fn levels(&self) -> Levels {
        Levels { input: self.in_meter.read(), output: self.out_meter.read() }
    }
}

enum Cmd {
    Monitor(bool),
    /// The default speakers changed: listen to the new ones for the echo reference.
    Speakers,
}

struct Running {
    stop: Arc<AtomicBool>,
    cmd: mpsc::Sender<Cmd>,
    thread: Option<JoinHandle<()>>,
    /// Whether a virtual cable existed when this run started.
    had_cable: bool,
}

impl Drop for Running {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(t) = self.thread.take() {
            t.thread().unpark();
            let _ = t.join();
        }
    }
}

pub struct Engine {
    pub shared: Arc<Shared>,
    running: Mutex<Option<Running>>,
    /// Input the user selected (None = system default). Survives restarts.
    wanted_input: Mutex<Option<String>>,
    /// True between start() and an explicit stop(): the watchdog keeps it alive.
    should_run: AtomicBool,
}

impl Engine {
    pub fn new() -> Arc<Self> {
        let engine = Arc::new(Self {
            shared: Arc::new(Shared::new()),
            running: Mutex::new(None),
            wanted_input: Mutex::new(None),
            should_run: AtomicBool::new(false),
        });
        Self::spawn_watchdog(Arc::downgrade(&engine));
        engine
    }

    pub fn start(&self, input_id: Option<String>) -> Result<()> {
        *self.wanted_input.lock() = input_id;
        self.should_run.store(true, Ordering::SeqCst);
        self.restart()
    }

    pub fn stop(&self) {
        self.should_run.store(false, Ordering::SeqCst);
        self.running.lock().take();
        self.reset_shared(EngineState::Stopped);
    }

    pub fn set_monitor(&self, on: bool) {
        self.shared.monitor_enabled.store(on, Ordering::Relaxed);
        if let Some(r) = self.running.lock().as_ref() {
            let _ = r.cmd.send(Cmd::Monitor(on));
        }
    }

    fn reset_shared(&self, state: EngineState) {
        *self.shared.state.lock() = state;
        self.shared.in_meter.reset();
        self.shared.out_meter.reset();
        self.shared.cable_active.store(false, Ordering::Relaxed);
        self.shared.dsp_load.store(0.0);
        *self.shared.active_input.lock() = None;
    }

    fn restart(&self) -> Result<()> {
        let mut running = self.running.lock();
        running.take(); // stops and joins the old DSP thread
        *self.shared.state.lock() = EngineState::Starting;

        let stop = Arc::new(AtomicBool::new(false));
        let (cmd_tx, cmd_rx) = mpsc::channel();
        let (ready_tx, ready_rx) = mpsc::channel::<Result<()>>();
        let shared = self.shared.clone();
        let input = self.wanted_input.lock().clone();
        let stop2 = stop.clone();
        let had_cable = devices::find_cable_playback().is_some();

        let thread = thread::Builder::new()
            .name("sanay-dsp".into())
            .spawn(move || dsp_thread(input, shared, stop2, cmd_rx, ready_tx))
            .context("spawn DSP thread")?;

        match ready_rx.recv_timeout(Duration::from_secs(5)) {
            Ok(Ok(())) => {
                *running = Some(Running { stop, cmd: cmd_tx, thread: Some(thread), had_cable });
                Ok(())
            }
            Ok(Err(e)) => {
                let _ = thread.join();
                *self.shared.state.lock() = EngineState::Error(format!("{e:#}"));
                Err(e)
            }
            Err(_) => {
                stop.store(true, Ordering::SeqCst);
                let e = anyhow!("audio device did not start in time");
                *self.shared.state.lock() = EngineState::Error(e.to_string());
                Err(e)
            }
        }
    }

    /// Keeps audio flowing as devices come and go:
    /// * mic unplugged → restart on the device's default mic (F10),
    /// * chosen headset plugged back in → switch back to it,
    /// * following the system default and Windows changes it → follow,
    /// * virtual cable installed mid-session → pick it up (F2).
    fn spawn_watchdog(engine: std::sync::Weak<Engine>) {
        thread::Builder::new()
            .name("sanay-watchdog".into())
            .spawn(move || loop {
                thread::sleep(Duration::from_secs(1));
                let Some(engine) = engine.upgrade() else { return };
                if !engine.should_run.load(Ordering::SeqCst) {
                    continue;
                }
                let state = engine.shared.state.lock().clone();
                let needs_restart = match state {
                    EngineState::DeviceLost | EngineState::Error(_) => devices::any_usable_input(),
                    EngineState::Running => {
                        let had_cable = engine.running.lock().as_ref().map(|r| r.had_cable).unwrap_or(true);
                        let active = engine.shared.active_input.lock().clone();
                        let wanted = engine.wanted_input.lock().clone();
                        let cable_appeared = !had_cable && devices::find_cable_playback().is_some();
                        let headset_back = match (&active, &wanted) {
                            (Some(a), Some(id)) => a.fallback && devices::exists(id),
                            _ => false,
                        };
                        let default_changed = wanted.is_none()
                            && active.as_ref().is_some_and(|a| a.id != devices::usable_default_id());
                        cable_appeared || headset_back || default_changed
                    }
                    _ => false,
                };
                if matches!(state, EngineState::Running) && !needs_restart {
                    let now = devices::default_output_id();
                    if *engine.shared.echo_device.lock() != now {
                        if let Some(r) = engine.running.lock().as_ref() {
                            let _ = r.cmd.send(Cmd::Speakers);
                        }
                    }
                }
                if needs_restart {
                    log::info!("watchdog: (re)starting engine from state {state:?}");
                    if let Err(e) = engine.restart() {
                        log::warn!("watchdog restart failed: {e:#}");
                    }
                }
            })
            .expect("spawn watchdog");
    }
}

// ───────────────────────────── DSP thread ─────────────────────────────

fn dsp_thread(
    input_id: Option<String>,
    shared: Arc<Shared>,
    stop: Arc<AtomicBool>,
    cmd_rx: mpsc::Receiver<Cmd>,
    ready: mpsc::Sender<Result<()>>,
) {
    let setup = (|| -> Result<Pipeline> {
        let (device, active) = devices::resolve_input(input_id.as_deref())?;
        let p = Pipeline::new(&device, &shared)?;
        log::info!("mic: {}{}", active.name, if active.fallback { " (fallback to default)" } else { "" });
        *shared.active_input.lock() = Some(active);
        Ok(p)
    })();
    let mut p = match setup {
        Ok(p) => {
            let _ = ready.send(Ok(()));
            p
        }
        Err(e) => {
            let _ = ready.send(Err(e));
            return;
        }
    };
    *shared.state.lock() = EngineState::Running;
    *shared.denoiser.lock() = Some(p.noise.kind());

    let mut last_input = Instant::now();
    let mut chunk = vec![0f32; p.in_chunk];
    let mut heavy_since: Option<Instant> = None;

    while !stop.load(Ordering::SeqCst) {
        while let Ok(cmd) = cmd_rx.try_recv() {
            match cmd {
                Cmd::Monitor(on) => p.set_monitor(on, &shared),
                Cmd::Speakers => p.far = Far::open(&shared),
            }
        }
        if p.lost.load(Ordering::Relaxed) || last_input.elapsed() > INPUT_STALL {
            log::warn!("audio device lost");
            *shared.state.lock() = EngineState::DeviceLost;
            shared.cable_active.store(false, Ordering::Relaxed);
            return;
        }
        if p.in_cons.occupied_len() < p.in_chunk {
            // Woken by the input callback; the timeout is only a safety net.
            thread::park_timeout(Duration::from_millis(20));
            continue;
        }
        last_input = Instant::now();
        p.in_cons.pop_slice(&mut chunk);
        p.feed(&chunk);
        if let Some(f) = &mut p.far {
            f.drain();
        }
        while p.pending.len() >= FRAME {
            p.process_frame(&shared);
        }

        // CPU fallback (spec §2.5): only matters once a heavier denoiser is in use.
        if p.noise.kind() != DenoiserKind::Rnnoise {
            if shared.dsp_load.load() > 0.9 {
                let since = *heavy_since.get_or_insert_with(Instant::now);
                if since.elapsed() > Duration::from_secs(3) {
                    log::warn!("DSP too slow for {:?}; falling back to RNNoise", p.noise.kind());
                    p.noise = NoiseStage::new(Box::new(Rnnoise::new()));
                    *shared.denoiser.lock() = Some(DenoiserKind::Rnnoise);
                    shared.fell_back.store(true, Ordering::Relaxed);
                    p.update_latency(&shared);
                }
            } else {
                heavy_since = None;
            }
        }
    }
}

struct Pipeline {
    _in_stream: cpal::Stream,
    in_cons: HeapCons<f32>,
    in_rate: u32,
    in_chunk: usize,
    in_resampler: Option<Async<f32>>,
    resample_buf: Vec<f32>,
    pending: Vec<f32>,
    noise: NoiseStage,
    hpf: HighPass,
    hum: HumRemover,
    voice: VoiceStage,
    ai: AiStage,
    expander: Expander,
    agc: Agc,
    limiter: Limiter,
    frame: [f32; FRAME],
    cable: Option<Sink>,
    monitor: Option<Sink>,
    lost: Arc<AtomicBool>,
    far: Option<Far>,
    aec: EchoCanceller,
    far_frame: [f32; FRAME],
    aec_on: bool,
}

impl Pipeline {
    fn new(device: &cpal::Device, shared: &Arc<Shared>) -> Result<Self> {
        let lost = Arc::new(AtomicBool::new(false));
        let cfg = device.default_input_config().context("query mic format")?;
        let in_rate = cfg.sample_rate();
        let channels = cfg.channels() as usize;
        // 10 ms of input per DSP step.
        let in_chunk = (in_rate as usize / 100).max(1);

        let rb = HeapRb::<f32>::new(in_rate as usize / 2); // 500 ms headroom
        let (prod, in_cons) = rb.split();
        let waker = thread::current();
        let in_stream = build_input(device, cfg.sample_format(), cfg.config(), channels, prod, waker, lost.clone())?;
        in_stream.play().context("start mic")?;

        let in_resampler = if in_rate == SAMPLE_RATE {
            None
        } else {
            Some(
                Async::<f32>::new_poly(
                    SAMPLE_RATE as f64 / in_rate as f64,
                    1.0,
                    PolynomialDegree::Septic,
                    in_chunk,
                    1,
                    FixedAsync::Input,
                )
                .context("create input resampler")?,
            )
        };
        let resample_buf = vec![0.0; in_resampler.as_ref().map(|r| r.output_frames_max()).unwrap_or(0)];

        let cable = match devices::find_cable_playback() {
            Some(d) => match Sink::new(&d, lost.clone()) {
                Ok(s) => Some(s),
                Err(e) => {
                    log::warn!("virtual cable present but unusable: {e:#}");
                    None
                }
            },
            None => None,
        };
        shared.cable_active.store(cable.is_some(), Ordering::Relaxed);

        let mut p = Self {
            _in_stream: in_stream,
            in_cons,
            in_rate,
            in_chunk,
            in_resampler,
            resample_buf,
            pending: Vec::with_capacity(FRAME * 4),
            noise: new_default_noise_stage(),
            hpf: HighPass::new(80.0, SAMPLE_RATE as f32),
            hum: HumRemover::new(SAMPLE_RATE),
            voice: VoiceStage::new(SAMPLE_RATE, FRAME),
            ai: AiStage::new(),
            expander: Expander::new(),
            agc: Agc::new(),
            limiter: Limiter::new(-1.0, 60.0, SAMPLE_RATE as f32),
            frame: [0.0; FRAME],
            cable,
            monitor: None,
            lost,
            far: Far::open(shared),
            aec: EchoCanceller::new(),
            far_frame: [0.0; FRAME],
            aec_on: false,
        };
        if shared.monitor_enabled.load(Ordering::Relaxed) {
            p.set_monitor(true, shared);
        }
        p.update_latency(shared);
        log::info!(
            "engine started: mic {} Hz x{}ch, cable {}",
            p.in_rate,
            channels,
            if p.cable.is_some() { "connected" } else { "missing" }
        );
        Ok(p)
    }

    fn set_monitor(&mut self, on: bool, shared: &Arc<Shared>) {
        self.monitor = if on {
            match devices::default_output().and_then(|d| Sink::new(&d, Arc::new(AtomicBool::new(false)))) {
                Ok(s) => Some(s),
                Err(e) => {
                    log::warn!("monitor unavailable: {e:#}");
                    None
                }
            }
        } else {
            None
        };
        self.update_latency(shared);
    }

    /// Rough added-latency estimate: input chunking + denoiser + output buffering.
    fn update_latency(&self, shared: &Shared) {
        let ms = 10.0 // one input chunk
            + self.noise.latency_samples() as f32 * 1000.0 / SAMPLE_RATE as f32
            + OUTPUT_TARGET_MS
            + self.voice.latency_samples() as f32 * 1000.0 / SAMPLE_RATE as f32 // 0 when not shifting
            + if self.aec_on { aec::LATENCY_SAMPLES as f32 * 1000.0 / SAMPLE_RATE as f32 } else { 0.0 };
        shared.latency_ms.store(ms);
    }

    fn feed(&mut self, chunk: &[f32]) {
        match &mut self.in_resampler {
            None => self.pending.extend_from_slice(chunk),
            Some(r) => {
                let inp = InterleavedSlice::new(chunk, 1, chunk.len()).expect("input adapter");
                let cap = self.resample_buf.len();
                let mut out = InterleavedSlice::new_mut(&mut self.resample_buf, 1, cap).expect("output adapter");
                match r.process_into_buffer(&inp, &mut out, None) {
                    Ok((_, n)) => self.pending.extend_from_slice(&self.resample_buf[..n]),
                    Err(e) => log::error!("input resample: {e}"),
                }
            }
        }
    }

    fn process_frame(&mut self, shared: &Shared) {
        let t0 = Instant::now();
        self.frame.copy_from_slice(&self.pending[..FRAME]);
        self.pending.drain(..FRAME);

        shared.in_meter.update(dsp::measure(&self.frame));
        let raw = self.frame;

        // Echo first: the canceller needs the mic exactly as recorded (linear), and nothing of the
        // other person may reach the voice model, which would turn it into Sanay's voice.
        // Not while monitoring: then the speakers play your own voice, which must not be removed.
        let aec_on = shared.echo_cancel.load(Ordering::Relaxed) && self.monitor.is_none() && self.far.is_some();
        if aec_on != self.aec_on {
            self.aec_on = aec_on;
            self.update_latency(shared);
        }
        if let Some(f) = &mut self.far {
            f.refs.next(&mut self.far_frame); // keep the reference moving even when bypassed
            if aec_on {
                self.aec.process(&mut self.frame, &self.far_frame);
            }
        }

        let nc = shared.nc_enabled.load(Ordering::Relaxed);
        let strength = Strength::from_u8(shared.strength.load(Ordering::Relaxed));
        // Hum/rumble first, so the denoiser works on a cleaner signal.
        if nc {
            self.hum.process(&mut self.frame);
        }
        shared.hum_hz.store(if nc { self.hum.mains().unwrap_or(0.0) } else { 0.0 });
        self.noise.process(&mut self.frame, nc, strength);
        self.hpf.process(&mut self.frame);
        let voice_lat = self.voice.latency_samples();
        let voice = VoiceType::from_u8(shared.voice_type.load(Ordering::Relaxed));
        // AI voice when it is live; otherwise (natural voice, AI off or still starting) the DSP voice.
        if !self.ai.process(&mut self.frame, voice, shared.ai_enabled.load(Ordering::Relaxed), &shared.ai) {
            self.voice.process(&mut self.frame, voice, shared.voice_amount.load(), shared.clarity.load(Ordering::Relaxed));
        }
        // Pause cleanup: deeper with stronger NC.
        let depth = if !nc {
            0.0
        } else {
            match strength {
                Strength::Light => 6.0,
                Strength::Normal => 12.0,
                Strength::Strong => 18.0,
            }
        };
        self.expander.process(&mut self.frame, depth);
        self.agc.process(&mut self.frame);
        self.limiter.process(&mut self.frame);

        if self.voice.latency_samples() != voice_lat {
            self.update_latency(shared);
        }
        // Master switch (floating pill). Off = the untouched mic. Everything above keeps running,
        // so the denoiser and the AI voice stay warm and switching back on is instant.
        if !shared.active.load(Ordering::Relaxed) {
            self.frame = raw;
        }
        shared.out_meter.update(dsp::measure(&self.frame));

        // Mic test capture (in memory only, F7). try_lock: never stall audio for the UI.
        if let Some(mut t) = shared.test.try_lock() {
            if t.state == TestState::Recording {
                let max = MIC_TEST_SECONDS * SAMPLE_RATE as usize;
                if t.raw.len() < max {
                    t.raw.extend_from_slice(&raw);
                    t.clean.extend_from_slice(&self.frame);
                }
            }
        }

        if let Some(s) = &mut self.cable {
            s.push(&self.frame);
        }
        if let Some(s) = &mut self.monitor {
            s.push(&self.frame);
        }

        let load = t0.elapsed().as_secs_f32() / 0.010;
        let prev = shared.dsp_load.load();
        shared.dsp_load.store(prev + 0.05 * (load - prev));
        shared.frames.fetch_add(1, Ordering::Relaxed);
    }
}

/// What the speakers play (WASAPI loopback of the default output), as the echo reference.
struct Far {
    _stream: cpal::Stream,
    cons: HeapCons<f32>,
    chunk: usize,
    resampler: Option<Async<f32>>,
    buf: Vec<f32>,
    out: Vec<f32>,
    refs: RefBuffer,
}

impl Far {
    /// None when there is nothing safe to listen to (no speakers, or the speakers are the virtual
    /// cable itself: that would be Sanay's own voice).
    fn open(shared: &Shared) -> Option<Self> {
        let r = (|| -> Result<Option<Self>> {
            let device = devices::default_output()?;
            let name = devices::device_name(&device);
            *shared.echo_device.lock() = devices::default_output_id();
            if devices::is_cable_playback(&name) {
                return Ok(None);
            }
            let cfg = device.default_output_config().context("query speaker format")?;
            let rate = cfg.sample_rate();
            let channels = cfg.channels() as usize;
            let (prod, cons) = HeapRb::<f32>::new(rate as usize / 2).split();
            // Loopback packets wake the DSP thread too; harmless, it just finds no new mic audio.
            let stream = build_input(&device, cfg.sample_format(), cfg.config(), channels, prod, thread::current(), Arc::new(AtomicBool::new(false)))
                .context("listen to speakers")?;
            stream.play().context("start speaker loopback")?;
            let chunk = (rate as usize / 100).max(1);
            let resampler = if rate == SAMPLE_RATE {
                None
            } else {
                Some(Async::<f32>::new_poly(SAMPLE_RATE as f64 / rate as f64, 1.0, PolynomialDegree::Septic, chunk, 1, FixedAsync::Input)?)
            };
            let out = vec![0.0; resampler.as_ref().map(|r| r.output_frames_max()).unwrap_or(0)];
            log::info!("echo reference: {name} ({rate} Hz x{channels}ch)");
            Ok(Some(Self { _stream: stream, cons, chunk, resampler, buf: vec![0.0; chunk], out, refs: RefBuffer::new() }))
        })();
        let far = match r {
            Ok(f) => f,
            Err(e) => {
                log::warn!("echo cancellation unavailable: {e:#}");
                None
            }
        };
        shared.echo_ref.store(far.is_some(), Ordering::Relaxed);
        far
    }

    /// Moves everything the speakers played since the last call into the reference buffer.
    fn drain(&mut self) {
        while self.cons.occupied_len() >= self.chunk {
            self.cons.pop_slice(&mut self.buf);
            match &mut self.resampler {
                None => self.refs.push(&self.buf),
                Some(r) => {
                    let inp = InterleavedSlice::new(&self.buf[..], 1, self.chunk).expect("input adapter");
                    let cap = self.out.len();
                    let mut out = InterleavedSlice::new_mut(&mut self.out, 1, cap).expect("output adapter");
                    if let Ok((_, n)) = r.process_into_buffer(&inp, &mut out, None) {
                        self.refs.push(&self.out[..n]);
                    }
                }
            }
        }
    }
}

fn new_default_noise_stage() -> NoiseStage {
    // TODO(week 3): prefer DeepFilterNet3 when built with `--features deepfilter`.
    NoiseStage::new(Box::new(Rnnoise::new()))
}

/// One output device fed from the DSP thread through its own ring + drift-trimmed resampler.
struct Sink {
    _stream: cpal::Stream,
    prod: HeapProd<f32>,
    resampler: Async<f32>,
    out_buf: Vec<f32>,
    target: f64,
    fill_avg: f64,
}

impl Sink {
    fn new(device: &cpal::Device, lost: Arc<AtomicBool>) -> Result<Self> {
        let cfg = device.default_output_config().context("query output format")?;
        let rate = cfg.sample_rate();
        let channels = cfg.channels() as usize;
        let target = (rate as f32 * OUTPUT_TARGET_MS / 1000.0) as usize;

        let rb = HeapRb::<f32>::new(rate as usize / 4);
        let (mut prod, cons) = rb.split();
        // Pre-fill so the device doesn't start with an underrun.
        prod.push_iter(std::iter::repeat_n(0.0, target));

        let stream = build_output(device, cfg.sample_format(), cfg.config(), channels, cons, lost)?;
        stream.play().context("start output")?;

        let resampler = Async::<f32>::new_poly(
            rate as f64 / SAMPLE_RATE as f64,
            1.01, // room for ±1% drift correction
            PolynomialDegree::Septic,
            FRAME,
            1,
            FixedAsync::Input,
        )
        .context("create output resampler")?;
        let out_buf = vec![0.0; resampler.output_frames_max()];
        Ok(Self { _stream: stream, prod, resampler, out_buf, target: target as f64, fill_avg: target as f64 })
    }

    fn push(&mut self, frame: &[f32; FRAME]) {
        // Clock-drift trim: proportional control on the smoothed ring fill.
        self.fill_avg += 0.01 * (self.prod.occupied_len() as f64 - self.fill_avg);
        let err = ((self.fill_avg - self.target) / self.target).clamp(-1.0, 1.0);
        if let Some(adj) = self.resampler.as_adjustable() {
            let _ = adj.set_resample_ratio_relative(1.0 - 0.002 * err, true);
        }

        let inp = InterleavedSlice::new(&frame[..], 1, FRAME).expect("input adapter");
        let cap = self.out_buf.len();
        let mut out = InterleavedSlice::new_mut(&mut self.out_buf, 1, cap).expect("output adapter");
        match self.resampler.process_into_buffer(&inp, &mut out, None) {
            Ok((_, n)) => {
                // If the ring is full (device stalled), dropping is better than blocking.
                self.prod.push_slice(&self.out_buf[..n]);
            }
            Err(e) => log::error!("output resample: {e}"),
        }
    }
}

// ───────────────────────────── cpal glue ─────────────────────────────

fn is_fatal(e: &cpal::Error) -> bool {
    matches!(e.kind(), cpal::ErrorKind::DeviceNotAvailable | cpal::ErrorKind::StreamInvalidated)
}

macro_rules! dispatch_format {
    ($fmt:expr, $f:ident, $($arg:expr),*) => {
        match $fmt {
            SampleFormat::F32 => $f::<f32>($($arg),*),
            SampleFormat::I16 => $f::<i16>($($arg),*),
            SampleFormat::I32 => $f::<i32>($($arg),*),
            SampleFormat::U16 => $f::<u16>($($arg),*),
            SampleFormat::U8 => $f::<u8>($($arg),*),
            SampleFormat::F64 => $f::<f64>($($arg),*),
            other => Err(anyhow!("unsupported sample format {other}")),
        }
    };
}

fn build_input(
    device: &cpal::Device,
    fmt: SampleFormat,
    config: cpal::StreamConfig,
    channels: usize,
    prod: HeapProd<f32>,
    waker: thread::Thread,
    lost: Arc<AtomicBool>,
) -> Result<cpal::Stream> {
    dispatch_format!(fmt, build_input_typed, device, config, channels, prod, waker, lost)
}

fn build_input_typed<T>(
    device: &cpal::Device,
    config: cpal::StreamConfig,
    channels: usize,
    mut prod: HeapProd<f32>,
    waker: thread::Thread,
    lost: Arc<AtomicBool>,
) -> Result<cpal::Stream>
where
    T: SizedSample + Send + 'static,
    f32: FromSample<T>,
{
    let inv = 1.0 / channels as f32;
    let stream = device.build_input_stream::<T, _, _>(
        config,
        move |data: &[T], _| {
            // Downmix to mono (step 2). No allocation, no locks.
            prod.push_iter(
                data.chunks_exact(channels)
                    .map(|f| f.iter().map(|&s| f32::from_sample(s)).sum::<f32>() * inv),
            );
            waker.unpark();
        },
        move |e| {
            log::warn!("input stream error: {e}");
            if is_fatal(&e) {
                lost.store(true, Ordering::Relaxed);
            }
        },
        None,
    )?;
    Ok(stream)
}

fn build_output(
    device: &cpal::Device,
    fmt: SampleFormat,
    config: cpal::StreamConfig,
    channels: usize,
    cons: HeapCons<f32>,
    lost: Arc<AtomicBool>,
) -> Result<cpal::Stream> {
    dispatch_format!(fmt, build_output_typed, device, config, channels, cons, lost)
}

fn build_output_typed<T>(
    device: &cpal::Device,
    config: cpal::StreamConfig,
    channels: usize,
    mut cons: HeapCons<f32>,
    lost: Arc<AtomicBool>,
) -> Result<cpal::Stream>
where
    T: SizedSample + FromSample<f32> + Send + 'static,
{
    let stream = device.build_output_stream::<T, _, _>(
        config,
        move |data: &mut [T], _| {
            for frame in data.chunks_exact_mut(channels) {
                // Underrun ⇒ silence rather than garbage.
                let v = T::from_sample(cons.try_pop().unwrap_or(0.0));
                frame.fill(v);
            }
        },
        move |e| {
            log::warn!("output stream error: {e}");
            if is_fatal(&e) {
                lost.store(true, Ordering::Relaxed);
            }
        },
        None,
    )?;
    Ok(stream)
}

// ───────────────────────────── mic test playback ─────────────────────────────

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TestVariant {
    Raw,
    Clean,
}

/// Plays a recorded test clip on the default output device. Blocks until done.
pub fn play_clip(samples: Vec<f32>) -> Result<()> {
    let device = devices::default_output()?;
    let cfg = device.default_output_config()?;
    let rate = cfg.sample_rate();
    let channels = cfg.channels() as usize;

    let data = if rate == SAMPLE_RATE {
        samples
    } else {
        let mut r = Async::<f32>::new_poly(
            rate as f64 / SAMPLE_RATE as f64,
            1.0,
            PolynomialDegree::Septic,
            1024,
            1,
            FixedAsync::Input,
        )?;
        let inp = InterleavedSlice::new(&samples[..], 1, samples.len())?;
        let out = r.process_all(&inp, samples.len(), None)?;
        out.take_data()
    };

    let secs = data.len() as f32 / rate as f32;
    let rb = HeapRb::<f32>::new(data.len() + 1);
    let (mut prod, cons) = rb.split();
    prod.push_slice(&data);
    let stream = build_output(&device, cfg.sample_format(), cfg.config(), channels, cons, Arc::new(AtomicBool::new(false)))?;
    stream.play()?;
    thread::sleep(Duration::from_secs_f32(secs + 0.2));
    Ok(())
}
