//! Real-time test of the AI voice stage without a mic: plays a 48 kHz mono 16-bit WAV through
//! `AiStage` at the real pace (one 10 ms frame every 10 ms, like the DSP thread), writes what comes
//! out, and reports dropouts and the measured delay (speech onset in vs out).
//!
//! `cargo run --release --example ai_voice_file -- in.wav out.wav [masculine|feminine]`
//! Needs the voice server (it is started automatically if missing).
use sanay_lib::audio::ai_voice::{AiStage, AiState, AiStatus};
use sanay_lib::audio::dsp::{FRAME, SAMPLE_RATE};
use sanay_lib::audio::voice::VoiceType;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::{Duration, Instant};

fn read_wav(path: &str) -> anyhow::Result<Vec<f32>> {
    let b = std::fs::read(path)?;
    anyhow::ensure!(&b[0..4] == b"RIFF" && &b[8..12] == b"WAVE", "not a WAV");
    let mut i = 12;
    let (mut ch, mut rate, mut bits) = (0u16, 0u32, 0u16);
    while i + 8 <= b.len() {
        let id = &b[i..i + 4];
        let n = u32::from_le_bytes(b[i + 4..i + 8].try_into()?) as usize;
        let body = &b[i + 8..(i + 8 + n).min(b.len())];
        if id == b"fmt " {
            ch = u16::from_le_bytes(body[2..4].try_into()?);
            rate = u32::from_le_bytes(body[4..8].try_into()?);
            bits = u16::from_le_bytes(body[14..16].try_into()?);
        } else if id == b"data" {
            anyhow::ensure!(ch == 1 && rate == SAMPLE_RATE && bits == 16, "need 48 kHz mono 16-bit (got {rate} Hz x{ch}, {bits} bit)");
            return Ok(body.chunks_exact(2).map(|s| i16::from_le_bytes([s[0], s[1]]) as f32 / 32768.0).collect());
        }
        i += 8 + n + (n & 1);
    }
    anyhow::bail!("no data chunk")
}

fn write_wav(path: &str, x: &[f32]) -> anyhow::Result<()> {
    let mut b = Vec::with_capacity(44 + x.len() * 2);
    let data = (x.len() * 2) as u32;
    b.extend_from_slice(b"RIFF");
    b.extend_from_slice(&(36 + data).to_le_bytes());
    b.extend_from_slice(b"WAVEfmt ");
    b.extend_from_slice(&16u32.to_le_bytes());
    b.extend_from_slice(&1u16.to_le_bytes());
    b.extend_from_slice(&1u16.to_le_bytes());
    b.extend_from_slice(&SAMPLE_RATE.to_le_bytes());
    b.extend_from_slice(&(SAMPLE_RATE * 2).to_le_bytes());
    b.extend_from_slice(&2u16.to_le_bytes());
    b.extend_from_slice(&16u16.to_le_bytes());
    b.extend_from_slice(b"data");
    b.extend_from_slice(&data.to_le_bytes());
    for v in x {
        b.extend_from_slice(&((v.clamp(-1.0, 1.0) * 32767.0) as i16).to_le_bytes());
    }
    Ok(std::fs::write(path, b)?)
}

/// First 10 ms frame whose level is within 30 dB of the loudest frame.
fn onset(x: &[f32]) -> Option<usize> {
    let e: Vec<f32> = x.chunks(FRAME).map(|c| c.iter().map(|v| v * v).sum::<f32>() / c.len() as f32).collect();
    let peak = e.iter().cloned().fold(0.0, f32::max);
    e.iter().position(|&v| v > peak * 1e-3)
}

fn main() -> anyhow::Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    let a: Vec<String> = std::env::args().collect();
    anyhow::ensure!(a.len() >= 3, "usage: ai_voice_file in.wav out.wav [masculine|feminine]");
    let voice = if a.get(3).map(String::as_str) == Some("feminine") { VoiceType::Feminine } else { VoiceType::Masculine };
    let input = read_wav(&a[1])?;

    let st = Arc::new(AiStatus::default());
    let mut stage = AiStage::new();
    let mut frame = [0f32; FRAME];
    // Warm up: feed silence until the server is live (it may need to start and load models).
    let t0 = Instant::now();
    while st.state() != AiState::Live {
        frame.fill(0.0);
        stage.process(&mut frame, voice, true, &st);
        std::thread::sleep(Duration::from_millis(10));
        anyhow::ensure!(t0.elapsed() < Duration::from_secs(120), "AI voice not live: {:?} {}", st.state(), st.message.lock().unwrap());
        if st.state() == AiState::Unavailable {
            anyhow::bail!("AI voice unavailable: {}", st.message.lock().unwrap());
        }
    }
    println!("live after {:.1} s", t0.elapsed().as_secs_f32());
    for _ in 0..50 {
        // settle 0.5 s of silence through the live path
        frame.fill(0.0);
        stage.process(&mut frame, voice, true, &st);
        std::thread::sleep(Duration::from_millis(10));
    }
    let under0 = st.underruns.load(Ordering::Relaxed);

    let tail = vec![0f32; SAMPLE_RATE as usize]; // 1 s to flush
    let mut out = Vec::with_capacity(input.len() + tail.len());
    let start = Instant::now();
    let mut late = 0usize;
    for (k, chunk) in input.chunks(FRAME).chain(tail.chunks(FRAME)).enumerate() {
        frame.fill(0.0);
        frame[..chunk.len()].copy_from_slice(chunk);
        let live = stage.process(&mut frame, voice, true, &st);
        out.extend_from_slice(if live { &frame[..] } else { &[0f32; FRAME][..] });
        // Real-time pacing, like the mic callback.
        let due = start + Duration::from_millis(10 * (k as u64 + 1));
        match due.checked_duration_since(Instant::now()) {
            Some(d) => std::thread::sleep(d),
            None => late += 1,
        }
    }
    write_wav(&a[2], &out)?;
    let under = st.underruns.load(Ordering::Relaxed) - under0;
    println!(
        "frames {} | underrun frames {} | late test frames {} | round trip {:.0} ms | stage latency estimate {:.0} ms",
        out.len() / FRAME,
        under,
        late,
        st.compute_ms.load(),
        st.latency_ms()
    );
    if let (Some(i), Some(o)) = (onset(&input), onset(&out)) {
        println!("measured delay (speech onset in -> out): {} ms", (o as i64 - i as i64) * 10);
    }
    Ok(())
}
