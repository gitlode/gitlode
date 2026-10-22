// Five-commit fixture for product traversal/profile-equivalence and worker fallback regressions.
// Keep until those tests use an equivalent deterministic history; no calibration is performed.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  fixtureExec,
  fixtureWork,
  type FixtureWorkOwner,
  fixtureGitEnvironment,
  foregroundMaintenanceConfig,
} from "./fixture-git.js";

export const FIXED_SESSION_TIMESTAMP = "2024-02-03T04:05:06.000Z";
const identityEnvironment = {
  ...fixtureGitEnvironment(),
  GIT_AUTHOR_NAME: "Gitlode Fixture",
  GIT_AUTHOR_EMAIL: "fixture@gitlode.invalid",
  GIT_COMMITTER_NAME: "Gitlode Fixture",
  GIT_COMMITTER_EMAIL: "fixture@gitlode.invalid",
  TZ: "UTC",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
};
const isolatedConfig = [
  ...foregroundMaintenanceConfig,
  "-c",
  "commit.gpgSign=false",
  "-c",
  "tag.gpgSign=false",
  "-c",
  `core.hooksPath=${process.platform === "win32" ? "NUL" : "/dev/null"}`,
  "-c",
  "core.autocrlf=false",
  "-c",
  "core.fileMode=false",
];

export interface DeterministicRepository {
  readonly directory: string;
  readonly sessionTimestamp: string;
  readonly refs: Readonly<Record<string, string>>;
  readonly graph: readonly string[];
  readonly objectFormat: "sha1";
  readonly annotatedTagObject: string;
  readonly annotatedTagOid: string;
  readonly annotatedTagType: string;
  readonly lightweightTagType: string;
}

async function git(
  directory: string,
  args: readonly string[],
  date?: string,
  owner?: FixtureWorkOwner,
): Promise<string> {
  const { stdout } = await fixtureExec(owner, "git", [...isolatedConfig, ...args], {
    encoding: "utf8",
    cwd: directory,
    env: date
      ? { ...identityEnvironment, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
      : identityEnvironment,
  });
  return stdout.trim();
}
async function commit(
  directory: string,
  message: string,
  date: string,
  owner?: FixtureWorkOwner,
): Promise<void> {
  await git(directory, ["add", "-A"], undefined, owner);
  await git(directory, ["commit", "-m", message], date, owner);
}

/** Generates the accepted portable fixture recipe; no .git data is stored in the source tree. */
export async function createDeterministicRepository(
  directory: string,
  owner?: FixtureWorkOwner,
): Promise<DeterministicRepository> {
  await fixtureWork(owner, () => mkdir(directory, { recursive: true }));
  await git(
    directory,
    ["init", "--initial-branch=main", "--object-format=sha1", "--template="],
    undefined,
    owner,
  );
  await git(directory, ["config", "maintenance.autoDetach", "false"], undefined, owner);
  await git(directory, ["config", "gc.autoDetach", "false"], undefined, owner);
  await git(directory, ["config", "user.name", "Gitlode Fixture"], undefined, owner);
  await git(directory, ["config", "user.email", "fixture@gitlode.invalid"], undefined, owner);

  await fixtureWork(owner, () => writeFile(join(directory, "alpha.txt"), "root\n"));
  await fixtureWork(owner, () => writeFile(join(directory, "empty.txt"), ""));
  await commit(directory, "root commit", "2024-01-01T10:00:00+01:00", owner);
  await git(directory, ["tag", "root-lightweight"], undefined, owner);

  await fixtureWork(owner, () => writeFile(join(directory, "alpha.txt"), "root\nmain line\n"));
  await fixtureWork(owner, () => writeFile(join(directory, "utf8.txt"), "雪とgitlode\n"));
  await fixtureWork(owner, () =>
    writeFile(join(directory, "binary.dat"), Buffer.from([0, 1, 2, 255])),
  );
  await fixtureWork(owner, () => writeFile(join(directory, "limit-minus-one.txt"), "a".repeat(7)));
  await fixtureWork(owner, () => writeFile(join(directory, "limit-equal.txt"), "b".repeat(8)));
  await fixtureWork(owner, () => writeFile(join(directory, "limit-plus-one.txt"), "c".repeat(9)));
  await commit(directory, "main content", "2024-01-02T11:00:00-02:00", owner);
  const incrementalBoundary = await git(directory, ["rev-parse", "HEAD"], undefined, owner);

  await git(directory, ["switch", "-c", "topic", "HEAD~1"], undefined, owner);
  await fixtureWork(owner, () => writeFile(join(directory, "topic.txt"), "independent branch\n"));
  await commit(directory, "topic content", "2024-01-03T12:00:00+05:30", owner);
  await git(directory, ["switch", "main"], undefined, owner);
  await fixtureWork(owner, () => rm(join(directory, "empty.txt")));
  await fixtureWork(owner, () =>
    writeFile(join(directory, "alpha.txt"), "root\nmain line\nfinal line\n"),
  );
  await commit(directory, "main deletion and modification", "2024-01-04T13:00:00Z", owner);
  await git(
    directory,
    ["merge", "--no-ff", "topic", "-m", "merge topic"],
    "2024-01-05T14:00:00-07:00",
    owner,
  );
  await git(
    directory,
    ["tag", "-a", "release-annotated", "-m", "fixture release"],
    "2024-01-06T15:00:00+09:00",
    owner,
  );
  await git(directory, ["branch", "overlap", "HEAD"], undefined, owner);

  const refNames = ["main", "topic", "overlap", "root-lightweight", "release-annotated"];
  const refs = Object.fromEntries(
    await Promise.all(
      refNames.map(
        async (name) =>
          [
            name,
            await git(directory, ["rev-parse", `${name}^{commit}`], undefined, owner),
          ] as const,
      ),
    ),
  );
  const objectFormat = await git(
    directory,
    ["rev-parse", "--show-object-format"],
    undefined,
    owner,
  );
  if (objectFormat !== "sha1") throw new Error(`fixture requires SHA-1, received ${objectFormat}`);
  const annotatedTagOid = await git(
    directory,
    ["rev-parse", "release-annotated"],
    undefined,
    owner,
  );
  const annotatedTagObject = await git(
    directory,
    ["cat-file", "tag", annotatedTagOid],
    undefined,
    owner,
  );
  const annotatedTagType = await git(
    directory,
    ["cat-file", "-t", "release-annotated"],
    undefined,
    owner,
  );
  const lightweightTagType = await git(
    directory,
    ["cat-file", "-t", "root-lightweight"],
    undefined,
    owner,
  );
  return {
    directory,
    sessionTimestamp: FIXED_SESSION_TIMESTAMP,
    refs: { ...refs, incrementalBoundary },
    graph: (await git(directory, ["rev-list", "--topo-order", "--all"], undefined, owner)).split(
      "\n",
    ),
    objectFormat: "sha1",
    annotatedTagObject,
    annotatedTagOid,
    annotatedTagType,
    lightweightTagType,
  };
}

export async function repositorySemanticSnapshot(
  repository: DeterministicRepository,
  owner?: FixtureWorkOwner,
): Promise<unknown> {
  const commits = await Promise.all(
    repository.graph.map(async (oid) => ({
      oid,
      value: await git(
        repository.directory,
        ["show", "--no-patch", "--format=%T%n%P%n%an%n%ae%n%at%n%ai%n%B", oid],
        undefined,
        owner,
      ),
      tree: await git(repository.directory, ["ls-tree", "-r", oid], undefined, owner),
    })),
  );
  return {
    sessionTimestamp: repository.sessionTimestamp,
    refs: repository.refs,
    objectFormat: repository.objectFormat,
    annotatedTagObject: repository.annotatedTagObject,
    annotatedTagOid: repository.annotatedTagOid,
    annotatedTagType: repository.annotatedTagType,
    lightweightTagType: repository.lightweightTagType,
    commits,
  };
}
