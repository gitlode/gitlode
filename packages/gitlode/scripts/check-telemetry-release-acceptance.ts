import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  requiredTelemetryAggregationChecks,
  requiredTelemetryGitCommandParityTargets,
  requiredTelemetryPerformanceComparisons,
  requiredTelemetryPerformanceTargets,
  requiredTelemetryRepositoryChecks,
} from "./tooling/telemetry-performance-targets.js";

const execFileAsync = promisify(execFile);
const acceptancePath = ".release/telemetry-migration-acceptance.json";
const oidPattern = /^[0-9a-f]{40}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

type JsonObject = Record<string, unknown>;
type GitRunner = (args: readonly string[]) => Promise<string>;
type EvidenceKind = "baseline" | "redesigned";

interface EvidenceProvenance {
  readonly label: string;
  readonly evidenceId: string;
  readonly sourceProductOid: string;
  readonly harnessOid: string;
  readonly candidateOid: string;
  readonly kind: EvidenceKind;
}

interface EvidenceReuse {
  readonly label: string;
  readonly evidenceId: string;
  readonly sourceProductOid: string;
  readonly sourceHarnessOid: string;
  readonly destinationCandidateOid: string;
}

interface AcceptedRecord {
  readonly candidateOid: string;
  readonly frozenMigrationCandidateOid: string;
  readonly legacyBaselineOid: string;
  readonly candidateHarnessOid: string;
  readonly evidence: readonly EvidenceProvenance[];
  readonly reuse: readonly EvidenceReuse[];
}

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

function sha256(value: unknown, label: string): string {
  if (typeof value !== "string" || !sha256Pattern.test(value))
    throw new Error(`${label} must be a lowercase SHA-256`);
  return value;
}

function validateAttestationDetails(item: JsonObject, label: string): string {
  const evidenceId = nonempty(item.evidenceId, `${label}.evidenceId`);
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
  return evidenceId;
}

function reviewAttestation(value: unknown, label: string, candidateOid: string): void {
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
  validateAttestationDetails(item, label);
}

function evidenceAttestation(
  value: unknown,
  label: string,
  candidateOid: string,
  kind: EvidenceKind,
): EvidenceProvenance {
  const item = object(value, label, [
    "candidateOid",
    "sourceProductOid",
    "harnessOid",
    "evidenceId",
    "archiveId",
    "sha256",
    "reviewer",
    "reviewedAt",
  ]);
  const destination = oid(item.candidateOid, `${label}.candidateOid`);
  if (destination !== candidateOid)
    throw new Error(`${label}.candidateOid does not match candidate.oid`);
  return {
    label,
    evidenceId: validateAttestationDetails(item, label),
    sourceProductOid: oid(item.sourceProductOid, `${label}.sourceProductOid`),
    harnessOid: oid(item.harnessOid, `${label}.harnessOid`),
    candidateOid: destination,
    kind,
  };
}

function performanceException(
  value: unknown,
  label: string,
  candidateOid: string,
  expectedTarget: string,
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
  const target = `${nonempty(item.fixture, `${label}.fixture`)}/${nonempty(item.adapter, `${label}.adapter`)}`;
  if (target !== expectedTarget)
    throw new Error(`${label} fixture/adapter does not match ${expectedTarget}`);
  reviewAttestation(
    item.releaseAuthorityApproval,
    `${label}.releaseAuthorityApproval`,
    candidateOid,
  );
}

function validatePerformanceOutcome(
  item: JsonObject,
  label: string,
  candidateOid: string,
  expectedTarget: string,
): "pass" | "exception" {
  if (item.status !== "pass" && item.status !== "exception")
    throw new Error(`${label}.status must be pass or exception`);
  if (item.status === "exception")
    performanceException(item.exception, `${label}.exception`, candidateOid, expectedTarget);
  else if ("exception" in item)
    throw new Error(`${label}.exception is only valid for an exception`);
  return item.status;
}

function acceptedSection(
  value: unknown,
  label: string,
  candidateOid: string,
  identityFields: readonly string[] = [],
): void {
  const item = object(value, label, ["status", "attestation", ...identityFields]);
  exactString(item.status, "accepted", `${label}.status`);
  reviewAttestation(item.attestation, `${label}.attestation`, candidateOid);
}

function requiredCheckIdentities(): Set<string> {
  const result = new Set<string>();
  for (const check of requiredTelemetryAggregationChecks)
    result.add(`${check}:aggregation_scale/none:n_to_4n`);
  for (const target of requiredTelemetryPerformanceTargets)
    for (const check of requiredTelemetryRepositoryChecks)
      result.add(`${check}:${target}:target_on`);
  for (const target of requiredTelemetryGitCommandParityTargets)
    result.add(`git_command_parity:${target}:target_on`);
  return result;
}

function validateAcceptedRecord(record: JsonObject): AcceptedRecord {
  const candidate = object(record.candidate, "candidate", [
    "oid",
    "frozenMigrationCandidateOid",
    "legacyBaselineOid",
    "harnessOid",
    "bundleId",
    "bundleSha256",
    "fixtureManifestSha256",
    "attestation",
  ]);
  const candidateOid = oid(candidate.oid, "candidate.oid");
  const frozenMigrationCandidateOid = oid(
    candidate.frozenMigrationCandidateOid,
    "candidate.frozenMigrationCandidateOid",
  );
  const legacyBaselineOid = oid(candidate.legacyBaselineOid, "candidate.legacyBaselineOid");
  const candidateHarnessOid = oid(candidate.harnessOid, "candidate.harnessOid");
  nonempty(candidate.bundleId, "candidate.bundleId");
  sha256(candidate.bundleSha256, "candidate.bundleSha256");
  sha256(candidate.fixtureManifestSha256, "candidate.fixtureManifestSha256");
  reviewAttestation(candidate.attestation, "candidate.attestation", candidateOid);

  const performance = object(record.performance, "performance", [
    "calibrations",
    "legacyCaptures",
    "comparisons",
    "checks",
  ]);
  const evidence: EvidenceProvenance[] = [];
  const evidenceIds = new Set<string>();
  const addEvidence = (item: EvidenceProvenance): void => {
    if (evidenceIds.has(item.evidenceId))
      throw new Error(`duplicate performance evidence identity: ${item.evidenceId}`);
    evidenceIds.add(item.evidenceId);
    evidence.push(item);
  };

  if (!Array.isArray(performance.calibrations))
    throw new Error("performance.calibrations must be an array");
  const calibrations = new Map<string, { evidenceId: string; recipe: string }>();
  for (const [index, value] of performance.calibrations.entries()) {
    const label = `performance.calibrations[${index}]`;
    const item = object(value, label, [
      "target",
      "status",
      "childStatus",
      "behavioralStatus",
      "targetRecipeSha256",
      "attestation",
    ]);
    const target = nonempty(item.target, `${label}.target`);
    if (!(requiredTelemetryPerformanceTargets as readonly string[]).includes(target))
      throw new Error(`${label} has unknown target: ${target}`);
    if (calibrations.has(target)) throw new Error(`duplicate calibration target: ${target}`);
    exactString(item.status, "accepted", `${label}.status`);
    exactString(item.childStatus, "pass", `${label}.childStatus`);
    exactString(item.behavioralStatus, "pass", `${label}.behavioralStatus`);
    const attested = evidenceAttestation(
      item.attestation,
      `${label}.attestation`,
      candidateOid,
      "baseline",
    );
    addEvidence(attested);
    calibrations.set(target, {
      evidenceId: attested.evidenceId,
      recipe: sha256(item.targetRecipeSha256, `${label}.targetRecipeSha256`),
    });
  }
  const missingCalibration = requiredTelemetryPerformanceTargets.find(
    (target) => !calibrations.has(target),
  );
  if (missingCalibration) throw new Error(`missing calibration target: ${missingCalibration}`);

  if (!Array.isArray(performance.legacyCaptures))
    throw new Error("performance.legacyCaptures must be an array");
  const captures = new Map<string, { evidenceId: string; recipe: string }>();
  for (const [index, value] of performance.legacyCaptures.entries()) {
    const label = `performance.legacyCaptures[${index}]`;
    const item = object(value, label, [
      "target",
      "status",
      "behavioralStatus",
      "targetRecipeSha256",
      "calibrationEvidenceId",
      "attestation",
    ]);
    const target = nonempty(item.target, `${label}.target`);
    const calibration = calibrations.get(target);
    if (!calibration) throw new Error(`${label} has unknown target: ${target}`);
    if (captures.has(target)) throw new Error(`duplicate legacy capture target: ${target}`);
    exactString(item.status, "pass", `${label}.status`);
    exactString(item.behavioralStatus, "pass", `${label}.behavioralStatus`);
    exactString(
      item.calibrationEvidenceId,
      calibration.evidenceId,
      `${label}.calibrationEvidenceId`,
    );
    const recipe = sha256(item.targetRecipeSha256, `${label}.targetRecipeSha256`);
    if (recipe !== calibration.recipe)
      throw new Error(`${label}.targetRecipeSha256 does not match calibration`);
    const attested = evidenceAttestation(
      item.attestation,
      `${label}.attestation`,
      candidateOid,
      "baseline",
    );
    addEvidence(attested);
    captures.set(target, { evidenceId: attested.evidenceId, recipe });
  }
  const missingCapture = requiredTelemetryPerformanceTargets.find(
    (target) => !captures.has(target),
  );
  if (missingCapture) throw new Error(`missing legacy capture target: ${missingCapture}`);

  if (!Array.isArray(performance.comparisons))
    throw new Error("performance.comparisons must be an array");
  const expectedComparisons = new Set(
    requiredTelemetryPerformanceTargets.flatMap((target) =>
      requiredTelemetryPerformanceComparisons.map((comparison) => `${target}:${comparison}`),
    ),
  );
  const comparisons = new Map<string, string>();
  for (const [index, value] of performance.comparisons.entries()) {
    const label = `performance.comparisons[${index}]`;
    const item = object(value, label, [
      "target",
      "comparison",
      "status",
      "wallClockStatus",
      "peakRssStatus",
      "behavioralStatus",
      "targetRecipeSha256",
      "calibrationEvidenceId",
      "legacyCaptureEvidenceId",
      "attestation",
      "exception",
    ]);
    const target = nonempty(item.target, `${label}.target`);
    const comparison = nonempty(item.comparison, `${label}.comparison`);
    const identity = `${target}:${comparison}`;
    if (!expectedComparisons.has(identity))
      throw new Error(`${label} has unknown matrix identity: ${identity}`);
    if (comparisons.has(identity)) throw new Error(`duplicate performance comparison: ${identity}`);
    const calibration = calibrations.get(target);
    const capture = captures.get(target);
    if (!calibration || !capture)
      throw new Error(`${label} has no matching calibration and legacy capture`);
    exactString(
      item.calibrationEvidenceId,
      calibration.evidenceId,
      `${label}.calibrationEvidenceId`,
    );
    exactString(
      item.legacyCaptureEvidenceId,
      capture.evidenceId,
      `${label}.legacyCaptureEvidenceId`,
    );
    if (sha256(item.targetRecipeSha256, `${label}.targetRecipeSha256`) !== calibration.recipe)
      throw new Error(`${label}.targetRecipeSha256 does not match calibration`);
    exactString(item.behavioralStatus, "pass", `${label}.behavioralStatus`);
    const status = validatePerformanceOutcome(item, label, candidateOid, target);
    if (item.wallClockStatus !== "pass" && item.wallClockStatus !== "exception")
      throw new Error(`${label}.wallClockStatus must be pass or exception`);
    if (item.peakRssStatus !== "pass" && item.peakRssStatus !== "exception")
      throw new Error(`${label}.peakRssStatus must be pass or exception`);
    const hasException = item.wallClockStatus === "exception" || item.peakRssStatus === "exception";
    if ((status === "exception") !== hasException)
      throw new Error(`${label}.status must reflect wall-clock and peak-RSS outcomes`);
    const attested = evidenceAttestation(
      item.attestation,
      `${label}.attestation`,
      candidateOid,
      "redesigned",
    );
    addEvidence(attested);
    comparisons.set(identity, attested.evidenceId);
  }
  const missingComparison = [...expectedComparisons].find((identity) => !comparisons.has(identity));
  if (missingComparison) throw new Error(`missing performance comparison: ${missingComparison}`);

  if (!Array.isArray(performance.checks)) throw new Error("performance.checks must be an array");
  const expectedChecks = requiredCheckIdentities();
  const actualChecks = new Set<string>();
  for (const [index, value] of performance.checks.entries()) {
    const label = `performance.checks[${index}]`;
    const item = object(value, label, [
      "check",
      "target",
      "scope",
      "status",
      "comparisonEvidenceId",
      "attestation",
      "exception",
    ]);
    const check = nonempty(item.check, `${label}.check`);
    const target = nonempty(item.target, `${label}.target`);
    const scope = nonempty(item.scope, `${label}.scope`);
    const identity = `${check}:${target}:${scope}`;
    if (!expectedChecks.has(identity))
      throw new Error(`${label} has unknown or wrong-scope check identity: ${identity}`);
    if (actualChecks.has(identity)) throw new Error(`duplicate performance check: ${identity}`);
    actualChecks.add(identity);
    validatePerformanceOutcome(item, label, candidateOid, target);
    if (scope === "target_on") {
      const expectedEvidence = comparisons.get(`${target}:profile_overhead`);
      if (!expectedEvidence)
        throw new Error(`${label} has no matching profile-overhead comparison`);
      exactString(item.comparisonEvidenceId, expectedEvidence, `${label}.comparisonEvidenceId`);
    } else if ("comparisonEvidenceId" in item) {
      throw new Error(`${label}.comparisonEvidenceId is not applicable to aggregation`);
    }
    addEvidence(
      evidenceAttestation(item.attestation, `${label}.attestation`, candidateOid, "redesigned"),
    );
  }
  const missingCheck = [...expectedChecks].find((identity) => !actualChecks.has(identity));
  if (missingCheck) throw new Error(`missing performance check: ${missingCheck}`);

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
  if (
    sha256(bundleIdentity.sha256, "finalValidation.bundleIdentity.sha256") !==
    candidate.bundleSha256
  )
    throw new Error("finalValidation.bundleIdentity.sha256 does not match candidate.bundleSha256");
  reviewAttestation(
    bundleIdentity.attestation,
    "finalValidation.bundleIdentity.attestation",
    candidateOid,
  );

  const delta = object(record.deltaAssessment, "deltaAssessment", [
    "status",
    "fromFrozenMigrationCandidateOid",
    "justification",
    "evidenceReuse",
    "attestation",
  ]);
  exactString(delta.status, "accepted", "deltaAssessment.status");
  if (
    oid(
      delta.fromFrozenMigrationCandidateOid,
      "deltaAssessment.fromFrozenMigrationCandidateOid",
    ) !== frozenMigrationCandidateOid
  )
    throw new Error("deltaAssessment frozen candidate does not match candidate provenance");
  nonempty(delta.justification, "deltaAssessment.justification");
  reviewAttestation(delta.attestation, "deltaAssessment.attestation", candidateOid);
  if (!Array.isArray(delta.evidenceReuse))
    throw new Error("deltaAssessment.evidenceReuse must be an array");
  const reuse: EvidenceReuse[] = [];
  const reuseIds = new Set<string>();
  for (const [index, value] of delta.evidenceReuse.entries()) {
    const label = `deltaAssessment.evidenceReuse[${index}]`;
    const item = object(value, label, [
      "evidenceId",
      "sourceProductOid",
      "sourceHarnessOid",
      "destinationCandidateOid",
      "justification",
      "approval",
    ]);
    const evidenceId = nonempty(item.evidenceId, `${label}.evidenceId`);
    if (reuseIds.has(evidenceId))
      throw new Error(`duplicate evidence reuse identity: ${evidenceId}`);
    reuseIds.add(evidenceId);
    const destinationCandidateOid = oid(
      item.destinationCandidateOid,
      `${label}.destinationCandidateOid`,
    );
    if (destinationCandidateOid !== candidateOid)
      throw new Error(`${label}.destinationCandidateOid does not match candidate.oid`);
    nonempty(item.justification, `${label}.justification`);
    reviewAttestation(item.approval, `${label}.approval`, candidateOid);
    reuse.push({
      label,
      evidenceId,
      sourceProductOid: oid(item.sourceProductOid, `${label}.sourceProductOid`),
      sourceHarnessOid: oid(item.sourceHarnessOid, `${label}.sourceHarnessOid`),
      destinationCandidateOid,
    });
  }

  acceptedSection(record.t13c, "t13c", candidateOid);
  acceptedSection(record.releaseAuthority, "releaseAuthority", candidateOid);
  return {
    candidateOid,
    frozenMigrationCandidateOid,
    legacyBaselineOid,
    candidateHarnessOid,
    evidence,
    reuse,
  };
}

function parseRecord(
  text: string,
): { readonly state: "blocked" } | ({ readonly state: "accepted" } & AcceptedRecord) {
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
  return { state: "accepted", ...validateAcceptedRecord(base) };
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

async function requireCommit(git: GitRunner, revision: string, label: string): Promise<void> {
  try {
    await git(["cat-file", "-e", `${revision}^{commit}`]);
  } catch {
    throw new Error(`${label} is missing from available Git history`);
  }
}

async function requireAncestor(
  git: GitRunner,
  ancestor: string,
  descendant: string,
  label: string,
): Promise<void> {
  try {
    await git(["merge-base", "--is-ancestor", ancestor, descendant]);
  } catch {
    throw new Error(label);
  }
}

async function validateRevisionProvenance(git: GitRunner, record: AcceptedRecord): Promise<void> {
  await requireCommit(git, record.candidateOid, "candidate commit");
  await requireCommit(git, record.frozenMigrationCandidateOid, "frozen migration candidate commit");
  await requireCommit(git, record.legacyBaselineOid, "legacy baseline commit");
  await requireCommit(git, record.candidateHarnessOid, "candidate harness commit");
  await requireAncestor(
    git,
    record.frozenMigrationCandidateOid,
    record.candidateOid,
    "frozen migration candidate is not an ancestor of the final candidate",
  );
  await requireAncestor(
    git,
    record.legacyBaselineOid,
    record.frozenMigrationCandidateOid,
    "legacy baseline is not an ancestor of the frozen migration candidate",
  );

  const evidenceById = new Map(record.evidence.map((item) => [item.evidenceId, item]));
  const productSources = new Map<string, string>();
  const harnessSources = new Map<string, string>();
  for (const item of record.evidence) {
    productSources.set(item.sourceProductOid, `${item.label}.sourceProductOid`);
    harnessSources.set(item.harnessOid, `${item.label}.harnessOid`);
  }
  for (const [revision, label] of productSources) await requireCommit(git, revision, label);
  for (const [revision, label] of harnessSources) await requireCommit(git, revision, label);

  const redesignedSources = new Map<string, string>();
  for (const item of record.evidence) {
    if (item.kind === "baseline") {
      if (item.sourceProductOid !== record.legacyBaselineOid)
        throw new Error(`${item.label}.sourceProductOid must be the legacy baseline`);
      continue;
    }
    redesignedSources.set(item.sourceProductOid, item.label);
  }
  for (const [sourceProductOid, label] of redesignedSources) {
    await requireAncestor(
      git,
      record.frozenMigrationCandidateOid,
      sourceProductOid,
      `${label}.sourceProductOid predates or is unrelated to the frozen candidate`,
    );
    await requireAncestor(
      git,
      sourceProductOid,
      record.candidateOid,
      `${label}.sourceProductOid is not an ancestor of the final candidate`,
    );
  }

  const reuseById = new Map<string, EvidenceReuse>();
  for (const claim of record.reuse) {
    const evidence = evidenceById.get(claim.evidenceId);
    if (!evidence || evidence.kind !== "redesigned")
      throw new Error(`${claim.label} is a dangling evidence reuse claim`);
    if (
      claim.sourceProductOid !== evidence.sourceProductOid ||
      claim.sourceHarnessOid !== evidence.harnessOid ||
      claim.destinationCandidateOid !== evidence.candidateOid
    )
      throw new Error(`${claim.label} does not match its evidence provenance`);
    reuseById.set(claim.evidenceId, claim);
  }
  for (const item of record.evidence) {
    if (item.kind !== "redesigned") continue;
    const requiresReuse = item.sourceProductOid !== record.candidateOid;
    if (requiresReuse && !reuseById.has(item.evidenceId))
      throw new Error(`${item.label} requires reviewed evidence-specific reuse`);
    if (!requiresReuse && reuseById.has(item.evidenceId))
      throw new Error(`${item.label} has an unnecessary evidence reuse claim`);
  }
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
  await validateRevisionProvenance(git, record);
  await requireAncestor(
    git,
    record.candidateOid,
    "HEAD",
    "candidate commit is not an ancestor of the publish checkout",
  );
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
