import type { MeterReading } from "../lib/api";

const FLOOR_DB = -60;

const pct = (db: number) => Math.max(0, Math.min(100, ((db - FLOOR_DB) / -FLOOR_DB) * 100));

/** Horizontal RMS bar with a peak tick. Green → amber near -6 dBFS → red near clipping. */
export function LevelMeter({ label, reading }: { label: string; reading: MeterReading }) {
  const rms = pct(reading.rmsDb);
  const peak = pct(reading.peakDb);
  const color = reading.peakDb > -3 ? "bg-destructive" : reading.peakDb > -9 ? "bg-warn" : "bg-brand";
  return (
    <div>
      <div className="mb-1 flex justify-between text-[13px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{reading.rmsDb > FLOOR_DB ? `${reading.rmsDb.toFixed(0)} dB` : "—"}</span>
      </div>
      <div
        className="relative h-3 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={FLOOR_DB}
        aria-valuemax={0}
        aria-valuenow={Math.round(Math.max(FLOOR_DB, reading.rmsDb))}
      >
        <div className={`h-full ${color} transition-[width] duration-75`} style={{ width: `${rms}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-foreground" style={{ left: `${peak}%` }} />
      </div>
    </div>
  );
}
