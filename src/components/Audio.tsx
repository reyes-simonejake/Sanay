import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "../i18n";
import { useLevels, type DeviceInfo } from "../lib/api";
import { LevelMeter } from "./LevelMeter";

const DEFAULT = "__default__";

export function MicPicker({
  devices,
  value,
  onChange,
}: {
  devices: DeviceInfo[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { t } = useT();
  return (
    <div className="space-y-2">
      <Label htmlFor="mic-picker" className="text-[15px] font-semibold">
        {t("home.mic")}
      </Label>
      <Select value={value ?? DEFAULT} onValueChange={(v) => onChange(v === DEFAULT ? null : v)}>
        <SelectTrigger id="mic-picker" className="h-10 w-full bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT}>{t("home.systemDefault")}</SelectItem>
          {devices.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function Meters() {
  const { t } = useT();
  const levels = useLevels();
  return (
    <div className="space-y-3">
      <LevelMeter label={t("home.input")} reading={levels.input} />
      <LevelMeter label={t("home.output")} reading={levels.output} />
    </div>
  );
}
