export type GitAdapterErrorCode =
  | "REF_NOT_FOUND"
  | "COMMIT_NOT_FOUND"
  | "NOT_A_REPOSITORY"
  | "UNSUPPORTED_OBJECT_FORMAT"
  | "REMOTE_NOT_FOUND"
  | "MERGE_BASE_NOT_FOUND"
  | "UNKNOWN";

export class GitAdapterError extends Error {
  public readonly code: GitAdapterErrorCode;
  public override readonly cause?: unknown;
  constructor(message: string, code: GitAdapterErrorCode, cause?: unknown) {
    super(message);
    this.name = "GitAdapterError";
    this.code = code;
    this.cause = cause;
  }
}
