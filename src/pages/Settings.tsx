import type { ReactNode } from "react";
import { ChevronRight, Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { MicPicker } from "../components/Audio";
import { ThemeChoice } from "../components/ThemeToggle";
import { useT } from "../i18n";
import { api, type DeviceInfo, type Settings as S, type Status } from "../lib/api";
import { Card, SecondaryButton } from "./ui";

export function Settings({
  settings,
  update,
  status,
  inputs,
  refresh,
  onMicTest,
  onRerunSetup,
}: {
  settings: S;
  update: (patch: Partial<S>) => void;
  status: Status | null;
  inputs: DeviceInfo[];
  refresh: () => void;
  onMicTest: () => void;
  onRerunSetup: () => void;
}) {
  const { t } = useT();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t("settings.title")}</h1>

      <Card className="space-y-4">
        <MicPicker
          devices={inputs}
          value={settings.inputDeviceId}
          onChange={(id) => {
            update({ inputDeviceId: id });
            api.startEngine(id).finally(refresh);
          }}
        />
        <button
          type="button"
          onClick={onMicTest}
          className="flex w-full items-center justify-between rounded-lg text-[15px] font-semibold text-brand hover:underline hover:underline-offset-4"
        >
          {t("settings.micTest")}
          <ChevronRight aria-hidden className="size-4" />
        </button>
        <Separator />
        <SwitchRow
          id="echo"
          label={t("settings.echo")}
          hint={t("settings.echoHint")}
          checked={settings.echoCancel}
          onChange={(v) => {
            update({ echoCancel: v });
            api.setEchoCancel(v);
          }}
        />
      </Card>

      <Card className="space-y-4">
        <SwitchRow
          id="pill"
          label={t("settings.pill")}
          hint={t("settings.pillHint")}
          checked={settings.pillVisible}
          onChange={(v) => {
            update({ pillVisible: v });
            api.setPillVisible(v);
          }}
        />
        <Separator />
        <SwitchRow
          id="monitor"
          label={t("settings.monitor")}
          hint={t("settings.monitorHint")}
          checked={settings.monitorEnabled}
          onChange={(v) => {
            update({ monitorEnabled: v });
            api.setMonitor(v);
          }}
        />
        <Separator />
        <SwitchRow
          id="autostart"
          label={t("settings.autostart")}
          checked={settings.startWithWindows}
          onChange={(v) => {
            update({ startWithWindows: v });
            api.setAutostart(v).catch(() => update({ startWithWindows: !v }));
          }}
        />
        <Separator />
        <div className="space-y-2">
          <span className="block text-[15px] font-semibold">{t("theme.title")}</span>
          <ThemeChoice />
        </div>
        <Separator />
        <div className="space-y-2">
          <Label htmlFor="language" className="text-[15px] font-semibold">
            {t("settings.language")}
          </Label>
          <Select
            value={settings.language}
            onValueChange={(v) => {
              const language = v as S["language"];
              update({ language });
              api.setLanguage(language);
            }}
          >
            <SelectTrigger id="language" className="h-10 w-full bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="fil">Filipino / Tagalog</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <SecondaryButton onClick={onRerunSetup}>{t("settings.rerunSetup")}</SecondaryButton>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
        <dt>{t("settings.engineInfo")}</dt>
        <dd className="text-right text-foreground">
          {status?.denoiser === "deepfilternet" ? "DeepFilterNet3" : status?.denoiser === "rnnoise" ? "RNNoise" : "—"}
        </dd>
        <dt>{t("settings.latency")}</dt>
        <dd className="text-right text-foreground">{status ? `${(status.latencyMs / 1000).toFixed(2)} s` : "—"}</dd>
        <dt>{t("settings.load")}</dt>
        <dd className="text-right text-foreground">{status ? `${Math.round(status.dspLoad * 100)}%` : "—"}</dd>
      </dl>

      <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t("settings.privacy")}
      </p>
    </div>
  );
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <Label htmlFor={id} className="block cursor-pointer">
        <span className="block text-[15px] font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] font-normal text-muted-foreground">{hint}</span>}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </div>
  );
}
