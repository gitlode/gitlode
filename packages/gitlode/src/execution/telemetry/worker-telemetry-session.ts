import { context, type Context, type Meter, type Span, type Tracer } from "@opentelemetry/api";

import { createNoopWorkerTelemetry } from "./noop-worker-telemetry.js";
import type {
  WorkerTelemetryBackend,
  WorkerTelemetryFinalization,
  WorkerTelemetryInitializationWarning,
  WorkerTelemetryTestHooks,
} from "./worker-telemetry-contract.js";

export type {
  WorkerTelemetryFinalization,
  WorkerTelemetryInitializationWarning,
  WorkerTelemetryTestAttempt,
  WorkerTelemetryTestHooks,
} from "./worker-telemetry-contract.js";

export class WorkerTelemetrySession {
  readonly #backend: WorkerTelemetryBackend;
  readonly #initializationWarning?: WorkerTelemetryInitializationWarning;
  #finalizationPromise?: Promise<WorkerTelemetryFinalization<unknown>>;

  constructor(construction: {
    backend: WorkerTelemetryBackend;
    initializationWarning?: WorkerTelemetryInitializationWarning;
  }) {
    this.#backend = construction.backend;
    this.#initializationWarning = construction.initializationWarning;
  }

  static create(enabled = true): Promise<WorkerTelemetrySession> {
    return createSession(enabled);
  }

  getTracer(scopeName: string, scopeVersion?: string): Tracer {
    return this.#backend.getTracer(scopeName, scopeVersion);
  }

  getMeter(scopeName: string, scopeVersion?: string): Meter {
    return this.#backend.getMeter(scopeName, scopeVersion);
  }

  get rootSpan(): Span {
    return this.#backend.rootSpan;
  }
  get rootContext(): Context {
    return this.#backend.rootContext;
  }
  get recordingEnabled(): boolean {
    return this.#backend.recordingEnabled;
  }

  runInRootContext<Value>(callback: () => Value): Value {
    return context.with(this.rootContext, callback);
  }

  finalize<Result>(applicationResult: Result): Promise<WorkerTelemetryFinalization<Result>> {
    // Store the promise before lifecycle hooks can reenter finalize().
    this.#finalizationPromise ??= Promise.resolve().then(async () => {
      const profileReport = await this.#backend.finalize();
      return {
        applicationResult,
        ...(this.#initializationWarning
          ? { initializationWarning: this.#initializationWarning }
          : {}),
        ...(profileReport ? { profileReport } : {}),
      };
    });
    return this.#finalizationPromise as Promise<WorkerTelemetryFinalization<Result>>;
  }
}

async function createSession(
  enabled: boolean,
  hooks?: WorkerTelemetryTestHooks,
): Promise<WorkerTelemetrySession> {
  if (!enabled) return new WorkerTelemetrySession({ backend: createNoopWorkerTelemetry() });
  try {
    hooks?.onAttempt?.("enabled_module_import");
    if (Object.prototype.hasOwnProperty.call(hooks?.failures ?? {}, "enabled_module_import"))
      throw hooks?.failures?.enabled_module_import;
    const module = await (hooks?.loadEnabledModule?.() ?? import("./enabled-worker-telemetry.js"));
    return new WorkerTelemetrySession({ backend: await module.createEnabledBackend(hooks) });
  } catch {
    return new WorkerTelemetrySession({
      backend: createNoopWorkerTelemetry(),
      initializationWarning: { code: "telemetry_initialization_failed", message: null },
    });
  }
}

export function createWorkerTelemetrySessionForTest(
  hooks: WorkerTelemetryTestHooks,
  enabled = true,
): Promise<WorkerTelemetrySession> {
  return createSession(enabled, hooks);
}
