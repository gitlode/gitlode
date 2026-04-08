export type GitAdapterErrorCode =
  | "REF_NOT_FOUND"
  | "COMMIT_NOT_FOUND"
  | "NOT_A_REPOSITORY"
  | "REMOTE_NOT_FOUND"
  | "UNKNOWN";

export class GitAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: GitAdapterErrorCode,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GitAdapterError";
  }
}
