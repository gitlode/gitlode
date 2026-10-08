import { writeFile } from "node:fs/promises";
import { join } from "node:path";

// These files execute in the installed consumer, never in the repository module graph.
export async function writeInstalledLoadGuard(directory: string): Promise<string> {
  const loader = join(directory, "load-guard-loader.mjs");
  const preload = join(directory, "load-guard.mjs");
  await writeFile(
    loader,
    String.raw`
import { appendFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
let settings;
export function initialize(data) { settings = data; }
function record(event) { appendFileSync(settings.log, JSON.stringify({ isolate: settings.isolate, ...event }) + '\n'); }
const forbidden = value => {
  const normalized = decodeURIComponent(value).replaceAll('\\', '/');
  return /@opentelemetry\/(?:sdk-|context-)/.test(normalized) || settings.sdkOwners.some(owner => normalized === owner.name || normalized.startsWith(owner.name + '/') || normalized.includes(owner.directory + '/'));
};
export async function resolve(specifier, context, next) {
  if (specifier === 'gitlode-guard-probe') { record({ type: 'esm-active' }); throw new Error('guard probe'); }
  record({ type: 'esm-resolve', specifier, parent: context.parentURL ?? null });
  if (settings.deny && forbidden(specifier)) { record({ type: 'denied', specifier }); throw new Error('guard denied'); }
  const result = await next(specifier, context);
  if (settings.deny && forbidden(result.url)) { record({ type: 'denied', specifier: result.url }); throw new Error('guard denied'); }
  return result;
}
export async function load(url, context, next) {
  if (settings.deny && forbidden(url)) { record({ type: 'denied', specifier: url }); throw new Error('guard denied'); }
  const result = await next(url, context);
  record({ type: 'esm-load', url, realpath: url.startsWith('file:') ? realpathSync(fileURLToPath(url)) : null });
  return result;
}
`,
  );
  await writeFile(
    preload,
    String.raw`
import { appendFileSync, realpathSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import Module, { createRequire, register, syncBuiltinESMExports } from 'node:module';
import * as threads from 'node:worker_threads';
const log = process.env.GITLODE_LOAD_LOG;
const isolate = threads.threadId;
const deny = process.env.GITLODE_DENY_SDK === '1';
const record = event => appendFileSync(log, JSON.stringify({ isolate, ...event }) + '\n');
const sdkOwners = [];
const visited = new Set();
function inventory(name, from) {
  if (name === '@opentelemetry/api') return;
  const manifestPath = from.resolve.paths(name).map(base => join(base, name, 'package.json')).find(path => existsSync(path));
  if (!manifestPath) throw new Error('SDK dependency owner missing: ' + name);
  const directory = dirname(realpathSync(manifestPath));
  if (visited.has(directory)) return;
  visited.add(directory);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  sdkOwners.push({ name: manifest.name, version: manifest.version, directory: directory.replaceAll('\\', '/') });
  for (const dependency of Object.keys(manifest.dependencies ?? {})) inventory(dependency, createRequire(manifestPath));
}
const consumerRequire = createRequire(import.meta.url);
for (const name of ['@opentelemetry/sdk-metrics', '@opentelemetry/sdk-trace-base', '@opentelemetry/context-async-hooks']) inventory(name, consumerRequire);
record({ type: 'sdk-inventory', owners: sdkOwners });
const forbidden = value => {
  const normalized = decodeURIComponent(value).replaceAll('\\', '/');
  return /@opentelemetry\/(?:sdk-|context-)/.test(normalized) || sdkOwners.some(owner => normalized === owner.name || normalized.startsWith(owner.name + '/') || normalized.includes(owner.directory + '/'));
};
const originalLoad = Module._load;
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(specifier, parent, ...rest) {
  if (specifier === 'gitlode-guard-probe') { record({ type: 'cjs-resolve-active' }); throw new Error('guard probe'); }
  const resolved = originalResolve.call(this, specifier, parent, ...rest);
  record({ type: 'cjs-resolve', specifier, resolved, parent: parent?.filename ?? null });
  if (deny && (forbidden(specifier) || forbidden(resolved))) { record({ type: 'denied', specifier }); throw new Error('guard denied'); }
  return resolved;
};
Module._load = function(specifier, parent, ...rest) {
  if (specifier === 'gitlode-guard-probe') { record({ type: 'cjs-active' }); throw new Error('guard probe'); }
  const resolved = originalResolve.call(this, specifier, parent, false);
  if (deny && (forbidden(specifier) || forbidden(resolved))) { record({ type: 'denied', specifier }); throw new Error('guard denied'); }
  const result = originalLoad.call(this, specifier, parent, ...rest);
  record({ type: 'cjs-load', specifier, resolved, realpath: Module.isBuiltin(resolved) ? null : realpathSync(resolved), parent: parent?.filename ?? null });
  return result;
};
const localRequire = createRequire(import.meta.url);
try { localRequire('gitlode-guard-probe'); } catch {}
try { localRequire.resolve('gitlode-guard-probe'); } catch {}
register(new URL('./load-guard-loader.mjs', import.meta.url), { data: { log, isolate, deny, sdkOwners } });
try { await import('gitlode-guard-probe'); } catch {}
// Observe the actual public CLI's worker messages without changing product entrypoints.
if (threads.isMainThread) {
  const workerModule = localRequire('node:worker_threads');
  const OriginalWorker = workerModule.Worker;
  workerModule.Worker = class extends OriginalWorker {
    constructor(...args) {
      super(...args);
      this.on('message', message => {
        if (message?.type === 'result') record({ type: 'worker-result', result: message.result });
        if (message?.type === 'diagnostic') record({ type: 'worker-diagnostic', diagnostic: message.diagnostic });
      });
    }
  };
  syncBuiltinESMExports();
}
record({ type: 'preload-active', node: process.version });
`,
  );
  return preload;
}

export interface LoadEvent {
  isolate: number;
  type: string;
  specifier?: string;
  url?: string;
  resolved?: string;
  realpath?: string;
  parent?: string;
  owners?: { name: string; version: string; directory: string }[];
  result?: { kind: string; success?: { profileReport?: unknown } };
  diagnostic?: { severity?: string; message?: string };
}

export function assertGuardActivation(events: readonly LoadEvent[]): void {
  const isolates = [
    ...new Set(
      events.filter((event) => event.type === "preload-active").map((event) => event.isolate),
    ),
  ];
  if (!isolates.includes(0) || !isolates.some((isolate) => isolate > 0)) {
    throw new Error("Load guard did not observe actual CLI host and worker");
  }
  for (const isolate of isolates) {
    for (const type of ["esm-active", "cjs-active", "cjs-resolve-active"]) {
      if (!events.some((event) => event.isolate === isolate && event.type === type)) {
        throw new Error(`Inactive ${type} guard in isolate ${isolate}`);
      }
    }
  }
}

export function assertEnabledReport(events: readonly LoadEvent[]): void {
  const result = events.find((event) => event.type === "worker-result")?.result;
  const report = result?.success?.profileReport as
    | {
        schemaVersion?: number;
        signalStatus?: Record<string, string>;
        spans?: { name: string; callCount: number; totalDurationSeconds: number }[];
        counters?: { name: string; value: number }[];
        histograms?: { name: string; count: number; sum: number }[];
        diagnostics?: unknown[];
      }
    | undefined;
  if (
    result?.kind !== "success" ||
    report?.schemaVersion !== 2 ||
    !["spans", "counters", "histograms"].every(
      (signal) => report.signalStatus?.[signal] === "complete",
    ) ||
    report.diagnostics?.length !== 0 ||
    !report.spans?.length ||
    !report.counters?.length ||
    !report.histograms?.length ||
    !report.spans.every(
      (span) =>
        span.name.startsWith("gitlode.") &&
        span.callCount > 0 &&
        Number.isFinite(span.totalDurationSeconds) &&
        span.totalDurationSeconds >= 0,
    ) ||
    !report.counters.every((point) => Number.isFinite(point.value)) ||
    !report.histograms.every((point) => Number.isFinite(point.sum) && point.count >= 0)
  ) {
    throw new Error(
      "Installed Enabled telemetry did not produce a complete schema-2 report with observations",
    );
  }
}

export function sdkEvents(events: readonly LoadEvent[]): LoadEvent[] {
  const owners = events.find((event) => event.type === "sdk-inventory")?.owners;
  if (!owners?.length) throw new Error("Missing installed SDK dependency inventory");
  return events.filter((event) =>
    [event.specifier, event.url, event.resolved, event.realpath].some((value) => {
      if (!value) return false;
      const normalized = decodeURIComponent(value).replaceAll("\\", "/");
      return owners.some(
        (owner) =>
          normalized === owner.name ||
          normalized.startsWith(owner.name + "/") ||
          normalized.includes(owner.directory + "/"),
      );
    }),
  );
}
