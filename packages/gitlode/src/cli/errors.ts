export type BootstrapResult<Value = void> =
  | { kind: "success"; value: Value }
  | BootstrapTermination;

export type BootstrapTermination =
  | { kind: "success-terminate"; exitCode: 0 }
  | { kind: "user-error"; message: string; exitCode: 1 };
