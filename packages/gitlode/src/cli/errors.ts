export type BootstrapTermination =
  | { kind: "success"; exitCode: 0 }
  | { kind: "user-error"; message: string; exitCode: 1 };

export class TerminationSignal extends Error {
  readonly termination: BootstrapTermination;

  constructor(termination: BootstrapTermination) {
    super(getTerminationMessage(termination));
    this.name = "TerminationSignal";
    this.termination = termination;
  }
}

function getTerminationMessage(termination: BootstrapTermination): string {
  if (termination.kind === "user-error") {
    return termination.message;
  }
  return "Bootstrap terminated successfully";
}
