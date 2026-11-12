// Injected before every page: a simulated speaker in place of Chrome's speech recognition and voices.
// window.__answers is a queue of what the "person" says next; window.__spoken records what the app said.
(() => {
  window.__answers = [];
  window.__spoken = [];
  window.__recErrors = []; // e.g. ["network"] makes the next recognition fail

  // Voices: speaking finishes almost at once.
  const synth = {
    speaking: false,
    getVoices: () => [],
    cancel() {},
    addEventListener() {},
    speak(u) {
      window.__spoken.push(u.text);
      setTimeout(() => u.onend && u.onend(new Event("end")), 60);
    },
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });

  class FakeRecognition {
    constructor() {
      this.lang = "en-US";
      this.continuous = false;
      this.interimResults = false;
      this.maxAlternatives = 1;
      this.onresult = this.onerror = this.onend = null;
      this._ended = false;
    }
    start() {
      const err = window.__recErrors.shift();
      if (err) {
        setTimeout(() => {
          this.onerror && this.onerror({ error: err });
          this._end();
        }, 50);
        return;
      }
      const next = window.__answers.shift();
      const say = typeof next === "string" ? { text: next } : next || null;
      setTimeout(() => {
        if (this._ended) return;
        if (!say) {
          // Nothing to say: behave like Chrome on silence.
          this.onerror && this.onerror({ error: "no-speech" });
          return this._end();
        }
        const alts = [say.text, ...(say.alts || [])];
        const result = Object.assign(alts.map((t) => ({ transcript: t, confidence: 0.9 })), { isFinal: true });
        if (this.interimResults) {
          const interim = Object.assign([{ transcript: say.text.split(" ").slice(0, 3).join(" ") }], { isFinal: false });
          this.onresult && this.onresult({ resultIndex: 0, results: [interim] });
        }
        setTimeout(() => {
          if (this._ended) return;
          this.onresult && this.onresult({ resultIndex: 0, results: [result] });
          if (!this.continuous) this._end();
        }, 120);
      }, 150);
    }
    stop() {
      setTimeout(() => this._end(), 30);
    }
    abort() {
      this._end();
    }
    _end() {
      if (this._ended) return;
      this._ended = true;
      this.onend && this.onend();
    }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
})();
