import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import { validateTelemetryReleaseAcceptance } from "../../scripts/check-telemetry-release-acceptance.js";
import {
  requiredTelemetryPerformanceComparisons,
  requiredTelemetryPerformanceTargets,
} from "../../scripts/tooling/telemetry-performance-targets.js";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];
const hash = "a".repeat(64);

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

function attestation(candidateOid: string) {
  return {
    candidateOid,
    evidenceId: "evidence-1",
    archiveId: "archive-1",
    sha256: hash,
    reviewer: "independent-reviewer",
    reviewedAt: "2026-09-11",
  };
}

function section(candidateOid: string) {
  return { status: "accepted", attestation: attestation(candidateOid) };
}

function result(
  candidateOid: string,
  status: "pass" | "exception" = "pass",
  exceptionTarget = "commit_heavy_repository/git-cli",
) {
  const [fixture, adapter] = exceptionTarget.split("/") as [string, string];
  return {
    status,
    attestation: attestation(candidateOid),
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
            releaseAuthorityApproval: attestation(candidateOid),
          },
        }
      : {}),
  };
}

function acceptedRecord(candidateOid: string) {
  return {
    schemaVersion: 1,
    state: "accepted",
    candidate: {
      oid: candidateOid,
      frozenMigrationCandidateOid: "b".repeat(40),
      harnessOid: "c".repeat(40),
      bundleId: "gitlode-v0.13.0.tgz",
      bundleSha256: hash,
      fixtureManifestSha256: "d".repeat(64),
      attestation: attestation(candidateOid),
    },
    performance: {
      comparisons: requiredTelemetryPerformanceTargets.flatMap((target) =>
        requiredTelemetryPerformanceComparisons.map((comparison) => ({
          target,
          comparison,
          ...result(candidateOid),
        })),
      ),
      aggregationScale: result(candidateOid),
      traceVolume: result(candidateOid),
    },
    profileReadability: {
      cases: ["commit", "file", "plugin", "partial", "unavailable"].map((profileCase) => ({
        case: profileCase,
        ...section(candidateOid),
      })),
    },
    systemTestOrganization: section(candidateOid),
    contributorNavigation: section(candidateOid),
    finalValidation: {
      windows: {
        functional: section(candidateOid),
        installedPackage: section(candidateOid),
      },
      linux: {
        functional: section(candidateOid),
        installedPackage: section(candidateOid),
      },
      bundleIdentity: {
        bundleId: "gitlode-v0.13.0.tgz",
        sha256: hash,
        attestation: attestation(candidateOid),
      },
    },
    deltaAssessment: {
      status: "accepted",
      fromFrozenMigrationCandidateOid: "b".repeat(40),
      justification: "All changes since the frozen migration candidate were reviewed.",
      attestation: attestation(candidateOid),
    },
    t13c: section(candidateOid),
    releaseAuthority: section(candidateOid),
  };
}

async function writeRecord(repository: string, record: unknown): Promise<void> {
  await mkdir(join(repository, ".release"), { recursive: true });
  await writeFile(
    join(repository, ".release", "telemetry-migration-acceptance.json"),
    `${JSON.stringify(record, undefined, 2)}\n`,
  );
}

async function repositoryFixture(branch = "main") {
  const repository = await temporaryDirectory();
  await git(repository, "init", "--initial-branch", branch);
  await git(repository, "config", "user.name", "Release Gate Test");
  await git(repository, "config", "user.email", "release-gate@example.invalid");
  await writeFile(join(repository, "README.md"), "candidate\n");
  await writeFile(join(repository, ".gitignore"), "dist/\n");
  await git(repository, "add", "README.md", ".gitignore");
  await git(repository, "commit", "-m", "candidate");
  const candidateOid = await git(repository, "rev-parse", "HEAD");
  await writeRecord(repository, acceptedRecord(candidateOid));
  await git(repository, "add", ".release/telemetry-migration-acceptance.json");
  await git(repository, "commit", "-m", "accept telemetry migration");
  return { repository, candidateOid };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("telemetry release acceptance schema", () => {
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

  it("accepts the exact target/comparison matrix and a complete reviewed exception", async () => {
    const { repository } = await repositoryFixture();
    const candidateOid = await git(repository, "rev-parse", "HEAD~1");
    const record = acceptedRecord(candidateOid);
    record.performance.comparisons[0] = {
      ...record.performance.comparisons[0]!,
      ...result(candidateOid, "exception", "commit_heavy_repository/isomorphic-git"),
    };
    await writeRecord(repository, record);
    await git(repository, "add", ".release/telemetry-migration-acceptance.json");
    await git(repository, "commit", "--amend", "--no-edit");
    await expect(validateTelemetryReleaseAcceptance(repository)).resolves.toBeUndefined();
  });

  it("rejects missing and duplicate matrix identities", async () => {
    const { repository, candidateOid } = await repositoryFixture();
    const missing = acceptedRecord(candidateOid);
    missing.performance.comparisons.pop();
    await writeRecord(repository, missing);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "missing performance comparison",
    );
    const duplicate = acceptedRecord(candidateOid);
    duplicate.performance.comparisons[1] = duplicate.performance.comparisons[0]!;
    await writeRecord(repository, duplicate);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "duplicate performance comparison",
    );
  });

  it("rejects incomplete exceptions, unknown fields, and candidate identity mismatches", async () => {
    const { repository, candidateOid } = await repositoryFixture();
    const invalid = acceptedRecord(candidateOid);
    invalid.performance.aggregationScale = result(candidateOid, "exception");
    invalid.performance.aggregationScale.exception!.cause = "";
    await writeRecord(repository, invalid);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow("cause");

    const unknown = acceptedRecord(candidateOid) as ReturnType<typeof acceptedRecord> & {
      extra?: boolean;
    };
    unknown.extra = true;
    await writeRecord(repository, unknown);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow("unknown field");

    const mismatch = acceptedRecord(candidateOid);
    mismatch.t13c.attestation.candidateOid = "e".repeat(40);
    await writeRecord(repository, mismatch);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "does not match candidate.oid",
    );
  });

  it("rejects non-accepting outcomes and malformed or incomplete attestations", async () => {
    const { repository, candidateOid } = await repositoryFixture();
    for (const status of ["pending", "failed", "inconclusive"]) {
      const record = acceptedRecord(candidateOid);
      (record.performance.traceVolume as { status: string }).status = status;
      await writeRecord(repository, record);
      await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
        "status must be pass or exception",
      );
    }

    const malformedOid = acceptedRecord(candidateOid);
    (malformedOid.candidate as { oid: string }).oid = "short";
    await writeRecord(repository, malformedOid);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "full lowercase Git OID",
    );

    const malformedHash = acceptedRecord(candidateOid);
    (malformedHash.candidate as { bundleSha256: string }).bundleSha256 = "not-a-hash";
    await writeRecord(repository, malformedHash);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "lowercase SHA-256",
    );

    const missingReviewer = acceptedRecord(candidateOid);
    (missingReviewer.releaseAuthority.attestation as { reviewer: string }).reviewer = "";
    await writeRecord(repository, missingReviewer);
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow("reviewer");
  });
});

describe("telemetry release Git and publishing context", () => {
  it("accepts an ancestor candidate with only the committed acceptance record changed", async () => {
    const { repository } = await repositoryFixture();
    await expect(validateTelemetryReleaseAcceptance(repository)).resolves.toBeUndefined();
    await expect(
      validateTelemetryReleaseAcceptance(repository, {
        environment: { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/main" },
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects absent candidate history and non-ancestor candidates", async () => {
    const { repository, candidateOid } = await repositoryFixture();
    await writeRecord(repository, acceptedRecord("f".repeat(40)));
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "missing or is not an ancestor",
    );

    await git(repository, "checkout", "--orphan", "unrelated");
    await writeFile(join(repository, "README.md"), "unrelated\n");
    await writeRecord(repository, acceptedRecord(candidateOid));
    await git(repository, "add", "README.md", ".release/telemetry-migration-acceptance.json");
    await git(repository, "commit", "-m", "unrelated publish tree");
    await expect(
      validateTelemetryReleaseAcceptance(repository, {
        environment: { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/main" },
      }),
    ).rejects.toThrow("missing or is not an ancestor");
  });

  it.each([
    "package.json",
    "package-lock.json",
    "packages/gitlode/CHANGELOG.md",
    "src/index.ts",
    ".github/workflows/release.yml",
    "packages/gitlode/test/example.test.ts",
  ])("rejects a committed post-candidate change to %s", async (path) => {
    const { repository, candidateOid } = await repositoryFixture();
    await mkdir(join(repository, ...path.split("/").slice(0, -1)), { recursive: true });
    await writeFile(join(repository, path), "changed\n");
    await git(repository, "add", path);
    await git(repository, "commit", "-m", `change ${path}`);
    await writeRecord(repository, acceptedRecord(candidateOid));
    await git(repository, "add", ".release/telemetry-migration-acceptance.json");
    await git(repository, "commit", "--amend", "--no-edit");
    await expect(validateTelemetryReleaseAcceptance(repository)).rejects.toThrow(
      "differs from candidate outside acceptance record",
    );
  });

  it("rejects dirty relevant files while ignored build output remains irrelevant", async () => {
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
    const { repository } = await repositoryFixture("feature/release");
    await expect(
      validateTelemetryReleaseAcceptance(repository, {
        environment: { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/feature/release" },
      }),
    ).rejects.toThrow("Actions publishing is allowed only");
    await expect(
      validateTelemetryReleaseAcceptance(repository, {
        environment: { GITHUB_REF: "refs/heads/main" },
      }),
    ).rejects.toThrow("local publishing is allowed only");
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

  it("does not invoke a publisher stub when the record is blocked", async () => {
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
