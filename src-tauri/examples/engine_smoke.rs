//! Headless smoke test: runs the real pipeline on the default mic for a few seconds and
//! prints meters, DSP load and status. `cargo run --release --example engine_smoke [secs]`
use sanay_lib::audio::{devices, engine::Engine};
use std::sync::atomic::Ordering;
use std::time::Duration;

fn main() -> anyhow::Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    let secs: u64 = std::env::args().nth(1).and_then(|s| s.parse().ok()).unwrap_or(5);

    let list = devices::list()?;
    println!("inputs:");
    for d in &list.inputs {
        println!("  {}{}", d.name, if d.is_default { "  (default)" } else { "" });
    }
    println!("outputs:");
    for d in &list.outputs {
        println!("  {}{}", d.name, if d.is_virtual_cable { "  [virtual cable]" } else { "" });
    }

    let engine = Engine::new();
    // SANAY_TEST_INPUT=<device id> simulates a saved mic (e.g. an unplugged headset).
    let wanted = std::env::var("SANAY_TEST_INPUT").ok();
    // SANAY_TEST_VOICE=masculine|feminine turns on the voice type stage.
    if let Ok(v) = std::env::var("SANAY_TEST_VOICE") {
        let vt = match v.as_str() {
            "masculine" => sanay_lib::audio::voice::VoiceType::Masculine,
            "feminine" => sanay_lib::audio::voice::VoiceType::Feminine,
            _ => sanay_lib::audio::voice::VoiceType::Natural,
        };
        engine.shared.voice_type.store(vt.to_u8(), Ordering::Relaxed);
    }
    engine.start(wanted)?;
    println!("active mic: {:?}", *engine.shared.active_input.lock());
    for _ in 0..secs * 4 {
        std::thread::sleep(Duration::from_millis(250));
        let l = engine.shared.levels();
        println!(
            "in {:6.1} dB | out {:6.1} dB | load {:5.1}% | frames {}",
            l.input.rms_db,
            l.output.rms_db,
            engine.shared.dsp_load.load() * 100.0,
            engine.shared.frames.load(Ordering::Relaxed)
        );
    }
    println!("state: {:?}", *engine.shared.state.lock());
    println!("cable active: {}", engine.shared.cable_active.load(Ordering::Relaxed));
    println!("latency estimate: {:.0} ms", engine.shared.latency_ms.load());
    engine.stop();
    Ok(())
}
