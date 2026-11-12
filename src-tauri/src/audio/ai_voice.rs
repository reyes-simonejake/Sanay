//! AI voice (personal testing build): the Masculine / Feminine presets rendered by the trained
//! voice model instead of the DSP pitch shifter in `voice.rs`.
//!
//! The model runs in a local voice server (`D:\dev\SanayAI\scripts\sanay_voice_server.py`,
//! GPU, 127.0.0.1 only). This stage resamples the cleaned mic audio to 16 kHz and streams it to the
//! server in 100 ms blocks on a worker thread; the converted voice (40 kHz) comes back block by
//! block, is resampled to 48 kHz and played out of a small jitter buffer. The DSP thread never
//! waits on the network: it only touches two lock-free rings.
//!
//! While the server is starting (or missing) the caller falls back to the DSP voice, so the user
//! is never silent. Mic-to-output delay with the AI voice: ~400 ms (200 ms blocks + GPU time + jitter cushion).
//!
//! TEST ONLY: the server's voices are fine-tuned from RVC weights with a "research use only"
//! clause. Never ship this stage enabled in a release without licence clearance.

use super::dsp::{FRAME, SAMPLE_RATE};
use super::meters::AtomicF32;
use super::voice::VoiceType;
use ringbuf::traits::{Consumer, Observer, Producer, Split};
use ringbuf::{HeapCons, HeapProd, HeapRb};
use rubato::audioadapter_buffers::direct::InterleavedSlice;
use rubato::{Async, FixedAsync, Resampler, SincInterpolationParameters, WindowFunction};
use serde::Serialize;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicU8, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

const PORT: u16 = 47820;

/// Server port; SANAY_AI_PORT overrides it (tests use a fake server on another port).
fn port() -> u16 {
    std::env::var("SANAY_AI_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(PORT)
}
/// 200 ms: the laptop GPU needs ~90-110 ms per block, so 100 ms blocks left no headroom (glitches).
const BLOCK_MS: u32 = 200;
const AI_RATE: u32 = 16_000;
const OUT_RATE: u32 = 40_000;
/// Silence put in front of the first block: absorbs the server's compute-time jitter.
const SLACK_MS: u32 = 60;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AiState {
    Off,
    /// Connecting to (or starting) the voice server; the DSP voice is used meanwhile.
    Starting,
    Live,
    /// The server refused (e.g. that voice isn't trained yet); see `message`.
    Unavailable,
}

impl AiState {
    fn from_u8(v: u8) -> Self {
        match v {
            1 => AiState::Starting,
            2 => AiState::Live,
            3 => AiState::Unavailable,
            _ => AiState::Off,
        }
    }
}

/// Shared with the UI (via `Shared`).
pub struct AiStatus {
    state: AtomicU8,
    /// Which worker owns the status: a stopped worker finishing late must not overwrite it.
    generation: AtomicU64,
    /// Round trip per block (send + model + receive), smoothed.
    pub compute_ms: AtomicF32,
    pub underruns: AtomicU64,
    pub message: Mutex<String>,
}

impl Default for AiStatus {
    fn default() -> Self {
        Self { state: AtomicU8::new(0), generation: AtomicU64::new(0), compute_ms: AtomicF32::new(0.0), underruns: AtomicU64::new(0), message: Mutex::new(String::new()) }
    }
}

impl AiStatus {
    pub fn state(&self) -> AiState {
        AiState::from_u8(self.state.load(Ordering::Relaxed))
    }
    /// Hand the status to a new worker (or to nobody, when turning off).
    fn claim(&self, s: AiState, msg: &str) -> u64 {
        let g = self.generation.fetch_add(1, Ordering::SeqCst) + 1;
        self.set(g, s, msg);
        g
    }
    fn set(&self, gen: u64, s: AiState, msg: &str) {
        let _guard = self.message.lock();
        if self.generation.load(Ordering::SeqCst) != gen {
            return;
        }
        self.state.store(s as u8, Ordering::Relaxed);
        if let Ok(mut m) = _guard {
            if *m != msg {
                *m = msg.to_string();
            }
        }
    }
    /// Mic-to-output delay added by the AI voice: model buffering + round trip + jitter buffer.
    pub fn latency_ms(&self) -> f32 {
        // block + crossfade (50 ms) + SOLA search (10 ms), see scripts/rvc_stream.py
        (BLOCK_MS + 60 + SLACK_MS) as f32 + self.compute_ms.load()
    }
}

fn sinc(ratio: f64, chunk: usize) -> Async<f32> {
    Async::<f32>::new_sinc(ratio, 1.0, &SincInterpolationParameters::new(128, WindowFunction::Blackman2), chunk, 1, FixedAsync::Input)
        .expect("create AI resampler")
}

fn resample(r: &mut Async<f32>, input: &[f32], buf: &mut Vec<f32>) -> usize {
    let inp = InterleavedSlice::new(input, 1, input.len()).expect("input adapter");
    let cap = buf.len();
    let mut out = InterleavedSlice::new_mut(buf, 1, cap).expect("output adapter");
    match r.process_into_buffer(&inp, &mut out, None) {
        Ok((_, n)) => n,
        Err(e) => {
            log::error!("AI resample: {e}");
            0
        }
    }
}

struct Worker {
    voice: VoiceType,
    stop: Arc<AtomicBool>,
    to_net: HeapProd<f32>,
    from_net: HeapCons<f32>,
    _thread: JoinHandle<()>,
}

impl Drop for Worker {
    fn drop(&mut self) {
        // The thread notices within a few ms and closes the connection; never join on the DSP thread.
        self.stop.store(true, Ordering::Relaxed);
    }
}

/// Lives in the DSP pipeline.
pub struct AiStage {
    worker: Option<Worker>,
    down: Async<f32>,
    down_buf: Vec<f32>,
    /// Playing the AI voice (false while the jitter cushion refills after a late block).
    playing: bool,
}

impl AiStage {
    pub fn new() -> Self {
        let down = sinc(AI_RATE as f64 / SAMPLE_RATE as f64, FRAME);
        let down_buf = vec![0.0; down.output_frames_max()];
        Self { worker: None, down, down_buf, playing: false }
    }

    /// Replaces `frame` with the AI voice and returns true, or returns false (frame untouched)
    /// when the AI voice isn't wanted or isn't live yet, so the caller applies the DSP voice.
    pub fn process(&mut self, frame: &mut [f32; FRAME], voice: VoiceType, enabled: bool, st: &Arc<AiStatus>) -> bool {
        if !enabled || voice == VoiceType::Natural {
            if self.worker.take().is_some() || st.state() != AiState::Off {
                st.claim(AiState::Off, "");
            }
            return false;
        }
        if self.worker.as_ref().map(|w| w.voice) != Some(voice) {
            let gen = st.claim(AiState::Starting, "Starting the AI voice…");
            self.worker = Some(spawn_worker(voice, gen, st.clone()));
            self.playing = false;
        }
        let n = resample(&mut self.down, &frame[..], &mut self.down_buf);
        let w = self.worker.as_mut().expect("worker");
        w.to_net.push_slice(&self.down_buf[..n]); // full ring (server stalled): drop, never block

        if st.state() != AiState::Live {
            self.playing = false;
            return false;
        }
        let block = (SAMPLE_RATE * BLOCK_MS / 1000) as usize;
        let slack = (SAMPLE_RATE * SLACK_MS / 1000) as usize;
        let mut have = w.from_net.occupied_len();
        if have > 2 * block + 2 * slack {
            // Late blocks piled up (e.g. after a hiccup): drop the oldest to keep the delay low.
            w.from_net.skip(have - block - slack);
            have = w.from_net.occupied_len();
        }
        let fade = FRAME / 2; // 5 ms: short enough to hide, long enough to never click
        if !self.playing {
            // (Re)start only with a cushion, so one slow block doesn't cut the voice again.
            if have < FRAME + slack {
                frame.fill(0.0);
                return true;
            }
            w.from_net.pop_slice(&mut frame[..]);
            for (i, v) in frame[..fade].iter_mut().enumerate() {
                *v *= i as f32 / fade as f32;
            }
            self.playing = true;
        } else if have >= FRAME {
            w.from_net.pop_slice(&mut frame[..]);
        } else {
            // The next block is late: play what's left fading out (a hard cut clicks), then wait
            // for the cushion to fill again. Silence, never a switch to the other voice.
            let n = w.from_net.pop_slice(&mut frame[..have]);
            for (i, v) in frame[..n].iter_mut().enumerate() {
                *v *= 1.0 - i as f32 / n as f32;
            }
            frame[n..].fill(0.0);
            self.playing = false;
            st.underruns.fetch_add(1, Ordering::Relaxed);
        }
        true
    }
}

fn spawn_worker(voice: VoiceType, gen: u64, st: Arc<AiStatus>) -> Worker {
    let stop = Arc::new(AtomicBool::new(false));
    let (to_net, net_in) = HeapRb::<f32>::new(AI_RATE as usize).split(); // 1 s
    let (net_out, from_net) = HeapRb::<f32>::new(SAMPLE_RATE as usize).split();
    let s2 = stop.clone();
    let thread = thread::Builder::new()
        .name("sanay-ai-voice".into())
        .spawn(move || worker(voice, gen, s2, net_in, net_out, st))
        .expect("spawn AI worker");
    Worker { voice, stop, to_net, from_net, _thread: thread }
}

fn worker(voice: VoiceType, gen: u64, stop: Arc<AtomicBool>, mut net_in: HeapCons<f32>, mut net_out: HeapProd<f32>, st: Arc<AiStatus>) {
    let name = if voice == VoiceType::Feminine { "feminine" } else { "masculine" };
    let mut spawned_at: Option<Instant> = None;
    // Connections that dropped before the voice ever went live (e.g. the GPU ran out of memory).
    let mut failed = 0u32;
    while !stop.load(Ordering::Relaxed) {
        match session(name, gen, &stop, &mut net_in, &mut net_out, &st) {
            Ok(()) => break, // stopped by the engine
            Err(SessionError::Refused(msg)) => {
                log::warn!("AI voice unavailable: {msg}");
                st.set(gen, AiState::Unavailable, &msg);
                // Wait (e.g. for training to save the voice), then try again.
                for _ in 0..100 {
                    if stop.load(Ordering::Relaxed) {
                        return;
                    }
                    thread::sleep(Duration::from_millis(100));
                }
            }
            Err(SessionError::NoServer) => {
                // Loading the models takes ~30 s; a second server would only find the port taken.
                if spawned_at.map_or(true, |t| t.elapsed() > Duration::from_secs(45)) {
                    spawned_at = Some(Instant::now());
                    match start_server() {
                        Ok(()) => st.set(gen, AiState::Starting, "Loading the voice model…"),
                        Err(e) => {
                            log::warn!("could not start the voice server: {e}");
                            st.set(gen, AiState::Unavailable, &format!("Voice server not found: {e}"));
                        }
                    }
                }
                thread::sleep(Duration::from_millis(500));
            }
            Err(SessionError::Lost(e)) => {
                log::warn!("AI voice connection lost: {e}");
                // Dropped mid-call: just reconnect. Dropped before ever working, again and again:
                // the server is broken (it restarts itself on GPU errors), so stop saying
                // "starting" forever, show the basic voice is in use, and retry less often.
                failed = if st.state() == AiState::Live { 0 } else { failed + 1 };
                if failed >= 3 {
                    st.set(gen, AiState::Unavailable, "The AI voice could not start (the graphics card may be out of memory).");
                    thread::sleep(Duration::from_secs(3));
                } else {
                    st.set(gen, AiState::Starting, "Reconnecting the AI voice…");
                    thread::sleep(Duration::from_millis(300));
                }
            }
        }
    }
    if st.state() != AiState::Unavailable {
        st.set(gen, AiState::Off, ""); // no-op if a newer worker owns the status
    }
}

enum SessionError {
    NoServer,
    Refused(String),
    Lost(std::io::Error),
}

impl From<std::io::Error> for SessionError {
    fn from(e: std::io::Error) -> Self {
        SessionError::Lost(e)
    }
}

fn session(voice: &str, gen: u64, stop: &AtomicBool, net_in: &mut HeapCons<f32>, net_out: &mut HeapProd<f32>, st: &AiStatus) -> Result<(), SessionError> {
    let addr = SocketAddr::from(([127, 0, 0, 1], port()));
    let sock = TcpStream::connect_timeout(&addr, Duration::from_millis(300)).map_err(|_| SessionError::NoServer)?;
    sock.set_nodelay(true)?;
    sock.set_read_timeout(Some(Duration::from_secs(20)))?; // first block includes GPU warm-up
    let mut tx = sock.try_clone()?;
    let mut rx = BufReader::new(sock);
    writeln!(tx, "{{\"voice\":\"{voice}\",\"block_ms\":{BLOCK_MS}}}")?;
    let mut line = String::new();
    rx.read_line(&mut line)?;
    let hello: serde_json::Value = serde_json::from_str(&line).map_err(|e| SessionError::Refused(format!("bad reply: {e}")))?;
    if hello["ok"] != true {
        return Err(SessionError::Refused(hello["error"].as_str().unwrap_or("refused").to_string()));
    }
    let n_in = hello["in_samples"].as_u64().unwrap_or(0) as usize;
    let n_out = hello["out_samples"].as_u64().unwrap_or(0) as usize;
    if n_in == 0 || n_out == 0 || hello["out_rate"].as_u64() != Some(OUT_RATE as u64) {
        return Err(SessionError::Refused(format!("unexpected server format: {line}")));
    }
    let mut up = sinc(SAMPLE_RATE as f64 / OUT_RATE as f64, n_out);
    let mut up_buf = vec![0.0; up.output_frames_max()];
    let mut block = vec![0f32; n_in];
    let mut out = vec![0f32; n_out];
    let mut bytes_in = vec![0u8; n_in * 4];
    let mut bytes_out = vec![0u8; n_out * 4];

    net_in.clear(); // audio queued while connecting would only add delay
    let mut first = true;
    log::info!("AI voice live: {voice}");
    while !stop.load(Ordering::Relaxed) {
        if net_in.occupied_len() < n_in {
            thread::sleep(Duration::from_millis(2));
            continue;
        }
        let backlog = net_in.occupied_len();
        if backlog > 3 * n_in {
            net_in.skip(backlog - n_in); // fell behind: keep only the newest block
        }
        net_in.pop_slice(&mut block);
        for (b, v) in bytes_in.chunks_exact_mut(4).zip(&block) {
            b.copy_from_slice(&v.to_le_bytes());
        }
        let t0 = Instant::now();
        tx.write_all(&bytes_in)?;
        rx.read_exact(&mut bytes_out)?;
        let ms = t0.elapsed().as_secs_f32() * 1000.0;
        if first {
            rx.get_ref().set_read_timeout(Some(Duration::from_secs(2)))?;
            net_out.push_iter(std::iter::repeat_n(0.0, (SAMPLE_RATE * SLACK_MS / 1000) as usize));
            st.compute_ms.store(ms.min(200.0));
            st.set(gen, AiState::Live, "");
            first = false;
        } else {
            let prev = st.compute_ms.load();
            st.compute_ms.store(prev + 0.05 * (ms - prev));
        }
        for (v, b) in out.iter_mut().zip(bytes_out.chunks_exact(4)) {
            *v = f32::from_le_bytes([b[0], b[1], b[2], b[3]]);
        }
        let n = resample(&mut up, &out, &mut up_buf);
        net_out.push_slice(&up_buf[..n]);
    }
    Ok(())
}

/// Where the personal-build voice server lives: SANAY_AI_ROOT, else D:\dev\SanayAI.
/// The server was set up before the rename, so the old LINAW_AI_ROOT / D:\dev\LinawAI still work.
fn ai_root() -> PathBuf {
    if let Some(p) = std::env::var_os("SANAY_AI_ROOT").or_else(|| std::env::var_os("LINAW_AI_ROOT")) {
        return PathBuf::from(p);
    }
    let new = PathBuf::from(r"D:\dev\SanayAI");
    if new.exists() { new } else { PathBuf::from(r"D:\dev\LinawAI") }
}

/// The server script: scripts\sanay_voice_server.py, or the pre-rename linaw_voice_server.py.
fn server_script(root: &std::path::Path) -> PathBuf {
    let scripts = root.join("scripts");
    let new = scripts.join("sanay_voice_server.py");
    if new.exists() { new } else { scripts.join("linaw_voice_server.py") }
}

fn start_server() -> std::io::Result<()> {
    if std::env::var_os("SANAY_AI_NO_SPAWN").is_some() {
        return Err(std::io::Error::new(std::io::ErrorKind::Other, "spawning disabled"));
    }
    let root = ai_root();
    let python = root.join("tts").join("Scripts").join("python.exe");
    let script = server_script(&root);
    if !python.exists() || !script.exists() {
        return Err(std::io::Error::new(std::io::ErrorKind::NotFound, format!("{}", script.display())));
    }
    let log = std::fs::File::create(root.join("runs").join("voice_server.log"))?;
    let mut cmd = std::process::Command::new(python);
    cmd.arg("-W").arg("ignore").arg(&script).arg("--port").arg(port().to_string())
        .current_dir(&root)
        .env("TORCH_HOME", root.join("torch"))
        .env("PYTHONIOENCODING", "utf-8")
        .stdin(std::process::Stdio::null())
        .stdout(log.try_clone()?)
        .stderr(log);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    cmd.spawn()?; // runs on its own; exits after 15 idle minutes
    log::info!("started the AI voice server from {}", root.display());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;

    /// Fake voice server: answers each 1600-sample block with 4000 samples of a continuous
    /// 200 Hz sine at 40 kHz after `delay`, so gaps or glitches show up in the 48 kHz output.
    fn fake_server(delay: Duration) -> u16 {
        let l = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = l.local_addr().unwrap().port();
        thread::spawn(move || {
            for c in l.incoming() {
                let c = c.unwrap();
                thread::spawn(move || {
                    let mut tx = c.try_clone().unwrap();
                    let mut rx = BufReader::new(c);
                    let mut line = String::new();
                    rx.read_line(&mut line).unwrap();
                    let v = if line.contains("feminine") { "feminine" } else { "masculine" };
                    writeln!(tx, "{{\"ok\":true,\"in_samples\":1600,\"out_samples\":4000,\"out_rate\":40000,\"voice\":\"{v}\"}}").unwrap();
                    let mut inb = vec![0u8; 1600 * 4];
                    let mut phase = 0f64;
                    while rx.read_exact(&mut inb).is_ok() {
                        thread::sleep(delay);
                        let mut out = Vec::with_capacity(16000);
                        for _ in 0..4000 {
                            out.extend_from_slice(&((phase.sin() * 0.5) as f32).to_le_bytes());
                            phase += 2.0 * std::f64::consts::PI * 200.0 / 40000.0;
                        }
                        if tx.write_all(&out).is_err() {
                            break;
                        }
                    }
                });
            }
        });
        port
    }

    #[test]
    fn streams_continuously_and_falls_back_until_live() {
        let port = fake_server(Duration::from_millis(55)); // like the measured GPU compute
        std::env::set_var("SANAY_AI_PORT", port.to_string());
        std::env::set_var("SANAY_AI_NO_SPAWN", "1");
        let st = Arc::new(AiStatus::default());
        let mut stage = AiStage::new();
        let mut frame = [0.1f32; FRAME];

        // Natural voice: stage stays out of the way.
        assert!(!stage.process(&mut frame, VoiceType::Natural, true, &st));
        assert_eq!(st.state(), AiState::Off);
        // AI disabled: same.
        assert!(!stage.process(&mut frame, VoiceType::Masculine, false, &st));

        // Masculine: falls back (returns false) until the server is live, then streams.
        let start = Instant::now();
        let mut out = Vec::new();
        let mut fallback_frames = 0;
        for k in 0..400u64 {
            // 4 s of real-time frames
            frame.fill(0.1);
            if stage.process(&mut frame, VoiceType::Masculine, true, &st) {
                out.extend_from_slice(&frame);
            } else {
                assert!(out.is_empty(), "fell back after going live");
                fallback_frames += 1;
            }
            let due = start + Duration::from_millis(10 * (k + 1));
            if let Some(d) = due.checked_duration_since(Instant::now()) {
                thread::sleep(d);
            }
        }
        assert_eq!(st.state(), AiState::Live);
        assert!(fallback_frames < 30, "took {fallback_frames} frames to go live");
        // Skip the start (leading silence + first block); then the sine must be continuous.
        let body = &out[(SAMPLE_RATE as usize / 2)..];
        let silent_runs = body.chunks(FRAME).filter(|c| c.iter().all(|v| v.abs() < 1e-4)).count();
        assert_eq!(silent_runs, 0, "dropouts in steady state");
        let max_jump = body.windows(2).map(|w| (w[1] - w[0]).abs()).fold(0.0, f32::max);
        // 200 Hz at 0.5 amplitude, 48 kHz: max slope 2*pi*200/48000*0.5 = 0.013 per sample
        assert!(max_jump < 0.03, "glitch: sample jump {max_jump}");
        assert_eq!(st.underruns.load(Ordering::Relaxed), 0);
        let lat = st.latency_ms();
        let base = (BLOCK_MS + 60 + SLACK_MS) as f32;
        assert!(lat > base && lat < base + 100.0, "latency estimate {lat}");

        // Switching voice reconnects and goes live again.
        let t = Instant::now();
        while t.elapsed() < Duration::from_secs(3) {
            frame.fill(0.1);
            if stage.process(&mut frame, VoiceType::Feminine, true, &st) && st.state() == AiState::Live {
                break;
            }
            thread::sleep(Duration::from_millis(10));
        }
        assert_eq!(st.state(), AiState::Live);

        // Back to Natural: worker stops, status off.
        assert!(!stage.process(&mut frame, VoiceType::Natural, true, &st));
        assert_eq!(st.state(), AiState::Off);
    }
}
