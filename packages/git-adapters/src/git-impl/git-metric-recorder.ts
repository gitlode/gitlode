import {
  createMonotonicTiming,
  getTelemetryAttributeMetadata,
  getTelemetryMetricMetadata,
  type MonotonicTiming,
  type TelemetryAttributeValue,
  type TimingToken,
} from "@gitlode/internal-contracts/telemetry";
import type { Meter } from "@opentelemetry/api";

export type GitAdapterMetricIdentity = TelemetryAttributeValue<"git_adapter">;
export type GitCommitWalkStrategy = TelemetryAttributeValue<"git_commit_walk_strategy">;
export type GitObjectType = TelemetryAttributeValue<"git_object_type">;
export type GitObjectPurpose = TelemetryAttributeValue<"git_object_purpose">;
export type GitFileChangeType = TelemetryAttributeValue<"git_file_change_type">;
export type GitObjectCacheResult = "hit" | "miss";
export type GitBlobReadOutcome = TelemetryAttributeValue<"git_blob_read_outcome">;
type SuccessfulGitBlobReadOutcome = Extract<GitBlobReadOutcome, "success">;
type UnsuccessfulGitBlobReadOutcome = Exclude<GitBlobReadOutcome, SuccessfulGitBlobReadOutcome>;
export type GitBlobReadCompletion =
  | {
      readonly outcome: SuccessfulGitBlobReadOutcome;
      readonly purpose: GitObjectPurpose;
      readonly sizeBytes: number;
    }
  | { readonly outcome: UnsuccessfulGitBlobReadOutcome };

export interface GitMetricRecorder {
  recordCommitYielded(strategy: GitCommitWalkStrategy, hasExclusion: boolean): void;
  recordCommitObjectRead(purpose: GitObjectPurpose): void;
  recordObjectCacheLookup(
    type: GitObjectType,
    purpose: GitObjectPurpose,
    result: GitObjectCacheResult,
  ): void;
  recordFileChangeYielded(type: GitFileChangeType): void;
  startBlobRead(): TimingToken;
  completeBlobRead(token: TimingToken, completion: GitBlobReadCompletion): void;
}

const noopTiming = createMonotonicTiming();
const noopToken = noopTiming.start(false);
export const NOOP_GIT_METRIC_RECORDER = Object.freeze<GitMetricRecorder>({
  recordCommitYielded() {},
  recordCommitObjectRead() {},
  recordObjectCacheLookup() {},
  recordFileChangeYielded() {},
  startBlobRead: () => noopToken,
  completeBlobRead() {},
});

const key = (id: Parameters<typeof getTelemetryAttributeMetadata>[0]) =>
  getTelemetryAttributeMetadata(id).key;
const options = (id: Parameters<typeof getTelemetryMetricMetadata>[0]) => {
  const m = getTelemetryMetricMetadata(id);
  return { m, options: { description: m.description, unit: m.unit } };
};

export function createGitMetricRecorder(
  meter: Meter,
  adapter: GitAdapterMetricIdentity,
  timing: MonotonicTiming = createMonotonicTiming(),
): GitMetricRecorder {
  const counter = (id: Parameters<typeof getTelemetryMetricMetadata>[0]) => {
    const { m, options: o } = options(id);
    return meter.createCounter(m.name, o);
  };
  const histogram = (id: Parameters<typeof getTelemetryMetricMetadata>[0]) => {
    const { m, options: o } = options(id);
    return meter.createHistogram(m.name, {
      ...o,
      advice: {
        explicitBucketBoundaries: [
          ...("explicitBucketBoundaries" in m ? m.explicitBucketBoundaries : []),
        ],
      },
    });
  };
  const commitYielded = counter("git_commit_yielded"),
    objectRead = counter("git_object_read"),
    cacheLookup = counter("git_object_cache_lookup"),
    cacheHit = counter("git_object_cache_hit"),
    fileChange = counter("git_file_change_yielded"),
    duration = histogram("git_blob_read_duration"),
    size = histogram("git_blob_read_size"),
    bytes = counter("git_blob_read_byte");
  const adapterAttrs = { [key("git_adapter")]: adapter };
  const objectAttrs = (type: GitObjectType, purpose: GitObjectPurpose) => ({
    ...adapterAttrs,
    [key("git_object_type")]: type,
    [key("git_object_purpose")]: purpose,
  });
  return {
    recordCommitYielded(strategy, hasExclusion) {
      commitYielded.add(1, {
        ...adapterAttrs,
        [key("git_commit_walk_strategy")]: strategy,
        [key("git_commit_walk_has_exclusion")]: hasExclusion,
      });
    },
    recordCommitObjectRead(purpose) {
      objectRead.add(1, objectAttrs("commit", purpose));
    },
    recordObjectCacheLookup(type, purpose, result) {
      const attrs = objectAttrs(type, purpose);
      cacheLookup.add(1, attrs);
      if (result === "hit") cacheHit.add(1, attrs);
    },
    recordFileChangeYielded(type) {
      fileChange.add(1, { ...adapterAttrs, [key("git_file_change_type")]: type });
    },
    startBlobRead: () => timing.start(true),
    completeBlobRead(token, completion) {
      const c = timing.complete(token);
      if (!c.firstCompletion) return;
      const outcomeAttrs = { ...adapterAttrs, [key("git_blob_read_outcome")]: completion.outcome };
      if (c.durationSeconds !== null) duration.record(c.durationSeconds, outcomeAttrs);
      if (completion.outcome === "error") return;
      objectRead.add(1, objectAttrs("blob", completion.purpose));
      if (Number.isFinite(completion.sizeBytes) && completion.sizeBytes >= 0) {
        size.record(completion.sizeBytes, adapterAttrs);
        if (completion.sizeBytes > 0) bytes.add(completion.sizeBytes, adapterAttrs);
      }
    },
  };
}
