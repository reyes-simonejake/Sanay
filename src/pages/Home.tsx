import { AudioLines, ShieldCheck, TriangleAlert } from "lucide-react";
import { OrbSwitch } from "../components/OrbSwitch";
import { StatusBadge } from "../components/StatusBadge";
import { VoiceChoice } from "../components/VoiceChoice";
import { fill, useT, type TKey } from "../i18n";
import { api, onAirState, type Settings, type Status } from "../lib/api";

/** The whole job on one screen: is the call hearing Sanay, and which voice. */
export function Home({
  settings,
  update,
  status,
}: {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  status: Status | null;
}) {
  const { t } = useT();
  const air = onAirState(settings.active, settings.voiceType, status);
  const notReady = status && !status.ready;

  return (
    <div className="space-y-6">
      {notReady && <StatusBadge status={status} />}

      <div className="space-y-3">
        <OrbSwitch
          state={air}
          voice={settings.voiceType}
          onToggle={(on) => {
            update({ active: on });
            api.setActive(on);
          }}
        />
        {air === "fallback" ? (
          <p className="flex items-start justify-center gap-2 text-center text-[13px] text-warn" title={status?.aiVoice.message}>
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {fill(t("air.fallback"), { voice: t(`web.voice.${settings.voiceType}` as TKey) })}
          </p>
        ) : air === "blocked" ? null : (
          <p className="text-center text-[12px] text-muted-foreground">{t("air.hint")}</p>
        )}
      </div>

      <VoiceChoice
        value={settings.voiceType}
        onChange={(v) => {
          update({ voiceType: v });
          api.setVoice(v, settings.voiceAmount);
        }}
      />

      {settings.voiceType !== "natural" && settings.active && (
        <p className="flex items-start gap-2.5 text-[12px] text-muted-foreground">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
          {t("voiceNotice.reminder")}
        </p>
      )}

      {status?.cable.recordingName && (
        <p className="flex items-start gap-2.5 rounded-xl border border-border px-3 py-2.5 text-[13px] text-muted-foreground">
          <AudioLines aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>
            {t("home.pickInApp")} <span className="font-medium text-foreground">{status.cable.recordingName}</span>
          </span>
        </p>
      )}
    </div>
  );
}
