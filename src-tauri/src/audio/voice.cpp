// Minimal C interface to Signalsmith Stretch for Sanay's "Voice type" (mono, live).
// Compiled by build.rs with the `cc` crate; declared in voice.rs.
#include "signalsmith-stretch.h"

#include <cmath>

namespace {
struct MonoBuffer {
    float *data;
    // process() indexes buffers as [channel][sample]; we only have one channel.
    float *operator[](int) const { return data; }
};
}  // namespace

struct SanayStretch {
    signalsmith::stretch::SignalsmithStretch<float> s;
    float sampleRate;
};

extern "C" {

SanayStretch *sanay_stretch_create(float sample_rate, int block_samples, int interval_samples) {
    auto *h = new SanayStretch();
    h->sampleRate = sample_rate;
    h->s.configure(1, block_samples, interval_samples);
    return h;
}

void sanay_stretch_destroy(SanayStretch *h) { delete h; }

void sanay_stretch_reset(SanayStretch *h) { h->s.reset(); }

int sanay_stretch_latency(SanayStretch *h) { return h->s.inputLatency() + h->s.outputLatency(); }

/// Pitch shift and formant shift in semitones (formants compensated for pitch).
/// `tonality_hz`: above this, content is treated as noise-like rather than tonal, which keeps
/// breath and sibilants from turning metallic (3 kHz measured cleanest for speech).
/// `formant_base_hz`: the speaker's median pitch for formant analysis (0 = let it track).
void sanay_stretch_set(SanayStretch *h, float semitones, float formant_semitones, float tonality_hz,
                       float formant_base_hz) {
    h->s.setTransposeSemitones(semitones, tonality_hz / h->sampleRate);
    h->s.setFormantSemitones(formant_semitones, true);
    h->s.setFormantBase(formant_base_hz / h->sampleRate);
}

/// Live processing: same number of samples in and out.
void sanay_stretch_process(SanayStretch *h, float *input, float *output, int samples) {
    h->s.process(MonoBuffer{input}, samples, MonoBuffer{output}, samples);
}

}  // extern "C"
