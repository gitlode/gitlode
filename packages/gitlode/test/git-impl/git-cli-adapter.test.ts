import nodeFs from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as git from "isomorphic-git";
import { afterEach, describe, expect, it } from "vitest";

import { GitCliAdapter, IsomorphicGitAdapter, JsDiffAdapter } from "../../src/git-impl/index.js";
import {
  LocalInstrumentationRecorder,
  noopInstrumentation,
} from "../../src/instrumentation/index.js";
import type { CommitOid } from "../../src/model/index.js";

const AUTHOR = {
  name: "Tester",
  email: "test@example.com",
  timestamp: 1_000_000,
  timezoneOffset: 0,
};

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "gitlode-git-cli-adapter-"));
  tempDirs.push(dir);
  await git.init({ fs: nodeFs, dir, defaultBranch: "main" });
  await git.setConfig({ fs: nodeFs, dir, path: "user.name", value: AUTHOR.name });
  await git.setConfig({ fs: nodeFs, dir, path: "user.email", value: AUTHOR.email });
  return dir;
}

function createAdapter(): GitCliAdapter {
  const fallback = new IsomorphicGitAdapter({
    fs: nodeFs,
    diffAdapter: new JsDiffAdapter(),
    instrumentation: noopInstrumentation,
  });
  return new GitCliAdapter({
    instrumentation: noopInstrumentation,
    fileChangeAdapter: fallback,
  });
}

async function addCommit(repoPath: string, filename: string, content: string, message: string) {
  await writeFile(join(repoPath, filename), content);
  await git.add({ fs: nodeFs, dir: repoPath, filepath: filename });
  return (await git.commit({
    fs: nodeFs,
    dir: repoPath,
    message,
    author: AUTHOR,
  })) as CommitOid;
}

async function collectWalk(
  adapter: GitCliAdapter,
  repoPath: string,
  head: CommitOid,
  exclude?: CommitOid,
) {
  const commits = [];
  for await (const commit of adapter.walkCommits(repoPath, head, exclude)) commits.push(commit);
  return commits;
}

describe("GitCliAdapter", () => {
  it("validates the git executable and returns version text", async () => {
    const version = await createAdapter().validateGitExecutable();
    expect(version).toMatch(/^git version /);
  });

  it("resolves branches, raw commit OIDs, and annotated tags to commits", async () => {
    const repoPath = await makeTempRepo();
    const head = await addCommit(repoPath, "file.txt", "hello", "initial");
    await git.annotatedTag({
      fs: nodeFs,
      dir: repoPath,
      ref: "v1.0.0",
      message: "release",
      object: head,
      tagger: AUTHOR,
    });

    const adapter = createAdapter();

    expect(await adapter.resolveRef(repoPath, "main")).toBe(head);
    expect(await adapter.resolveRef(repoPath, head)).toBe(head);
    expect(await adapter.resolveRef(repoPath, "v1.0.0")).toBe(head);
    expect(await adapter.classifyRefType(repoPath, "main")).toBe("branch");
    expect(await adapter.classifyRefType(repoPath, "v1.0.0")).toBe("tag-annotated");
  });

  it("streams rev-list output into cat-file batch and excludes reachable history", async () => {
    const repoPath = await makeTempRepo();
    const first = await addCommit(repoPath, "file.txt", "1", "first");
    const second = await addCommit(repoPath, "file.txt", "2", "second");
    const third = await addCommit(repoPath, "file.txt", "3", "third");
    const instrumentation = new LocalInstrumentationRecorder(() => Date.now());
    const fallback = new IsomorphicGitAdapter({
      fs: nodeFs,
      diffAdapter: new JsDiffAdapter(),
      instrumentation: noopInstrumentation,
    });
    const adapter = new GitCliAdapter({
      instrumentation,
      fileChangeAdapter: fallback,
    });

    const commits = await collectWalk(adapter, repoPath, third, first);

    expect(new Set(commits.map((commit) => commit.oid))).toEqual(new Set([second, third]));
    expect(commits[0]?.author.timezoneOffset).toBe(0);
    expect(commits[0]?.parents.length).toBeGreaterThan(0);
    expect(instrumentation.records()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "git.cli.rev_list",
          attributes: expect.objectContaining({ strategy: "git-cli-rev-list-stream" }),
          counters: expect.objectContaining({ yielded: 2 }),
        }),
        expect.objectContaining({
          name: "git.cli.cat_file_batch",
          counters: expect.objectContaining({ yielded: 2 }),
        }),
      ]),
    );
  });

  it("delegates file changes to the configured file-change adapter", async () => {
    const repoPath = await makeTempRepo();
    const first = await addCommit(repoPath, "file.txt", "one\n", "first");
    const second = await addCommit(repoPath, "file.txt", "one\ntwo\n", "second");

    const cliAdapter = createAdapter();
    const isomorphicAdapter = new IsomorphicGitAdapter({
      fs: nodeFs,
      diffAdapter: new JsDiffAdapter(),
      instrumentation: noopInstrumentation,
    });

    await expect(cliAdapter.getFileChanges(repoPath, second, first)).resolves.toEqual(
      await isomorphicAdapter.getFileChanges(repoPath, second, first),
    );
  });

  it("finds merge bases and returns null for disconnected histories", async () => {
    const repoPath = await makeTempRepo();
    const root = await addCommit(repoPath, "file.txt", "1", "root");
    const left = await addCommit(repoPath, "file.txt", "2", "left");
    await git.writeRef({ fs: nodeFs, dir: repoPath, ref: "refs/heads/right", value: root });
    await git.checkout({ fs: nodeFs, dir: repoPath, ref: "right" });
    const right = await addCommit(repoPath, "right.txt", "right", "right");

    const otherRepoPath = await makeTempRepo();
    const unrelated = await addCommit(otherRepoPath, "other.txt", "other", "other");
    const unrelatedObject = await git.readObject({
      fs: nodeFs,
      dir: otherRepoPath,
      oid: unrelated,
    });
    await git.writeObject({
      fs: nodeFs,
      dir: repoPath,
      type: unrelatedObject.type,
      object: unrelatedObject.object,
    });

    const adapter = createAdapter();

    expect(await adapter.findMergeBase(repoPath, [left, right])).toBe(root);
    expect(await adapter.findMergeBase(repoPath, [left, unrelated])).toBeNull();
  });
});
