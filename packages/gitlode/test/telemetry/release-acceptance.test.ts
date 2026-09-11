import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import { validateTelemetryReleaseAcceptance } from "../../scripts/check-telemetry-release-acceptance.js";
import {
  requiredTelemetryAggregationChecks,
  requiredTelemetryGitCommandParityTargets,
  requiredTelemetryPerformanceComparisons,
  requiredTelemetryPerformanceTargets,
  requiredTelemetryRepositoryChecks,
  requiredTelemetryRepositoryProfileReportSubchecks,
} from "../../scripts/tooling/telemetry-performance-targets.js";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];
const hash = "a".repeat(64);
const repositoryCheckOracle = [
  "repository_profile_report",
  "report_size",
  "prohibited_host_spans",
] as const;
const repositoryProfileReportSubcheckOracle = [
  "sidecarAvailable",
  "reportPresent",
  "schemaValid",
  "spansComplete",
  "countersComplete",
  "histogramsComplete",
  "diagnosticsPresent",
  "diagnosticsEmpty",
] as const;

interface Revisions {
  legacy: string;
  frozen: string;
  candidate: string;
  harness: string;
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "gitlode-release-acceptance-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function git(repository: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(
    "git",
    ["-c", `safe.directory=${repository}`, "-C", repository, ...args],
    { encoding: "utf8" },
  );
  return stdout.trim();
}

function reviewAttestation(candidateOid: string, evidenceId = "review-evidence") {
  return {
    candidateOid,
    evidenceId,
    archiveId: "archive-1",
    sha256: hash,
    reviewer: "independent-reviewer",
    reviewedAt: "2026-09-11",
  };
}

function evidenceAttestation(
  revisions: Revisions,
  evidenceId: string,
  sourceProductOid = revisions.candidate,
) {
  return {
    ...reviewAttestation(revisions.candidate, evidenceId),
    sourceProductOid,
    harnessOid: revisions.harness,
  };
}

function section(candidateOid: string, evidenceId: string) {
  return { status: "accepted", attestation: reviewAttestation(candidateOid, evidenceId) };
}

function performanceResult(
  revisions: Revisions,
  evidenceId: string,
  target: string,
  status: "pass" | "exception" = "pass",
) {
  const [fixture, adapter] = target.split("/") as [string, string];
  return {
    status,
    attestation: evidenceAttestation(revisions, evidenceId),
    ...(status === "exception"
      ? {
          exception: {
            fixture,
            adapter,
            measuredResult: "ratio 1.051",
            cause: "known fixed overhead",
            acceptanceRationale: "bounded impact accepted for v0.13.0",
            impact: "one percent over the threshold",
            reevaluationCondition: "repeat for the next telemetry redesign",
            releaseAuthorityApproval: reviewAttestation(
              revisions.candidate,
              `${evidenceId}-authority`,
            ),
          },
        }
      : {}),
  };
}

function repositoryProfileReportSubchecks(): Record<string, "pass"> {
  return Object.fromEntries(
    repositoryProfileReportSubcheckOracle.map((subcheck) => [subcheck, "pass"]),
  );
}

function acceptedRecord(revisions: Revisions) {
  const calibrationId = (target: string) => `calibration:${target}`;
  const captureId = (target: string) => `legacy:${target}`;
  const comparisonId = (target: string, comparison: string) => `comparison:${target}:${comparison}`;
  return {
    schemaVersion: 1,
    state: "accepted",
    candidate: {
      oid: revisions.candidate,
      frozenMigrationCandidateOid: revisions.frozen,
      legacyBaselineOid: revisions.legacy,
      harnessOid: revisions.harness,
      bundleId: "gitlode-v0.13.0.tgz",
      bundleSha256: hash,
      fixtureManifestSha256: "d".repeat(64),
      attestation: reviewAttestation(revisions.candidate, "candidate"),
    },
    performance: {
      calibrations: requiredTelemetryPerformanceTargets.map((target) => ({
        target,
        status: "accepted",
        childStatus: "pass",
        behavioralStatus: "pass",
        targetRecipeSha256: hash,
        attestation: evidenceAttestation(revisions, calibrationId(target), revisions.legacy),
      })),
      legacyCaptures: requiredTelemetryPerformanceTargets.map((target) => ({
        target,
        status: "pass",
        behavioralStatus: "pass",
        targetRecipeSha256: hash,
        calibrationEvidenceId: calibrationId(target),
        attestation: evidenceAttestation(revisions, captureId(target), revisions.legacy),
      })),
      comparisons: requiredTelemetryPerformanceTargets.flatMap((target) =>
        requiredTelemetryPerformanceComparisons.map((comparison) => ({
          target,
          comparison,
          ...performanceResult(revisions, comparisonId(target, comparison), target),
          wallClockStatus: "pass",
          peakRssStatus: "pass",
          behavioralStatus: "pass",
          targetRecipeSha256: hash,
          calibrationEvidenceId: calibrationId(target),
          legacyCaptureEvidenceId: captureId(target),
        })),
      ),
      checks: [
        ...requiredTelemetryAggregationChecks.map((check) => ({
          check,
          target: "aggregation_scale/none",
          scope: "n_to_4n",
          ...performanceResult(
            revisions,
            `check:${check}:aggregation_scale/none`,
            "aggregation_scale/none",
          ),
        })),
        ...requiredTelemetryPerformanceTargets.flatMap((target) =>
          repositoryCheckOracle.map((check) => ({
            check,
            target,
            scope: "target_on",
            comparisonEvidenceId: comparisonId(target, "profile_overhead"),
            ...performanceResult(revisions, `check:${check}:${target}`, target),
            ...(check === "repository_profile_report"
              ? { subchecks: repositoryProfileReportSubchecks() }
              : {}),
          })),
        ),
        ...requiredTelemetryGitCommandParityTargets.map((target) => ({
          check: "git_command_parity",
          target,
          scope: "target_on",
          comparisonEvidenceId: comparisonId(target, "profile_overhead"),
          ...performanceResult(revisions, `check:git_command_parity:${target}`, target),
        })),
      ],
    },
    profileReadability: {
      cases: ["commit", "file", "plugin", "partial", "unavailable"].map((profileCase) => ({
        case: profileCase,
        ...section(revisions.candidate, `profile:${profileCase}`),
      })),
    },
    systemTestOrganization: section(revisions.candidate, "system-tests"),
    contributorNavigation: section(revisions.candidate, "navigation"),
    finalValidation: {
      windows: {
        functional: section(revisions.candidate, "windows-functional"),
        installedPackage: section(revisions.candidate, "windows-package"),
      },
      linux: {
        functional: section(revisions.candidate, "linux-functional"),
        installedPackage: section(revisions.candidate, "linux-package"),
      },
      bundleIdentity: {
        bundleId: "gitlode-v0.13.0.tgz",
        sha256: hash,
        attestation: reviewAttestation(revisions.candidate, "bundle"),
      },
    },
    deltaAssessment: {
      status: "accepted",
      fromFrozenMigrationCandidateOid: revisions.frozen,
      justification: "All changes since the frozen migration candidate were reviewed.",
      evidenceReuse: [] as Array<Record<string, unknown>>,
      attestation: reviewAttestation(revisions.candidate, "delta"),
    },
    t13c: section(revisions.candidate, "t13c"),
    releaseAuthority: section(revisions.candidate, "release-authority"),
  };
}

function repositoryProfileReportCheck(
  record: ReturnType<typeof acceptedRecord>,
  target = requiredTelemetryPerformanceTargets[0],
) {
  const check = record.performance.checks.find(
    (item) => item.check === "repository_profile_report" && item.target === target,
  );
  if (!check) throw new Error(`missing repository_profile_report fixture for ${target}`);
  return check;
}

async function writeRecord(repository: string, record: unknown): Promise<void> {
  await mkdir(join(repository, ".release"), { recursive: true });
  await writeFile(
    join(repository, ".release", "telemetry-migration-acceptance.json"),
    `${JSON.stringify(record, undefined, 2)}\n`,
  );
}

async function commitRecord(repository: string, record: unknown): Promise<void> {
  const tracked = await git(
    repository,
    "ls-tree",
    "--name-only",
    "HEAD",
    ".release/telemetry-migration-acceptance.json",
  );
  await writeRecord(repository, record);
  await git(repository, "add", ".release/telemetry-migration-acceptance.json");
  await git(
    repository,
    "commit",
    tracked ? "--amend" : "-m",
    tracked ? "--no-edit" : "accept telemetry migration",
  );
}

async function repositoryFixture(options: { frozenIsFinal?: boolean } = {}) {
  const repository = await temporaryDirectory();
  await git(repository, "init", "--initial-branch", "main");
  await git(repository, "config", "user.name", "Release Gate Test");
  await git(repository, "config", "user.email", "release-gate@example.invalid");
  await writeFile(join(repository, ".gitignore"), "dist/\n");
  await writeFile(join(repository, "README.md"), "legacy\n");
  await git(repository, "add", ".gitignore", "README.md");
  await git(repository, "commit", "-m", "legacy baseline");
  const legacy = await git(repository, "rev-parse", "HEAD");
  await writeFile(join(repository, "README.md"), "frozen\n");
  await git(repository, "add", "README.md");
  await git(repository, "commit", "-m", "frozen migration candidate");
  const frozen = await git(repository, "rev-parse", "HEAD");
  if (!options.frozenIsFinal) {
    await writeFile(join(repository, "README.md"), "final\n");
    await git(repository, "add", "README.md");
    await git(repository, "commit", "-m", "final candidate");
  }
  const candidate = await git(repository, "rev-parse", "HEAD");
  await git(repository, "checkout", "-b", "harness");
  await writeFile(join(repository, "HARNESS.md"), "separately versioned harness\n");
  await git(repository, "add", "HARNESS.md");
  await git(repository, "commit", "-m", "harness revision");
  const harness = await git(repository, "rev-parse", "HEAD");
  await git(repository, "checkout", "main");
  const revisions = { legacy, frozen, candidate, harness };
  await commitRecord(repository, acceptedRecord(revisions));
  return { repository, revisions };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("telemetry release acceptance schema and obligation coverage", () => {
  it("keeps the production repository-check inventories equal to literal test oracles", () => {
    expect(requiredTelemetryRepositoryChecks).toEqual(repositoryCheckOracle);
    expect(requiredTelemetryRepositoryProfileReportSubchecks).toEqual(
      repositoryProfileReportSubcheckOracle,
    );
  });

  it.each([
    ["missing", undefined, "absent or unreadable"],
    ["malformed", "{", "malformed JSON"],
    [
      "blocked",
      JSON.stringify({ schemaVersion: 1, state: "blocked", reason: "M2 remains open" }),
      "acceptance is blocked",
    ],
  ])("rejects a %s record", async (_name, contents, message) => {
    const repository = await temporaryDirectory();
    if (contents !== undefined) {
      await mkdir(join(repository, ".release"));
      await writeFile(
        join(repository, ".release", "telemetry-migration-acceptance.json"),
        contents,
      );
    }
    await expect(
      validateTelemetryReleaseAcceptance(repository, {
        environment: { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/main" },
      }),
    ).rejects.toThrow(message);
  });

  it("accepts the complete obligation inventory and separately versioned newer harness", async () => {
    const { repository } = await repositoryFixture();
    await expect(validateTelemetryReleaseAcceptance(repository)).resolves.toBeUndefined();
  });

  it("rejects the round-1 shape with only the two exception-capable repository checks", async () => {
    const { repository, revisions } = await repositoryFixture();
    const record = acceptedRecord(revisions);
    record.performance.checks = record.performance.checks.filter(
      (item) => item.check !== "repository_profile_report",
    );
    await writeRecord(repository, record);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "missing performance check: repository_profile_report:",
    );
  });

  it("rejects a missing repository profile report and each missing required subcheck", async () => {
    const { repository, revisions } = await repositoryFixture();
    const missingReport = acceptedRecord(revisions);
    missingReport.performance.checks = missingReport.performance.checks.filter(
      (item) =>
        !(
          item.check === "repository_profile_report" &&
          item.target === requiredTelemetryPerformanceTargets[0]
        ),
    );
    await writeRecord(repository, missingReport);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      `missing performance check: repository_profile_report:${requiredTelemetryPerformanceTargets[0]}:target_on`,
    );

    for (const subcheck of repositoryProfileReportSubcheckOracle) {
      const record = acceptedRecord(revisions);
      const item = repositoryProfileReportCheck(record) as unknown as Record<string, unknown>;
      delete (item.subchecks as Record<string, unknown>)[subcheck];
      await writeRecord(repository, record);
      await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
        `missing required subcheck: ${subcheck}`,
      );
    }
  });

  it.each(["inconclusive", "failed"])(
    "rejects every repository profile report subcheck with a %s outcome",
    async (status) => {
      const { repository, revisions } = await repositoryFixture();
      for (const subcheck of repositoryProfileReportSubcheckOracle) {
        const record = acceptedRecord(revisions);
        const item = repositoryProfileReportCheck(record) as unknown as Record<string, unknown>;
        (item.subchecks as Record<string, unknown>)[subcheck] = status;
        await writeRecord(repository, record);
        await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
          `subchecks.${subcheck} must be pass`,
        );
      }
    },
  );

  it.each(["inconclusive", "failed", "exception"])(
    "rejects a repository profile report with grouped status %s",
    async (status) => {
      const { repository, revisions } = await repositoryFixture();
      const record = acceptedRecord(revisions);
      const item = repositoryProfileReportCheck(record) as unknown as Record<string, unknown>;
      item.status = status;
      if (status === "exception") {
        Object.assign(
          item,
          performanceResult(
            revisions,
            "replacement-profile-report",
            requiredTelemetryPerformanceTargets[0],
            "exception",
          ),
        );
      }
      await writeRecord(repository, record);
      await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
        ".status must be pass",
      );
    },
  );

  it("rejects unknown repository profile subchecks and an exception field on a passing group", async () => {
    const { repository, revisions } = await repositoryFixture();
    const unknown = acceptedRecord(revisions);
    const unknownItem = repositoryProfileReportCheck(unknown) as unknown as Record<string, unknown>;
    (unknownItem.subchecks as Record<string, unknown>).unknownSubcheck = "pass";
    await writeRecord(repository, unknown);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "subchecks has unknown field: unknownSubcheck",
    );

    const excepted = acceptedRecord(revisions);
    const exceptedItem = repositoryProfileReportCheck(excepted) as unknown as Record<
      string,
      unknown
    >;
    exceptedItem.exception = performanceResult(
      revisions,
      "unused-profile-report-exception",
      requiredTelemetryPerformanceTargets[0],
      "exception",
    ).exception;
    await writeRecord(repository, excepted);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "exception is not valid for repository_profile_report",
    );
  });

  it("rejects the original incomplete-positive performance shape", async () => {
    const { repository, revisions } = await repositoryFixture();
    const record = acceptedRecord(revisions);
    (record as Record<string, unknown>).performance = {
      comparisons: record.performance.comparisons,
      aggregationScale: performanceResult(revisions, "aggregation", "aggregation_scale/none"),
      traceVolume: performanceResult(
        revisions,
        "trace-volume",
        "commit_heavy_repository/isomorphic-git",
      ),
    };
    await writeRecord(repository, record);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow("unknown field");
  });

  it.each([
    ["calibration", "calibrations", "missing calibration target"],
    ["legacy capture", "legacyCaptures", "missing legacy capture target"],
    ["comparison", "comparisons", "missing performance comparison"],
    ["individual check", "checks", "missing performance check"],
  ])("rejects a missing %s obligation", async (_name, key, message) => {
    const { repository, revisions } = await repositoryFixture();
    const record = acceptedRecord(revisions);
    record.performance[key as keyof typeof record.performance].pop();
    await writeRecord(repository, record);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(message);
  });

  it.each([
    ["calibration", "calibrations", "duplicate calibration target"],
    ["legacy capture", "legacyCaptures", "duplicate legacy capture target"],
    ["comparison", "comparisons", "duplicate performance comparison"],
    ["individual check", "checks", "duplicate performance check"],
  ])("rejects a duplicate %s identity", async (_name, key, message) => {
    const { repository, revisions } = await repositoryFixture();
    const record = acceptedRecord(revisions);
    const items = record.performance[key as keyof typeof record.performance];
    items[1] = items[0]!;
    await writeRecord(repository, record);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(message);
  });

  it("rejects unknown and wrong-scope checks", async () => {
    const { repository, revisions } = await repositoryFixture();
    const unknown = acceptedRecord(revisions);
    unknown.performance.checks[0]!.check = "unknown_check";
    await writeRecord(repository, unknown);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "unknown or wrong-scope",
    );
    const wrongScope = acceptedRecord(revisions);
    wrongScope.performance.checks.at(-1)!.scope = "n_to_4n";
    await writeRecord(repository, wrongScope);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "unknown or wrong-scope",
    );
  });

  it("rejects invalid repository profile report identities and comparison links", async () => {
    const { repository, revisions } = await repositoryFixture();

    const duplicate = acceptedRecord(revisions);
    duplicate.performance.checks.push(repositoryProfileReportCheck(duplicate));
    await writeRecord(repository, duplicate);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "duplicate performance check: repository_profile_report:",
    );

    for (const mutate of [
      (item: Record<string, unknown>) => (item.check = "unknown_profile_report"),
      (item: Record<string, unknown>) => (item.target = "unknown_repository/none"),
      (item: Record<string, unknown>) => (item.scope = "n_to_4n"),
    ]) {
      const record = acceptedRecord(revisions);
      mutate(repositoryProfileReportCheck(record) as unknown as Record<string, unknown>);
      await writeRecord(repository, record);
      await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
        "unknown or wrong-scope",
      );
    }

    const missingLink = acceptedRecord(revisions);
    delete (repositoryProfileReportCheck(missingLink) as unknown as Record<string, unknown>)
      .comparisonEvidenceId;
    await writeRecord(repository, missingLink);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "comparisonEvidenceId",
    );

    const mismatchedLink = acceptedRecord(revisions);
    (
      repositoryProfileReportCheck(mismatchedLink) as unknown as Record<string, unknown>
    ).comparisonEvidenceId = "comparison:mismatched";
    await writeRecord(repository, mismatchedLink);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "comparisonEvidenceId must be",
    );
  });

  it("preserves pass and reviewed exceptions for report size and prohibited host spans", async () => {
    const { repository, revisions } = await repositoryFixture();
    const excepted = acceptedRecord(revisions);
    for (const check of ["report_size", "prohibited_host_spans"] as const) {
      const item = excepted.performance.checks.find(
        (candidate) =>
          candidate.check === check && candidate.target === requiredTelemetryPerformanceTargets[0],
      );
      if (!item) throw new Error(`missing ${check} fixture`);
      Object.assign(
        item,
        performanceResult(
          revisions,
          `excepted-${check}`,
          requiredTelemetryPerformanceTargets[0],
          "exception",
        ),
      );
    }
    await commitRecord(repository, excepted);
    await expect(validateTelemetryReleaseAcceptance(repository)).resolves.toBeUndefined();

    const incomplete = acceptedRecord(revisions);
    const reportSize = incomplete.performance.checks.find(
      (item) =>
        item.check === "report_size" && item.target === requiredTelemetryPerformanceTargets[0],
    );
    if (!reportSize) throw new Error("missing report_size fixture");
    Object.assign(
      reportSize,
      performanceResult(
        revisions,
        "incomplete-report-size",
        requiredTelemetryPerformanceTargets[0],
        "exception",
      ),
    );
    if (!reportSize.exception) throw new Error("missing exception fixture");
    reportSize.exception.cause = "";
    await writeRecord(repository, incomplete);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow("cause");
  });

  it.each(["pending", "failed", "inconclusive"])(
    "rejects %s calibration, behavior, comparison, and check outcomes",
    async (status) => {
      const { repository, revisions } = await repositoryFixture();
      for (const mutate of [
        (record: ReturnType<typeof acceptedRecord>) =>
          (record.performance.calibrations[0]!.status = status),
        (record: ReturnType<typeof acceptedRecord>) =>
          (record.performance.legacyCaptures[0]!.behavioralStatus = status),
        (record: ReturnType<typeof acceptedRecord>) =>
          (record.performance.comparisons[0]!.behavioralStatus = status),
        (record: ReturnType<typeof acceptedRecord>) =>
          (record.performance.checks[0]!.status = status),
      ]) {
        const record = acceptedRecord(revisions);
        mutate(record);
        await writeRecord(repository, record);
        await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow();
      }
    },
  );

  it("rejects missing links, mismatched recipes, and incomplete exceptions", async () => {
    const { repository, revisions } = await repositoryFixture();
    const missingLink = acceptedRecord(revisions);
    delete (missingLink.performance.comparisons[0] as Record<string, unknown>)
      .calibrationEvidenceId;
    await writeRecord(repository, missingLink);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "calibrationEvidenceId",
    );

    const wrongRecipe = acceptedRecord(revisions);
    wrongRecipe.performance.legacyCaptures[0]!.targetRecipeSha256 = "b".repeat(64);
    await writeRecord(repository, wrongRecipe);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "does not match calibration",
    );

    const invalidException = acceptedRecord(revisions);
    invalidException.performance.checks[0] = {
      ...invalidException.performance.checks[0]!,
      ...performanceResult(revisions, "replacement", "aggregation_scale/none", "exception"),
    };
    invalidException.performance.checks[0]!.exception!.cause = "";
    await writeRecord(repository, invalidException);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow("cause");
  });

  it("rejects every missing required performance-entry key", async () => {
    const { repository, revisions } = await repositoryFixture();
    const cases: Array<["calibrations" | "legacyCaptures" | "comparisons" | "checks", string]> = [
      ...[
        "target",
        "status",
        "childStatus",
        "behavioralStatus",
        "targetRecipeSha256",
        "attestation",
      ].map((key) => ["calibrations", key] as const),
      ...[
        "target",
        "status",
        "behavioralStatus",
        "targetRecipeSha256",
        "calibrationEvidenceId",
        "attestation",
      ].map((key) => ["legacyCaptures", key] as const),
      ...[
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
      ].map((key) => ["comparisons", key] as const),
      ...["check", "target", "scope", "status", "attestation"].map(
        (key) => ["checks", key] as const,
      ),
    ];
    for (const [collection, key] of cases) {
      const record = acceptedRecord(revisions);
      delete (record.performance[collection][0] as unknown as Record<string, unknown>)[key];
      await writeRecord(repository, record);
      await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow();
    }
    const missingRepositoryLink = acceptedRecord(revisions);
    const repositoryCheck = missingRepositoryLink.performance.checks.find(
      (item) => item.scope === "target_on",
    )!;
    delete (repositoryCheck as unknown as Record<string, unknown>).comparisonEvidenceId;
    await writeRecord(repository, missingRepositoryLink);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "comparisonEvidenceId",
    );
  });
});

describe("telemetry release revision and evidence provenance", () => {
  it("accepts identical frozen/final candidates", async () => {
    const { repository } = await repositoryFixture({ frozenIsFinal: true });
    await expect(validateTelemetryReleaseAcceptance(repository)).resolves.toBeUndefined();
  });

  it.each([
    ["frozen migration candidate", "frozenMigrationCandidateOid"],
    ["candidate harness", "harnessOid"],
  ])("rejects a missing %s commit", async (_name, key) => {
    const { repository, revisions } = await repositoryFixture();
    const record = acceptedRecord(revisions);
    record.candidate[key as "frozenMigrationCandidateOid" | "harnessOid"] = "f".repeat(40);
    if (key === "frozenMigrationCandidateOid")
      record.deltaAssessment.fromFrozenMigrationCandidateOid = "f".repeat(40);
    await writeRecord(repository, record);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "missing from available Git history",
    );
  });

  it("rejects a missing final candidate commit", async () => {
    const { repository, revisions } = await repositoryFixture();
    const record = acceptedRecord({ ...revisions, candidate: "f".repeat(40) });
    await writeRecord(repository, record);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "candidate commit is missing from available Git history",
    );
  });

  it("rejects missing harness and product revisions declared by evidence", async () => {
    const { repository, revisions } = await repositoryFixture();
    for (const key of ["harnessOid", "sourceProductOid"] as const) {
      const record = acceptedRecord(revisions);
      record.performance.comparisons[0]!.attestation[key] = "f".repeat(40);
      await writeRecord(repository, record);
      await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
        "missing from available Git history",
      );
    }
  });

  it("rejects unrelated frozen and final candidates", async () => {
    const { repository, revisions } = await repositoryFixture();
    await git(repository, "checkout", "--orphan", "unrelated-product");
    await writeFile(join(repository, "UNRELATED.md"), "unrelated\n");
    await git(repository, "add", "UNRELATED.md");
    await git(repository, "commit", "-m", "unrelated product");
    const unrelated = await git(repository, "rev-parse", "HEAD");
    await git(repository, "checkout", "main");
    const record = acceptedRecord(revisions);
    record.candidate.frozenMigrationCandidateOid = unrelated;
    record.deltaAssessment.fromFrozenMigrationCandidateOid = unrelated;
    await writeRecord(repository, record);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "not an ancestor of the final candidate",
    );

    const unrelatedFinal = acceptedRecord({ ...revisions, candidate: revisions.harness });
    await writeRecord(repository, unrelatedFinal);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "candidate commit is not an ancestor of the publish checkout",
    );
  });

  it("preserves baseline provenance without treating it as candidate reuse", async () => {
    const { repository, revisions } = await repositoryFixture();
    const record = acceptedRecord(revisions);
    record.performance.calibrations[0]!.attestation.sourceProductOid = revisions.frozen;
    await writeRecord(repository, record);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "must be the legacy baseline",
    );
  });

  it("rejects an existing but unrelated redesigned evidence source", async () => {
    const { repository, revisions } = await repositoryFixture();
    const record = acceptedRecord(revisions);
    record.performance.comparisons[0]!.attestation.sourceProductOid = revisions.harness;
    await writeRecord(repository, record);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "not an ancestor of the final candidate",
    );
  });

  it("accepts exact reviewed reuse of ancestor candidate evidence", async () => {
    const { repository, revisions } = await repositoryFixture();
    const record = acceptedRecord(revisions);
    const evidence = record.performance.comparisons[0]!.attestation;
    evidence.sourceProductOid = revisions.frozen;
    record.deltaAssessment.evidenceReuse.push({
      evidenceId: evidence.evidenceId,
      sourceProductOid: revisions.frozen,
      sourceHarnessOid: evidence.harnessOid,
      destinationCandidateOid: revisions.candidate,
      justification: "The candidate delta was reviewed for this exact comparison evidence.",
      approval: reviewAttestation(revisions.candidate, "reuse-approval"),
    });
    await commitRecord(repository, record);
    await expect(validateTelemetryReleaseAcceptance(repository)).resolves.toBeUndefined();
  });

  it("rejects absent approval, dangling reuse, source mismatch, and missing reuse", async () => {
    const { repository, revisions } = await repositoryFixture();
    const makeReuse = () => {
      const record = acceptedRecord(revisions);
      const evidence = record.performance.comparisons[0]!.attestation;
      evidence.sourceProductOid = revisions.frozen;
      const claim = {
        evidenceId: evidence.evidenceId,
        sourceProductOid: revisions.frozen,
        sourceHarnessOid: evidence.harnessOid,
        destinationCandidateOid: revisions.candidate,
        justification: "Reviewed exact reuse.",
        approval: reviewAttestation(revisions.candidate, "reuse-approval"),
      };
      return { record, claim };
    };

    const missing = makeReuse();
    await writeRecord(repository, missing.record);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "requires reviewed evidence-specific reuse",
    );

    const absentApproval = makeReuse();
    absentApproval.record.deltaAssessment.evidenceReuse.push(absentApproval.claim);
    delete (absentApproval.claim as Record<string, unknown>).approval;
    await writeRecord(repository, absentApproval.record);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow("approval");

    const dangling = makeReuse();
    dangling.claim.evidenceId = "unknown-evidence";
    dangling.record.deltaAssessment.evidenceReuse.push(dangling.claim);
    await writeRecord(repository, dangling.record);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow("dangling");

    const mismatch = makeReuse();
    mismatch.claim.sourceHarnessOid = revisions.legacy;
    mismatch.record.deltaAssessment.evidenceReuse.push(mismatch.claim);
    await writeRecord(repository, mismatch.record);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "does not match its evidence provenance",
    );
  });
});

describe("telemetry release Git and publishing context", () => {
  it("accepts an ancestor candidate with only the committed acceptance record changed", async () => {
    const { repository } = await repositoryFixture();
    await expect(
      validateTelemetryReleaseAcceptance(repository, {
        environment: { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/main" },
      }),
    ).resolves.toBeUndefined();
  });

  it.each([
    "package.json",
    "package-lock.json",
    "packages/gitlode/CHANGELOG.md",
    "src/index.ts",
    ".github/workflows/release.yml",
  ])("rejects a committed post-candidate change to %s", async (path) => {
    const { repository, revisions } = await repositoryFixture();
    await mkdir(join(repository, dirname(path)), { recursive: true });
    await writeFile(join(repository, path), "changed\n");
    await git(repository, "add", path);
    await git(repository, "commit", "-m", `change ${path}`);
    await commitRecord(repository, acceptedRecord(revisions));
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "differs from candidate outside acceptance record",
    );
  });

  it("rejects dirty files while ignored build output remains irrelevant", async () => {
    const { repository } = await repositoryFixture();
    await mkdir(join(repository, "dist"));
    await writeFile(join(repository, "dist", "index.js"), "generated\n");
    await expect(validateTelemetryReleaseAcceptance(repository)).resolves.toBeUndefined();
    await writeFile(join(repository, "release-policy.md"), "dirty\n");
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "uncommitted or untracked changes",
    );
  });

  it("requires main in Actions and resolves the local branch from Git", async () => {
    const { repository } = await repositoryFixture();
    await expect(
      validateTelemetryReleaseAcceptance(repository, {
        environment: { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/feature/release" },
      }),
    ).rejects.toThrow("Actions publishing is allowed only");
    await git(repository, "checkout", "-b", "feature/release");
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "local publishing is allowed only",
    );
  });
});

describe("release command wiring", () => {
  it("guards Changesets while leaving CI, Version PR creation, and validate:release unguarded", async () => {
    const repositoryRoot = resolve(import.meta.dirname, "../../../..");
    const packageJson = JSON.parse(
      await readFile(join(repositoryRoot, "package.json"), "utf8"),
    ) as {
      scripts: Record<string, string>;
    };
    const releaseWorkflow = await readFile(
      join(repositoryRoot, ".github/workflows/release.yml"),
      "utf8",
    );
    const ciWorkflow = await readFile(join(repositoryRoot, ".github/workflows/ci.yml"), "utf8");
    expect(packageJson.scripts["changeset:publish"]).toMatch(
      /^npm run validate:telemetry-release-acceptance -w gitlode && changeset publish$/,
    );
    expect(packageJson.scripts.release).toBe(
      "npm run validate:release && npm run changeset:publish",
    );
    expect(packageJson.scripts["validate:release"]).not.toContain(
      "validate:telemetry-release-acceptance",
    );
    expect(releaseWorkflow).toContain("version: npm run version-packages");
    expect(releaseWorkflow).toContain("publish: npm run release");
    expect(releaseWorkflow).toContain("fetch-depth: 0");
    expect(ciWorkflow).not.toContain("validate:telemetry-release-acceptance");
  });

  it("does not invoke a publisher stub when the live record is blocked", async () => {
    const repositoryRoot = resolve(import.meta.dirname, "../../../..");
    const publisher = vi.fn();
    await expect(
      validateTelemetryReleaseAcceptance(repositoryRoot, {
        environment: { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/main" },
      }).then(publisher),
    ).rejects.toThrow("acceptance is blocked");
    expect(publisher).not.toHaveBeenCalled();
  });
});
