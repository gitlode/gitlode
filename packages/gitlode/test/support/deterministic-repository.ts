import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
export const FIXED_SESSION_TIMESTAMP = "2024-02-03T04:05:06.000Z";
const identityEnvironment = {
  ...process.env,
  GIT_AUTHOR_NAME: "Gitlode Fixture",
  GIT_AUTHOR_EMAIL: "fixture@gitlode.invalid",
  GIT_COMMITTER_NAME: "Gitlode Fixture",
  GIT_COMMITTER_EMAIL: "fixture@gitlode.invalid",
  TZ: "UTC",
};

export interface DeterministicRepository {
  readonly directory: string;
  readonly sessionTimestamp: string;
  readonly refs: Readonly<Record<string, string>>;
  readonly graph: readonly string[];
}

async function git(directory: string, args: readonly string[], date?: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: directory,
    env: date
      ? { ...identityEnvironment, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
      : identityEnvironment,
  });
  return stdout.trim();
}
async function commit(directory: string, message: string, date: string): Promise<void> {
  await git(directory, ["add", "-A"]);
  await git(directory, ["commit", "-m", message], date);
}

/** Generates the accepted portable fixture recipe; no .git data is stored in the source tree. */
export async function createDeterministicRepository(
  directory: string,
): Promise<DeterministicRepository> {
  await mkdir(directory, { recursive: true });
  await git(directory, ["init", "--initial-branch=main"]);
  await git(directory, ["config", "user.name", "Gitlode Fixture"]);
  await git(directory, ["config", "user.email", "fixture@gitlode.invalid"]);

  await writeFile(join(directory, "alpha.txt"), "root\n");
  await writeFile(join(directory, "empty.txt"), "");
  await commit(directory, "root commit", "2024-01-01T10:00:00+01:00");
  await git(directory, ["tag", "root-lightweight"]);

  await writeFile(join(directory, "alpha.txt"), "root\nmain line\n");
  await writeFile(join(directory, "utf8.txt"), "雪とgitlode\n");
  await writeFile(join(directory, "binary.dat"), Buffer.from([0, 1, 2, 255]));
  await writeFile(join(directory, "limit-minus-one.txt"), "a".repeat(7));
  await writeFile(join(directory, "limit-equal.txt"), "b".repeat(8));
  await writeFile(join(directory, "limit-plus-one.txt"), "c".repeat(9));
  await commit(directory, "main content", "2024-01-02T11:00:00-02:00");
  const incrementalBoundary = await git(directory, ["rev-parse", "HEAD"]);

  await git(directory, ["switch", "-c", "topic", "HEAD~1"]);
  await writeFile(join(directory, "topic.txt"), "independent branch\n");
  await commit(directory, "topic content", "2024-01-03T12:00:00+05:30");
  await git(directory, ["switch", "main"]);
  await rm(join(directory, "empty.txt"));
  await writeFile(join(directory, "alpha.txt"), "root\nmain line\nfinal line\n");
  await commit(directory, "main deletion and modification", "2024-01-04T13:00:00Z");
  await git(
    directory,
    ["merge", "--no-ff", "topic", "-m", "merge topic"],
    "2024-01-05T14:00:00-07:00",
  );
  await git(
    directory,
    ["tag", "-a", "release-annotated", "-m", "fixture release"],
    "2024-01-06T15:00:00+09:00",
  );
  await git(directory, ["branch", "overlap", "HEAD"]);

  const refNames = ["main", "topic", "overlap", "root-lightweight", "release-annotated"];
  const refs = Object.fromEntries(
    await Promise.all(
      refNames.map(
        async (name) => [name, await git(directory, ["rev-parse", `${name}^{commit}`])] as const,
      ),
    ),
  );
  return {
    directory,
    sessionTimestamp: FIXED_SESSION_TIMESTAMP,
    refs: { ...refs, incrementalBoundary },
    graph: (await git(directory, ["rev-list", "--topo-order", "--all"])).split("\n"),
  };
}

export async function repositorySemanticSnapshot(
  repository: DeterministicRepository,
): Promise<unknown> {
  const commits = await Promise.all(
    repository.graph.map(async (oid) => ({
      oid,
      value: await git(repository.directory, [
        "show",
        "--no-patch",
        "--format=%T%n%P%n%an%n%ae%n%at%n%ai%n%B",
        oid,
      ]),
      tree: await git(repository.directory, ["ls-tree", "-r", oid]),
    })),
  );
  return { sessionTimestamp: repository.sessionTimestamp, refs: repository.refs, commits };
}
