import type { Diagnostic, DiagnosticSeverity } from "../diagnostics/index.js";
import { plainStyling, type Styling } from "./styling.js";

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
  diagnostic: Diagnostic,
  styling: Styling = plainStyling,
): void {
  for (const line of formatDiagnosticLines(diagnostic.severity, diagnostic.message, styling)) {
    writeLine(line);
  }
}
