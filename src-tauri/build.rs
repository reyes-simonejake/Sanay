fn main() {
    // Signalsmith Stretch (header-only C++, MIT) behind Sanay's own C wrapper, for "Voice type".
    println!("cargo::rerun-if-changed=src/audio/voice.cpp");
    println!("cargo::rerun-if-changed=vendor/signalsmith");
    cc::Build::new()
        .cpp(true)
        .std("c++14")
        .file("src/audio/voice.cpp")
        .include("vendor/signalsmith")
        .opt_level(3)
        .warnings(false)
        .compile("sanay_voice");

    tauri_build::build()
}
