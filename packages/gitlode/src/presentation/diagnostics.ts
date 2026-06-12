import { plainStyling, type Styling } from "./styling.js";

export type DiagnosticSeverity = "warn" | "error";

export function splitMessageLines(message: string): readonly string[] {
  return message.split(/\r?\n/);
}

export function formatDiagnosticLines(
  severity: DiagnosticSeverity,
  message: string,
  styling: Styling = plainStyling,
): readonly string[] {
  const badge = severity === "warn" ? styling.warnBadge("[WARN]") : styling.errorBadge("[ERROR]");
  return splitMessageLines(message).map((line) => `${badge} ${line}`);
}

export function writeDiagnosticLines(
  writeLine: (line: string) => void,
  severity: DiagnosticSeverity,
  message: string,
  styling: Styling = plainStyling,
): void {
  for (const line of formatDiagnosticLines(severity, message, styling)) {
    writeLine(line);
  }
}
