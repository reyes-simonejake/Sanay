import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { api } from "../lib/api";
import { Meters } from "../components/Audio";
import { Card, PrimaryButton, SecondaryButton } from "./ui";

/** Must match MIC_TEST_SECONDS in src-tauri/src/audio/engine.rs. */
const MIC_TEST_SECONDS = 10;

type Phase = "idle" | "recording" | "ready" | "playing";

/** F7: 10-second A/B test, in memory only. */
export function MicTest() {
  const { t } = useT();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(MIC_TEST_SECONDS);

  // Forget the recording when leaving this page.
  useEffect(() => () => void api.discardMicTest(), []);

  const record = async () => {
    setError(null);
    setPhase("recording");
    setLeft(MIC_TEST_SECONDS);
    const timer = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    try {
      await api.runMicTest();
      setPhase("ready");
    } catch (e) {
      setError(String(e));
      setPhase("idle");
    } finally {
      clearInterval(timer);
    }
  };

  const play = async (v: "raw" | "clean") => {
    setPhase("playing");
    try {
      await api.playMicTest(v);
    } catch (e) {
      setError(String(e));
    }
    setPhase("ready");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("test.title")}</h1>
      <Card className="space-y-4">
        <p className="text-foreground">{t("test.body")}</p>
        <Meters />
        {phase === "recording" ? (
          <div className="flex items-center gap-3 rounded-xl bg-muted p-3 font-medium text-foreground" role="status">
            <span className="size-3 animate-pulse rounded-full bg-live" aria-hidden />
            {t("test.recording")} · {left}s
          </div>
        ) : (
          <PrimaryButton onClick={record} disabled={phase === "playing"}>
            {t("test.record")}
          </PrimaryButton>
        )}
        {error && <p className="text-[13px] text-destructive">{error}</p>}
      </Card>

      {(phase === "ready" || phase === "playing") && (
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton onClick={() => play("raw")} disabled={phase === "playing"}>
              {t("test.playRaw")}
            </SecondaryButton>
            <PrimaryButton onClick={() => play("clean")} disabled={phase === "playing"}>
              {t("test.playClean")}
            </PrimaryButton>
          </div>
          {phase === "playing" && <p className="text-sm">{t("test.playing")}</p>}
          <p className="text-sm text-muted-foreground">{t("test.headphonesHint")}</p>
          <button
            type="button"
            className="text-[13px] text-muted-foreground underline underline-offset-4"
            onClick={() => api.discardMicTest().then(() => setPhase("idle"))}
          >
            {t("test.discard")}
          </button>
        </Card>
      )}
    </div>
  );
}
