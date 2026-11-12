# Generates clean test speech for tests/noise-bench.js using Windows' built-in voices.
# Output: tests/audio_samples/{speech_male,speech_female,babble}.wav (48 kHz, 16-bit, mono).
Add-Type -AssemblyName System.Speech
$dir = Join-Path $PSScriptRoot "audio_samples"
New-Item -ItemType Directory -Force $dir | Out-Null
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(48000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$clips = @{
  "speech_male.wav"   = @("Microsoft David Desktop", "Good morning. Thank you for having me today. I have three years of experience in customer support, and I enjoy solving problems for people. In my last job, I handled around sixty calls a day.");
  "speech_female.wav" = @("Microsoft Zira Desktop", "Hello, and thank you for the opportunity. I recently finished my degree in information technology. I am a quick learner, I work well with a team, and I am ready to start right away.");
  "babble.wav"        = @("Microsoft David Desktop", "And then he said we should go to the market later, but the store was closed, so we went home and watched the game on television instead, it was a very long day for everybody.")
}
foreach ($k in $clips.Keys) {
  try { $s.SelectVoice($clips[$k][0]) } catch { Write-Warning "Voice $($clips[$k][0]) not installed; using default" }
  $s.SetOutputToWaveFile((Join-Path $dir $k), $fmt)
  $s.Speak($clips[$k][1])
}
$s.SetOutputToNull(); $s.Dispose()
