export type BootstrapTermination =
  | { kind: "success"; exitCode: 0 }
  | { kind: "user-error"; message: string; exitCode: 1 };
