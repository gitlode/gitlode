export type DiagnosticSeverity = "warn" | "error";

export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly message: string;
}

export interface DiagnosticReporter {
  report(diagnostic: Diagnostic): void;
}
