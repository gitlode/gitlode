export function formatUnixTimestampWithOffset(timestamp: number, timezoneOffset: number): string {
  const offsetSign = timezoneOffset >= 0 ? "+" : "-";
  const absOffset = Math.abs(timezoneOffset);
  const offsetHH = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const offsetMM = String(absOffset % 60).padStart(2, "0");
  const offsetStr = `${offsetSign}${offsetHH}:${offsetMM}`;

  const localMs = (timestamp + timezoneOffset * 60) * 1000;
  const d = new Date(localMs);
  const YYYY = d.getUTCFullYear();
  const MM = String(d.getUTCMonth() + 1).padStart(2, "0");
  const DD = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${YYYY}-${MM}-${DD}T${hh}:${mm}:${ss}${offsetStr}`;
}
