export function toISO8601(timestamp: number, timezoneOffset: number): string {
  // timezoneOffset from isomorphic-git is negated relative to convention:
  // JST is stored as -540, meaning the real UTC offset is +540 minutes (+09:00).
  const offsetMinutes = -timezoneOffset;
  const offsetSign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const offsetHH = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const offsetMM = String(absOffset % 60).padStart(2, "0");
  const offsetStr = `${offsetSign}${offsetHH}:${offsetMM}`;

  const localMs = (timestamp + offsetMinutes * 60) * 1000;
  const d = new Date(localMs);
  const YYYY = d.getUTCFullYear();
  const MM = String(d.getUTCMonth() + 1).padStart(2, "0");
  const DD = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${YYYY}-${MM}-${DD}T${hh}:${mm}:${ss}${offsetStr}`;
}

/**
 * Splits a Git commit message into subject and body.
 *
 * `subject` is the first line. `body` is the remainder of the lines joined
 * with `\n` and trimmed of surrounding whitespace. Returns `""` for `body`
 * when the message has no lines beyond the first.
 */
export function splitMessage(message: string): { subject: string; body: string } {
  const lines = message.split("\n");
  const subject = lines[0] ?? "";
  const body = lines.slice(1).join("\n").trim();
  return { subject, body };
}
