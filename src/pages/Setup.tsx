import { useEffect, useState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { useT } from "../i18n";
import { api, type CableStatus, type DeviceInfo, type Settings } from "../lib/api";
import { MicPicker, Meters } from "../components/Audio";
import { Card, PrimaryButton, SecondaryButton } from "./ui";

/** First-run wizard (F2): virtual cable → mic → choose the virtual mic in the meeting app. */
export function Setup({
  settings,
  update,
  inputs,
  onDone,
}: {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  inputs: DeviceInfo[];
  onDone: () => void;
}) {
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [cable, setCable] = useState<CableStatus | null>(null);

  const checkCable = () => api.getCableStatus().then(setCable);
  useEffect(() => {
    checkCable();
  }, []);

  // Run the engine during step 2 so the meters move.
  useEffect(() => {
    if (step === 1) api.startEngine(settings.inputDeviceId).catch(() => {});
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => {
    api.setSetupDone(true);
    update({ setupDone: true });
    api.startEngine(settings.inputDeviceId).catch(() => {});
    onDone();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("setup.title")}</h1>

      {step === 0 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">{t("setup.step1")}</h2>
          <p className="text-foreground">{t("setup.step1Body")}</p>
          <p className={`flex items-center gap-2 rounded-lg border border-border bg-background p-3 font-semibold ${cable?.installed ? "text-ok" : "text-warn"}`}>
            {cable?.installed ? <CircleCheck aria-hidden className="size-4" /> : <TriangleAlert aria-hidden className="size-4" />}
            {cable?.installed ? t("setup.cableFound") : t("setup.cableMissing")}
          </p>
          {!cable?.installed && (
            <>
              <PrimaryButton onClick={() => cable && api.openUrl(cable.downloadUrl)}>{t("setup.download")}</PrimaryButton>
              <p className="text-sm text-muted-foreground">{t("setup.installSteps")}</p>
            </>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            {cable?.installed ? (
              <PrimaryButton onClick={() => setStep(1)}>{t("setup.next")}</PrimaryButton>
            ) : (
              <>
                <SecondaryButton onClick={checkCable}>{t("setup.checkAgain")}</SecondaryButton>
                <button type="button" className="text-[13px] text-muted-foreground underline underline-offset-4" onClick={() => setStep(1)}>
                  {t("setup.skipCable")}
                </button>
              </>
            )}
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">{t("setup.step2")}</h2>
          <p className="text-foreground">{t("setup.step2Body")}</p>
          <MicPicker
            devices={inputs}
            value={settings.inputDeviceId}
            onChange={(id) => {
              update({ inputDeviceId: id });
              api.startEngine(id).catch(() => {});
            }}
          />
          <Meters />
          <div className="flex gap-2 pt-2">
            <SecondaryButton onClick={() => setStep(0)}>{t("setup.back")}</SecondaryButton>
            <PrimaryButton onClick={() => (cable?.installed ? setStep(2) : finish())}>
              {cable?.installed ? t("setup.next") : t("setup.finish")}
            </PrimaryButton>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">{t("setup.step3")}</h2>
          <p className="text-foreground">{t("setup.step3Body")}</p>
          <p className="rounded-lg bg-muted p-3 font-semibold">
            {cable?.recordingName ?? "CABLE Output (VB-Audio Virtual Cable)"}
          </p>
          <p className="text-sm text-muted-foreground">{t("setup.step3Hint")}</p>
          <div className="flex gap-2 pt-2">
            <SecondaryButton onClick={() => setStep(1)}>{t("setup.back")}</SecondaryButton>
            <PrimaryButton onClick={finish}>{t("setup.finish")}</PrimaryButton>
          </div>
        </Card>
      )}
    </div>
  );
}
