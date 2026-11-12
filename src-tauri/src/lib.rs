pub mod audio;
mod settings;
mod setup;

use audio::denoise::{DenoiserKind, Strength};
use audio::voice::VoiceType;
use audio::devices::{self, DeviceList};
use audio::engine::{self, Engine, EngineState, TestState, TestVariant, MIC_TEST_SECONDS};
use parking_lot::Mutex;
use serde::Serialize;
use settings::{Settings, SettingsStore};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, State, WebviewUrl, WebviewWindowBuilder, WindowEvent, Wry};
use std::sync::atomic::AtomicU64;
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

struct AppState {
    engine: Arc<Engine>,
    settings: Mutex<Settings>,
    store: SettingsStore,
    tray_active: Mutex<Option<CheckMenuItem<Wry>>>,
    /// Debounces saving the pill position while it is being dragged.
    pill_move_gen: AtomicU64,
}

impl AppState {
    fn update_settings(&self, f: impl FnOnce(&mut Settings)) {
        let mut s = self.settings.lock();
        f(&mut s);
        if let Err(e) = self.store.save(&s) {
            log::warn!("could not save settings: {e:#}");
        }
    }
}

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

// ───────────────────────────── commands ─────────────────────────────

#[tauri::command]
fn list_devices() -> CmdResult<DeviceList> {
    devices::list().map_err(err)
}

#[tauri::command]
fn get_settings(state: State<AppState>) -> Settings {
    state.settings.lock().clone()
}

#[tauri::command]
fn start_engine(state: State<AppState>, input_id: Option<String>) -> CmdResult<()> {
    state.update_settings(|s| s.input_device_id = input_id.clone());
    state.engine.start(input_id).map_err(|e| format!("{e:#}"))
}

#[tauri::command]
fn stop_engine(state: State<AppState>) {
    state.engine.stop();
}

#[tauri::command]
fn set_nc(app: AppHandle, enabled: bool) {
    let state = app.state::<AppState>();
    state.engine.shared.nc_enabled.store(enabled, Ordering::Relaxed);
    state.update_settings(|s| s.nc_enabled = enabled);
    let _ = app.emit("nc-changed", enabled);
}

/// Master on/off (floating pill, window lamp, tray). Every view follows the "active-changed" event.
fn apply_active(app: &AppHandle, on: bool) {
    let state = app.state::<AppState>();
    state.engine.shared.active.store(on, Ordering::Relaxed);
    state.update_settings(|s| s.active = on);
    if let Some(item) = state.tray_active.lock().as_ref() {
        let _ = item.set_checked(on);
    }
    let _ = app.emit("active-changed", on);
}

#[tauri::command]
fn set_active(app: AppHandle, on: bool) {
    apply_active(&app, on);
}

#[tauri::command]
fn set_pill_visible(app: AppHandle, visible: bool) {
    app.state::<AppState>().update_settings(|s| s.pill_visible = visible);
    if let Some(w) = app.get_webview_window("pill") {
        let _ = if visible { w.show() } else { w.hide() };
    }
    let _ = app.emit("pill-visible-changed", visible);
}

#[tauri::command]
fn show_main_window(app: AppHandle) {
    show_window(&app);
}

#[tauri::command]
fn set_strength(state: State<AppState>, level: Strength) {
    state.engine.shared.strength.store(level.to_u8(), Ordering::Relaxed);
    state.update_settings(|s| s.strength = level);
}

#[tauri::command]
fn set_voice(app: AppHandle, state: State<AppState>, voice_type: VoiceType, amount: f32) {
    let amount = amount.clamp(0.0, 1.0);
    state.engine.shared.voice_type.store(voice_type.to_u8(), Ordering::Relaxed);
    state.engine.shared.voice_amount.store(amount);
    state.update_settings(|s| {
        s.voice_type = voice_type;
        s.voice_amount = amount;
    });
    let _ = app.emit("voice-changed", voice_type);
}

#[tauri::command]
fn set_clarity(state: State<AppState>, enabled: bool) {
    state.engine.shared.clarity.store(enabled, Ordering::Relaxed);
    state.update_settings(|s| s.clarity = enabled);
}

#[tauri::command]
fn set_echo_cancel(state: State<AppState>, enabled: bool) {
    state.engine.shared.echo_cancel.store(enabled, Ordering::Relaxed);
    state.update_settings(|s| s.echo_cancel = enabled);
}

#[tauri::command]
fn set_ai_voice(state: State<AppState>, enabled: bool) {
    state.engine.shared.ai_enabled.store(enabled, Ordering::Relaxed);
    state.update_settings(|s| s.ai_voice = enabled);
}

#[tauri::command]
fn set_monitor(state: State<AppState>, enabled: bool) {
    state.engine.set_monitor(enabled);
    state.update_settings(|s| s.monitor_enabled = enabled);
}

#[tauri::command]
fn set_language(app: AppHandle, state: State<AppState>, language: String) {
    state.update_settings(|s| s.language = language.clone());
    let _ = app.emit("language-changed", language);
}

#[tauri::command]
fn set_setup_done(app: AppHandle, state: State<AppState>, done: bool) {
    state.update_settings(|s| s.setup_done = done);
    // The pill appears once Sanay is set up (and the user has not hidden it).
    if done && state.settings.lock().pill_visible {
        if let Some(w) = app.get_webview_window("pill") {
            let _ = w.show();
        }
    }
}

#[tauri::command]
fn set_autostart(app: AppHandle, state: State<AppState>, enabled: bool) -> CmdResult<()> {
    let al = app.autolaunch();
    if enabled { al.enable() } else { al.disable() }.map_err(err)?;
    state.update_settings(|s| s.start_with_windows = enabled);
    Ok(())
}

#[tauri::command]
fn get_cable_status() -> setup::CableStatus {
    setup::cable_status()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Status {
    engine: EngineState,
    mic_ok: bool,
    cable_ok: bool,
    denoiser_ok: bool,
    denoiser: Option<DenoiserKind>,
    fell_back_to_light: bool,
    /// DSP load as a fraction of real time (not whole-process CPU).
    dsp_load: f32,
    latency_ms: f32,
    nc_enabled: bool,
    /// F12: mic + virtual cable + denoiser all working.
    ready: bool,
    cable: setup::CableStatus,
    /// The mic in use; `fallback` = chosen mic missing, using the device's default mic.
    input: Option<devices::ActiveInput>,
    /// Mains hum being removed (Hz), if any.
    hum_hz: Option<f32>,
    /// Echo cancellation is on and listening to the speakers.
    echo_cancel: bool,
    ai_voice: AiVoiceStatus,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AiVoiceStatus {
    enabled: bool,
    state: audio::ai_voice::AiState,
    message: String,
    /// Added mic-to-output delay while live (ms).
    latency_ms: f32,
    underruns: u64,
}

#[tauri::command]
fn get_status(state: State<AppState>) -> Status {
    let sh = &state.engine.shared;
    let engine = sh.state.lock().clone();
    let running = engine == EngineState::Running;
    let mic_ok = running;
    let cable_ok = running && sh.cable_active.load(Ordering::Relaxed);
    let denoiser = *sh.denoiser.lock();
    let dsp_load = sh.dsp_load.load();
    let denoiser_ok = running && denoiser.is_some() && dsp_load < 1.0;
    let ai_live = running && sh.ai.state() == audio::ai_voice::AiState::Live;
    Status {
        ready: mic_ok && cable_ok && denoiser_ok,
        engine,
        mic_ok,
        cable_ok,
        denoiser_ok,
        denoiser,
        fell_back_to_light: sh.fell_back.load(Ordering::Relaxed),
        dsp_load,
        latency_ms: sh.latency_ms.load() + if ai_live { sh.ai.latency_ms() } else { 0.0 },
        nc_enabled: sh.nc_enabled.load(Ordering::Relaxed),
        cable: setup::cable_status(),
        input: sh.active_input.lock().clone(),
        hum_hz: Some(sh.hum_hz.load()).filter(|&h| h > 0.0),
        echo_cancel: sh.echo_cancel.load(Ordering::Relaxed) && sh.echo_ref.load(Ordering::Relaxed) && !sh.monitor_enabled.load(Ordering::Relaxed),
        ai_voice: AiVoiceStatus {
            enabled: sh.ai_enabled.load(Ordering::Relaxed),
            state: sh.ai.state(),
            message: sh.ai.message.lock().map(|m| m.clone()).unwrap_or_default(),
            latency_ms: if ai_live { sh.ai.latency_ms() } else { 0.0 },
            underruns: sh.ai.underruns.load(Ordering::Relaxed),
        },
    }
}

/// Records 5 s of raw + cleaned audio into memory (F7). Resolves when done.
#[tauri::command]
async fn run_mic_test(state: State<'_, AppState>) -> CmdResult<()> {
    let sh = state.engine.shared.clone();
    if *sh.state.lock() != EngineState::Running {
        return Err("Start Sanay first — the mic isn't running.".into());
    }
    {
        let mut t = sh.test.lock();
        let n = MIC_TEST_SECONDS * audio::dsp::SAMPLE_RATE as usize;
        t.raw = Vec::with_capacity(n);
        t.clean = Vec::with_capacity(n);
        t.state = TestState::Recording;
    }
    let want = MIC_TEST_SECONDS * audio::dsp::SAMPLE_RATE as usize;
    let deadline = std::time::Instant::now() + Duration::from_secs(MIC_TEST_SECONDS as u64 + 3);
    loop {
        tokio::time::sleep(Duration::from_millis(100)).await;
        let mut t = sh.test.lock();
        if t.raw.len() >= want {
            t.state = TestState::Ready;
            return Ok(());
        }
        if std::time::Instant::now() > deadline {
            t.state = TestState::Idle;
            t.raw.clear();
            t.clean.clear();
            return Err("The mic stopped sending audio during the test.".into());
        }
    }
}

#[tauri::command]
async fn play_mic_test(state: State<'_, AppState>, variant: TestVariant) -> CmdResult<()> {
    let clip = {
        let t = state.engine.shared.test.lock();
        if t.state != TestState::Ready {
            return Err("No test recording yet.".into());
        }
        match variant {
            TestVariant::Raw => t.raw.clone(),
            TestVariant::Clean => t.clean.clone(),
        }
    };
    tauri::async_runtime::spawn_blocking(move || engine::play_clip(clip))
        .await
        .map_err(err)?
        .map_err(|e| format!("{e:#}"))
}

/// Forget the test recording (it is never written to disk).
#[tauri::command]
fn discard_mic_test(state: State<AppState>) {
    let mut t = state.engine.shared.test.lock();
    t.state = TestState::Idle;
    t.raw = Vec::new();
    t.clean = Vec::new();
}

#[tauri::command]
fn open_url(url: String) -> CmdResult<()> {
    // Only ever used for the VB-Cable download page.
    if url != setup::VB_CABLE_URL {
        return Err("blocked".into());
    }
    #[cfg(windows)]
    {
        std::process::Command::new("rundll32").args(["url.dll,FileProtocolHandler", &url]).spawn().map_err(err)?;
    }
    Ok(())
}

// ───────────────────────────── app ─────────────────────────────

fn show_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn build_tray(app: &AppHandle, active: bool) -> tauri::Result<CheckMenuItem<Wry>> {
    let nc = CheckMenuItem::with_id(app, "active", "Sanay on", true, active, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "Open Sanay", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&nc, &open, &sep, &quit])?;

    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().cloned().expect("app icon"))
        .tooltip("Sanay")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "active" => {
                let on = !app.state::<AppState>().engine.shared.active.load(Ordering::Relaxed);
                apply_active(app, on);
            }
            "open" => show_window(app),
            "quit" => {
                app.state::<AppState>().engine.stop();
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(nc)
}

/// Logical size of the pill window; the capsule fills it and the corners are transparent.
const PILL_W: f64 = 212.0;
const PILL_H: f64 = 52.0;

/// The floating on/off pill: frameless, transparent, always on top, not in the taskbar.
fn build_pill(app: &AppHandle, pos: Option<(i32, i32)>, visible: bool) -> tauri::Result<()> {
    let w = WebviewWindowBuilder::new(app, "pill", WebviewUrl::App("index.html#pill".into()))
        .title("Sanay")
        .inner_size(PILL_W, PILL_H)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
        .skip_taskbar(true)
        .focused(false)
        .visible(false)
        .build()?;
    let target = pos.filter(|&(x, y)| on_some_monitor(&w, x, y)).or_else(|| default_pill_pos(&w));
    if let Some((x, y)) = target {
        let _ = w.set_position(PhysicalPosition::new(x, y));
    }
    if visible {
        w.show()?;
    }
    Ok(())
}

/// A remembered spot can be off-screen after a monitor is unplugged; then use the default.
fn on_some_monitor(w: &tauri::WebviewWindow, x: i32, y: i32) -> bool {
    w.available_monitors().unwrap_or_default().iter().any(|m| {
        let (p, s) = (m.position(), m.size());
        x >= p.x && y >= p.y && x + 40 <= p.x + s.width as i32 && y + 20 <= p.y + s.height as i32
    })
}

/// Bottom-right of the primary screen, above the taskbar.
fn default_pill_pos(w: &tauri::WebviewWindow) -> Option<(i32, i32)> {
    let m = w.primary_monitor().ok().flatten()?;
    let area = m.work_area();
    let k = m.scale_factor();
    let (pw, ph, gap) = ((PILL_W * k) as i32, (PILL_H * k) as i32, (24.0 * k) as i32);
    Some((area.position.x + area.size.width as i32 - pw - gap, area.position.y + area.size.height as i32 - ph - gap))
}

/// Save where the user dropped the pill, once the drag settles (not on every pixel).
fn remember_pill_pos(app: &AppHandle, pos: PhysicalPosition<i32>) {
    let state = app.state::<AppState>();
    let gen = state.pill_move_gen.fetch_add(1, Ordering::Relaxed) + 1;
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(400));
        let state = app.state::<AppState>();
        if state.pill_move_gen.load(Ordering::Relaxed) == gen {
            state.update_settings(|s| s.pill_pos = Some((pos.x, pos.y)));
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .setup(|app| {
            let store = SettingsStore::new(app.path().app_config_dir()?);
            let mut settings = store.load();
            // Noise cleanup is part of every voice (product rule), never a separate choice.
            settings.nc_enabled = true;

            let engine = Engine::new();
            engine.shared.nc_enabled.store(settings.nc_enabled, Ordering::Relaxed);
            engine.shared.strength.store(settings.strength.to_u8(), Ordering::Relaxed);
            engine.shared.monitor_enabled.store(settings.monitor_enabled, Ordering::Relaxed);
            engine.shared.voice_type.store(settings.voice_type.to_u8(), Ordering::Relaxed);
            engine.shared.voice_amount.store(settings.voice_amount);
            engine.shared.clarity.store(settings.clarity, Ordering::Relaxed);
            engine.shared.echo_cancel.store(settings.echo_cancel, Ordering::Relaxed);
            engine.shared.ai_enabled.store(settings.ai_voice, Ordering::Relaxed);
            engine.shared.active.store(settings.active, Ordering::Relaxed);

            // Start straight away with the remembered mic so a tray-only launch just works.
            if settings.setup_done {
                if let Err(e) = engine.start(settings.input_device_id.clone()) {
                    log::warn!("could not start engine at launch: {e:#}");
                }
            }

            let active_item = build_tray(app.handle(), settings.active)?;
            let (pill_visible, pill_pos, setup_done) = (settings.pill_visible, settings.pill_pos, settings.setup_done);
            app.manage(AppState {
                engine: engine.clone(),
                settings: Mutex::new(settings),
                store,
                tray_active: Mutex::new(Some(active_item)),
                pill_move_gen: AtomicU64::new(0),
            });
            if let Err(e) = build_pill(app.handle(), pill_pos, pill_visible && setup_done) {
                log::warn!("could not create the floating pill: {e:#}");
            }

            if std::env::args().any(|a| a == "--minimized") {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }

            // `levels` event, ~20×/s (F6).
            let handle = app.handle().clone();
            std::thread::Builder::new().name("sanay-levels".into()).spawn(move || loop {
                std::thread::sleep(Duration::from_millis(50));
                let _ = handle.emit("levels", engine.shared.levels());
            })?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // Closing the window keeps Sanay running in the tray: the call must not drop.
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            WindowEvent::Moved(pos) if window.label() == "pill" => remember_pill_pos(window.app_handle(), *pos),
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            list_devices,
            get_settings,
            start_engine,
            stop_engine,
            set_nc,
            set_strength,
            set_monitor,
            set_voice,
            set_ai_voice,
            set_clarity,
            set_echo_cancel,
            set_language,
            set_setup_done,
            set_autostart,
            get_cable_status,
            get_status,
            run_mic_test,
            play_mic_test,
            discard_mic_test,
            open_url,
            set_active,
            set_pill_visible,
            show_main_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Sanay");
}
