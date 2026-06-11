/**
 * Formats a Date as a filesystem-safe UTC timestamp string: `YYYYMMDDTHHmmssZ`.
 * Milliseconds are truncated. Used to build per-session output filename segments.
 */
export function formatSessionTimestamp(date: Date): string {
  const YYYY = String(date.getUTCFullYear()).padStart(4, "0");
  const MM = String(date.getUTCMonth() + 1).padStart(2, "0");
  const DD = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${YYYY}${MM}${DD}T${hh}${mm}${ss}Z`;
}
