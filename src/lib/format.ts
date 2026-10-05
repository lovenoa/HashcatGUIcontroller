export function formatSpeed(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 H/s";
  const units = ["H/s", "KH/s", "MH/s", "GH/s", "TH/s"];
  let scaled = value;
  let unit = 0;
  while (scaled >= 1000 && unit < units.length - 1) {
    scaled /= 1000;
    unit += 1;
  }
  return `${scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1)} ${units[unit]}`;
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.floor(value)));
}

export function formatClock(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(timestamp);
}
