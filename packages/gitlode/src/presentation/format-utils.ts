interface MeasuredValue {
  value: string;
  unit: string;
}

// Format an integer counter (records, commits, files, etc.) with thousands separators.
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

// Format a millisecond timing value with thousands separators and fixed 2 decimal places.
export function humanizeBytes(bytes: number): MeasuredValue {
  if (bytes < 1024) return { value: String(bytes), unit: "B" };
  if (bytes < 1024 * 1024) return { value: (bytes / 1024).toFixed(1), unit: "KB" };
  if (bytes < 1024 * 1024 * 1024) return { value: (bytes / (1024 * 1024)).toFixed(1), unit: "MB" };
  return { value: (bytes / (1024 * 1024 * 1024)).toFixed(1), unit: "GB" };
}

export function formatElapsed(ms: number): MeasuredValue {
  return { value: (ms / 1000).toFixed(1), unit: "s" };
}
