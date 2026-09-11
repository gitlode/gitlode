import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  requiredTelemetryPerformanceComparisons,
  requiredTelemetryPerformanceTargets,
} from "./tooling/telemetry-performance-targets.js";

const execFileAsync = promisify(execFile);
const acceptancePath = ".release/telemetry-migration-acceptance.json";
const oidPattern = /^[0-9a-f]{40}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

type JsonObject = Record<string, unknown>;
type GitRunner = (args: readonly string[]) => Promise<string>;

export interface AcceptanceValidationOptions {
  readonly environment?: NodeJS.ProcessEnv;
  readonly git?: GitRunner;
}

function object(value: unknown, label: string, fields: readonly string[]): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  const result = value as JsonObject;
  const unknown = Object.keys(result).filter((key) => !fields.includes(key));
  if (unknown.length) throw new Error(`${label} has unknown field: ${unknown[0]}`);
  return result;
}

function exactString(value: unknown, expected: string, label: string): void {
  if (value !== expected) throw new Error(`${label} must be ${expected}`);
}

function nonempty(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`${label} must be a non-empty string`);
  return value;
}

function oid(value: unknown, label: string): string {
  const result = nonempty(value, label);
  if (!oidPattern.test(result)) throw new Error(`${label} must be a full lowercase Git OID`);
  return result;
}

function sha256(value: unknown, label: string): void {
  if (typeof value !== "string" || !sha256Pattern.test(value))
    throw new Error(`${label} must be a lowercase SHA-256`);
}

function attestation(value: unknown, label: string, candidateOid: string): void {
  const item = object(value, label, [
    "candidateOid",
    "evidenceId",
    "archiveId",
    "sha256",
    "reviewer",
    "reviewedAt",
  ]);
  if (oid(item.candidateOid, `${label}.candidateOid`) !== candidateOid)
    throw new Error(`${label}.candidateOid does not match candidate.oid`);
  nonempty(item.evidenceId, `${label}.evidenceId`);
  nonempty(item.archiveId, `${label}.archiveId`);
  sha256(item.sha256, `${label}.sha256`);
  nonempty(item.reviewer, `${label}.reviewer`);
  const reviewedAt = nonempty(item.reviewedAt, `${label}.reviewedAt`);
  const parsedDate = new Date(`${reviewedAt}T00:00:00Z`);
  if (
    !datePattern.test(reviewedAt) ||
    Number.isNaN(parsedDate.valueOf()) ||
    parsedDate.toISOString().slice(0, 10) !== reviewedAt
  )
    throw new Error(`${label}.reviewedAt must be an ISO calendar date`);
}

function exception(
  value: unknown,
  label: string,
  candidateOid: string,
  expectedTarget?: string,
): void {
  const item = object(value, label, [
    "fixture",
    "adapter",
    "measuredResult",
    "cause",
    "acceptanceRationale",
    "impact",
    "reevaluationCondition",
    "releaseAuthorityApproval",
  ]);
  for (const key of [
    "measuredResult",
    "cause",
    "acceptanceRationale",
    "impact",
    "reevaluationCondition",
  ] as const)
    nonempty(item[key], `${label}.${key}`);
  const exceptionTarget = `${nonempty(item.fixture, `${label}.fixture`)}/${nonempty(item.adapter, `${label}.adapter`)}`;
  const knownTargets = new Set<string>([
    ...requiredTelemetryPerformanceTargets,
    "aggregation_scale/none",
  ]);
  if (!knownTargets.has(exceptionTarget))
    throw new Error(`${label} has unknown fixture/adapter: ${exceptionTarget}`);
  if (expectedTarget !== undefined && exceptionTarget !== expectedTarget)
    throw new Error(`${label} fixture/adapter does not match ${expectedTarget}`);
  attestation(item.releaseAuthorityApproval, `${label}.releaseAuthorityApproval`, candidateOid);
}

function acceptedResult(
  value: unknown,
  label: string,
  candidateOid: string,
  identityFields: readonly string[] = [],
  expectedExceptionTarget?: string,
): JsonObject {
  const item = object(value, label, ["status", "attestation", "exception", ...identityFields]);
  if (item.status !== "pass" && item.status !== "exception")
    throw new Error(`${label}.status must be pass or exception`);
  attestation(item.attestation, `${label}.attestation`, candidateOid);
  if (item.status === "exception")
    exception(item.exception, `${label}.exception`, candidateOid, expectedExceptionTarget);
  else if ("exception" in item)
    throw new Error(`${label}.exception is only valid for an exception`);
  return item;
}

function acceptedSection(
  value: unknown,
  label: string,
  candidateOid: string,
  identityFields: readonly string[] = [],
): void {
  const item = object(value, label, ["status", "attestation", ...identityFields]);
  exactString(item.status, "accepted", `${label}.status`);
  attestation(item.attestation, `${label}.attestation`, candidateOid);
}

function validateAcceptedRecord(record: JsonObject): string {
  const candidate = object(record.candidate, "candidate", [
    "oid",
    "frozenMigrationCandidateOid",
    "harnessOid",
    "bundleId",
    "bundleSha256",
    "fixtureManifestSha256",
    "attestation",
  ]);
  const candidateOid = oid(candidate.oid, "candidate.oid");
  oid(candidate.frozenMigrationCandidateOid, "candidate.frozenMigrationCandidateOid");
  oid(candidate.harnessOid, "candidate.harnessOid");
  nonempty(candidate.bundleId, "candidate.bundleId");
  sha256(candidate.bundleSha256, "candidate.bundleSha256");
  sha256(candidate.fixtureManifestSha256, "candidate.fixtureManifestSha256");
  attestation(candidate.attestation, "candidate.attestation", candidateOid);

  const performance = object(record.performance, "performance", [
    "comparisons",
    "aggregationScale",
    "traceVolume",
  ]);
  if (!Array.isArray(performance.comparisons))
    throw new Error("performance.comparisons must be an array");
  const expected = new Set(
    requiredTelemetryPerformanceTargets.flatMap((target) =>
      requiredTelemetryPerformanceComparisons.map((comparison) => `${target}:${comparison}`),
    ),
  );
  const actual = new Set<string>();
  for (const [index, value] of performance.comparisons.entries()) {
    const label = `performance.comparisons[${index}]`;
    const item = object(value, label, [
      "target",
      "comparison",
      "status",
      "attestation",
      "exception",
    ]);
    const target = nonempty(item.target, `${label}.target`);
    const comparison = nonempty(item.comparison, `${label}.comparison`);
    const identity = `${target}:${comparison}`;
    if (!expected.has(identity))
      throw new Error(`${label} has unknown matrix identity: ${identity}`);
    if (actual.has(identity)) throw new Error(`duplicate performance comparison: ${identity}`);
    actual.add(identity);
    acceptedResult(item, label, candidateOid, ["target", "comparison"], target);
  }
  const missing = [...expected].filter((identity) => !actual.has(identity));
  if (missing.length) throw new Error(`missing performance comparison: ${missing[0]}`);
  acceptedResult(
    performance.aggregationScale,
    "performance.aggregationScale",
    candidateOid,
    [],
    "aggregation_scale/none",
  );
  acceptedResult(performance.traceVolume, "performance.traceVolume", candidateOid);

  const readability = object(record.profileReadability, "profileReadability", ["cases"]);
  if (!Array.isArray(readability.cases))
    throw new Error("profileReadability.cases must be an array");
  const requiredCases = new Set(["commit", "file", "plugin", "partial", "unavailable"]);
  const cases = new Set<string>();
  for (const [index, value] of readability.cases.entries()) {
    const label = `profileReadability.cases[${index}]`;
    const item = object(value, label, ["case", "status", "attestation"]);
    const identity = nonempty(item.case, `${label}.case`);
    if (!requiredCases.has(identity)) throw new Error(`${label} has unknown case: ${identity}`);
    if (cases.has(identity)) throw new Error(`duplicate profile readability case: ${identity}`);
    cases.add(identity);
    acceptedSection(item, label, candidateOid, ["case"]);
  }
  const missingCase = [...requiredCases].find((identity) => !cases.has(identity));
  if (missingCase) throw new Error(`missing profile readability case: ${missingCase}`);

  acceptedSection(record.systemTestOrganization, "systemTestOrganization", candidateOid);
  acceptedSection(record.contributorNavigation, "contributorNavigation", candidateOid);

  const finalValidation = object(record.finalValidation, "finalValidation", [
    "windows",
    "linux",
    "bundleIdentity",
  ]);
  for (const platform of ["windows", "linux"] as const) {
    const item = object(finalValidation[platform], `finalValidation.${platform}`, [
      "functional",
      "installedPackage",
    ]);
    acceptedSection(item.functional, `finalValidation.${platform}.functional`, candidateOid);
    acceptedSection(
      item.installedPackage,
      `finalValidation.${platform}.installedPackage`,
      candidateOid,
    );
  }
  const bundleIdentity = object(finalValidation.bundleIdentity, "finalValidation.bundleIdentity", [
    "bundleId",
    "sha256",
    "attestation",
  ]);
  if (
    nonempty(bundleIdentity.bundleId, "finalValidation.bundleIdentity.bundleId") !==
    candidate.bundleId
  )
    throw new Error("finalValidation.bundleIdentity.bundleId does not match candidate.bundleId");
  sha256(bundleIdentity.sha256, "finalValidation.bundleIdentity.sha256");
  if (bundleIdentity.sha256 !== candidate.bundleSha256)
    throw new Error("finalValidation.bundleIdentity.sha256 does not match candidate.bundleSha256");
  attestation(
    bundleIdentity.attestation,
    "finalValidation.bundleIdentity.attestation",
    candidateOid,
  );

  const delta = object(record.deltaAssessment, "deltaAssessment", [
    "status",
    "fromFrozenMigrationCandidateOid",
    "justification",
    "attestation",
  ]);
  exactString(delta.status, "accepted", "deltaAssessment.status");
  if (
    oid(
      delta.fromFrozenMigrationCandidateOid,
      "deltaAssessment.fromFrozenMigrationCandidateOid",
    ) !== candidate.frozenMigrationCandidateOid
  )
    throw new Error("deltaAssessment frozen candidate does not match candidate provenance");
  nonempty(delta.justification, "deltaAssessment.justification");
  attestation(delta.attestation, "deltaAssessment.attestation", candidateOid);
  acceptedSection(record.t13c, "t13c", candidateOid);
  acceptedSection(record.releaseAuthority, "releaseAuthority", candidateOid);
  return candidateOid;
}

function parseRecord(
  text: string,
): { readonly state: "blocked" } | { readonly state: "accepted"; readonly candidateOid: string } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("acceptance record is malformed JSON");
  }
  const base = object(value, "acceptance record", [
    "schemaVersion",
    "state",
    "reason",
    "candidate",
    "performance",
    "profileReadability",
    "systemTestOrganization",
    "contributorNavigation",
    "finalValidation",
    "deltaAssessment",
    "t13c",
    "releaseAuthority",
  ]);
  if (base.schemaVersion !== 1) throw new Error("acceptance record schemaVersion must be 1");
  if (base.state === "blocked") {
    const blocked = object(value, "blocked acceptance record", [
      "schemaVersion",
      "state",
      "reason",
    ]);
    nonempty(blocked.reason, "blocked acceptance record.reason");
    return { state: "blocked" };
  }
  if (base.state !== "accepted")
    throw new Error("acceptance record state must be blocked or accepted");
  object(value, "accepted acceptance record", [
    "schemaVersion",
    "state",
    "candidate",
    "performance",
    "profileReadability",
    "systemTestOrganization",
    "contributorNavigation",
    "finalValidation",
    "deltaAssessment",
    "t13c",
    "releaseAuthority",
  ]);
  return { state: "accepted", candidateOid: validateAcceptedRecord(base) };
}

function defaultGit(repositoryRoot: string): GitRunner {
  return async (args) => {
    const { stdout } = await execFileAsync(
      "git",
      ["-c", `safe.directory=${repositoryRoot}`, "-C", repositoryRoot, ...args],
      { encoding: "utf8" },
    );
    return stdout.trim();
  };
}

async function validatePublishingContext(
  git: GitRunner,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  if (environment.GITHUB_ACTIONS === "true") {
    if (environment.GITHUB_REF !== "refs/heads/main")
      throw new Error("Actions publishing is allowed only from refs/heads/main");
    return;
  }
  let branch: string;
  try {
    branch = await git(["symbolic-ref", "--quiet", "--short", "HEAD"]);
  } catch {
    throw new Error("local publishing requires an attached main branch");
  }
  if (branch !== "main") throw new Error("local publishing is allowed only from the main branch");
}

export async function validateTelemetryReleaseAcceptance(
  repositoryRoot: string,
  options: AcceptanceValidationOptions = {},
): Promise<void> {
  const git = options.git ?? defaultGit(repositoryRoot);
  const environment = options.environment ?? process.env;
  await validatePublishingContext(git, environment);
  let text: string;
  try {
    text = await readFile(resolve(repositoryRoot, acceptancePath), "utf8");
  } catch {
    throw new Error(`acceptance record is absent or unreadable: ${acceptancePath}`);
  }
  const record = parseRecord(text);
  if (record.state === "blocked")
    throw new Error("telemetry migration release acceptance is blocked");
  try {
    await git(["cat-file", "-e", `${record.candidateOid}^{commit}`]);
    await git(["merge-base", "--is-ancestor", record.candidateOid, "HEAD"]);
  } catch {
    throw new Error("candidate commit is missing or is not an ancestor of the publish checkout");
  }
  let changedOutput: string;
  try {
    changedOutput = await git(["diff", "--name-only", record.candidateOid, "HEAD", "--"]);
  } catch {
    throw new Error("candidate and publish trees could not be compared");
  }
  const changed = changedOutput.split(/\r?\n/).filter(Boolean);
  const prohibited = changed.find((path) => path !== acceptancePath);
  if (prohibited)
    throw new Error(`publish tree differs from candidate outside acceptance record: ${prohibited}`);
  let statusOutput: string;
  try {
    statusOutput = await git(["status", "--porcelain=v1", "--untracked-files=all"]);
  } catch {
    throw new Error("publish checkout status could not be verified");
  }
  const dirty = statusOutput.split(/\r?\n/).find(Boolean);
  if (dirty) throw new Error(`publish checkout has uncommitted or untracked changes: ${dirty}`);
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateTelemetryReleaseAcceptance(repositoryRoot).then(
    () => process.stdout.write("Telemetry migration release acceptance verified.\n"),
    (error: unknown) => {
      const reason = error instanceof Error ? error.message : "unknown validation failure";
      process.stderr.write(`Telemetry publish gate blocked: ${reason}\n`);
      process.exitCode = 1;
    },
  );
}
