export class CaseIO {
  failures: unknown[];
  run<T>(name: string, end: number, operation: (signal: AbortSignal) => Promise<T>): Promise<T>;
  snapshot(): Array<{ name: string; settlement: string }>;
}
