/** Episode times are stored in seconds rounded to whole milliseconds. */
export function roundMs(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Clock format for positions in a video: `m:ss.mmm`, or `h:mm:ss.mmm` past an
 * hour. Unknown values (NaN, Infinity) show as `--:--` rather than a fake 0.
 */
export function formatClock(seconds: number, decimals: 0 | 1 | 2 | 3 = 3) {
  if (!Number.isFinite(seconds)) return "--:--";
  const scale = 10 ** decimals;
  // Round once in the smallest unit so 59.9996 carries to 1:00.000.
  const units = Math.round(Math.max(0, seconds) * scale);
  const whole = Math.floor(units / scale);
  const fraction = units % scale;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, "0");
  const tail =
    decimals > 0 ? `.${String(fraction).padStart(decimals, "0")}` : "";
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${s}${tail}`
    : `${m}:${s}${tail}`;
}

/** Human duration for tallies: `1.50 s`, `2 m 05.3 s`, `1 h 02 m`. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "--";
  const centis = Math.round(Math.max(0, seconds) * 100);
  if (centis < 6000) return `${(centis / 100).toFixed(2)} s`;
  const tenths = Math.round(Math.max(0, seconds) * 10);
  const minutes = Math.floor(tenths / 600);
  if (minutes < 60) {
    const s = ((tenths % 600) / 10).toFixed(1).padStart(4, "0");
    return `${minutes} m ${s} s`;
  }
  const totalMinutes = Math.floor(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  return `${h} h ${String(totalMinutes % 60).padStart(2, "0")} m`;
}
