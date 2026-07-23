import nodeFs from "node:fs";
import { mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import * as git from "isomorphic-git";
import { afterEach, describe, expect, it } from "vitest";

import {
  parseBatchObjectStream,
  parseRawDiffTreeOutput,
} from "../../src/git-impl/git-cli-adapter.js";
import { GitCliAdapter, IsomorphicGitAdapter } from "../../src/git-impl/index.js";
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
  return new GitCliAdapter({
    instrumentation: noopInstrumentation,
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

async function collectFileBlobChanges(
  adapter: GitCliAdapter,
  repoPath: string,
  commitOid: CommitOid,
  parentOid?: CommitOid,
) {
  const changes = [];
  for await (const change of adapter.getFileBlobChanges(repoPath, commitOid, parentOid)) {
    changes.push(change);
  }
  return changes;
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
    const adapter = new GitCliAdapter({
      instrumentation,
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

  it("rejects truncated cat-file batch output that omits the payload delimiter", async () => {
    const oid = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as CommitOid;
    const stream = Readable.from([Buffer.from(`${oid} commit 4\nabcd`)]);

    await expect(async () => {
      for await (const _object of parseBatchObjectStream(stream)) {
        // Drain the parser.
      }
    }).rejects.toThrow("Unexpected truncated cat-file batch output");
  });

  it("assembles fragmented cat-file payloads into one Uint8Array", async () => {
    const oid = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as CommitOid;
    const payload = Buffer.alloc(64 * 1024, 0x61);
    const response = Buffer.concat([
      Buffer.from(`${oid} blob ${payload.length}\n`),
      payload,
      Buffer.from("\n"),
    ]);
    const chunks = [];
    for (let offset = 0; offset < response.length; offset += 997) {
      chunks.push(response.subarray(offset, offset + 997));
    }

    const objects = [];
    for await (const object of parseBatchObjectStream(Readable.from(chunks))) {
      objects.push(object);
    }

    expect(objects).toEqual([{ oid, type: "blob", content: new Uint8Array(payload) }]);
  });

  it("normalizes raw A/M/D/T entries into file-backed blob changes", () => {
    const zero = "0".repeat(40);
    const first = "1".repeat(40);
    const second = "2".repeat(40);
    const third = "3".repeat(40);
    const fourth = "4".repeat(40);
    const output = Buffer.from(
      [
        `:000000 100644 ${zero} ${first} A\0added name\n.txt\0`,
        `:100644 100755 ${first} ${first} M\0script.sh\0`,
        `:120000 160000 ${second} ${third} T\0dependency\0`,
        `:160000 100644 ${third} ${fourth} T\0vendor.txt\0`,
        `:160000 160000 ${third} ${fourth} M\0ignored-submodule\0`,
      ].join(""),
    );

    expect(parseRawDiffTreeOutput(output)).toEqual([
      {
        status: "added",
        before: null,
        after: { path: "added name\n.txt", oid: first, mode: "100644" },
      },
      {
        status: "modified",
        before: { path: "script.sh", oid: first, mode: "100644" },
        after: { path: "script.sh", oid: first, mode: "100755" },
      },
      {
        status: "deleted",
        before: { path: "dependency", oid: second, mode: "120000" },
        after: null,
      },
      {
        status: "added",
        before: null,
        after: { path: "vendor.txt", oid: fourth, mode: "100644" },
      },
    ]);
  });

  it("rejects unterminated or unsupported raw diff-tree entries", () => {
    expect(() =>
      parseRawDiffTreeOutput(
        Buffer.from(`:000000 100644 ${"0".repeat(40)} ${"1".repeat(40)} A\0path`),
      ),
    ).toThrow("Unexpected unterminated diff-tree output");
    expect(() =>
      parseRawDiffTreeOutput(
        Buffer.from(`:000000 100644 ${"0".repeat(40)} ${"1".repeat(40)} R100\0path\0`),
      ),
    ).toThrow("Unexpected diff-tree entry");
  });

  it("reads file blob changes through the Git CLI with isomorphic-git parity", async () => {
    const repoPath = await makeTempRepo();
    const first = await addCommit(repoPath, "file.txt", "one\n", "first");
    const second = await addCommit(repoPath, "file.txt", "one\ntwo\n", "second");

    await using cliAdapter = createAdapter();
    const isomorphicAdapter = new IsomorphicGitAdapter({
      fs: nodeFs,
      instrumentation: noopInstrumentation,
    });

    const cliChanges = [];
    for await (const change of cliAdapter.getFileBlobChanges(repoPath, second, first)) {
      cliChanges.push(change);
    }
    const isomorphicChanges = [];
    for await (const change of isomorphicAdapter.getFileBlobChanges(repoPath, second, first)) {
      isomorphicChanges.push(change);
    }
    expect(cliChanges).toEqual(isomorphicChanges);
  });

  it("reads root additions and later additions and deletions without rename inference", async () => {
    const repoPath = await makeTempRepo();
    const root = await addCommit(repoPath, "a.txt", "a\n", "root");
    const added = await addCommit(repoPath, "b.txt", "b\n", "add b");
    await rm(join(repoPath, "a.txt"));
    await git.remove({ fs: nodeFs, dir: repoPath, filepath: "a.txt" });
    const deleted = (await git.commit({
      fs: nodeFs,
      dir: repoPath,
      message: "delete a",
      author: AUTHOR,
    })) as CommitOid;
    await using adapter = createAdapter();

    const rootChanges = await collectFileBlobChanges(adapter, repoPath, root);
    const addedChanges = await collectFileBlobChanges(adapter, repoPath, added, root);
    const deletedChanges = await collectFileBlobChanges(adapter, repoPath, deleted, added);

    expect(rootChanges).toEqual([
      expect.objectContaining({
        status: "added",
        before: null,
        after: expect.objectContaining({ path: "a.txt", content: new TextEncoder().encode("a\n") }),
      }),
    ]);
    expect(addedChanges).toEqual([
      expect.objectContaining({
        status: "added",
        before: null,
        after: expect.objectContaining({ path: "b.txt", content: new TextEncoder().encode("b\n") }),
      }),
    ]);
    expect(deletedChanges).toEqual([
      expect.objectContaining({
        status: "deleted",
        before: expect.objectContaining({
          path: "a.txt",
          content: new TextEncoder().encode("a\n"),
        }),
        after: null,
      }),
    ]);
  });

  it("reports an exact-content rename as independent deleted and added blob facts", async () => {
    const repoPath = await makeTempRepo();
    const root = await addCommit(repoPath, "before.txt", "same\n", "root");
    await rename(join(repoPath, "before.txt"), join(repoPath, "after.txt"));
    await git.remove({ fs: nodeFs, dir: repoPath, filepath: "before.txt" });
    await git.add({ fs: nodeFs, dir: repoPath, filepath: "after.txt" });
    const renamed = (await git.commit({
      fs: nodeFs,
      dir: repoPath,
      message: "rename",
      author: AUTHOR,
    })) as CommitOid;
    await using adapter = createAdapter();

    const changes = await collectFileBlobChanges(adapter, repoPath, renamed, root);

    expect(
      changes.map((change) => ({
        status: change.status,
        path: change.before?.path ?? change.after?.path,
        oid: change.before?.oid ?? change.after?.oid,
      })),
    ).toEqual(
      expect.arrayContaining([
        { status: "deleted", path: "before.txt", oid: expect.any(String) },
        { status: "added", path: "after.txt", oid: expect.any(String) },
      ]),
    );
    expect(changes).toHaveLength(2);
    expect(changes[0]?.before?.oid ?? changes[0]?.after?.oid).toBe(
      changes[1]?.before?.oid ?? changes[1]?.after?.oid,
    );
  });

  it("reuses one file-blob cat-file batch session per repository until disposal", async () => {
    const repoPath = await makeTempRepo();
    const root = await addCommit(repoPath, "file.txt", "one\n", "root");
    const second = await addCommit(repoPath, "file.txt", "one\ntwo\n", "second");
    let time = 0;
    const instrumentation = new LocalInstrumentationRecorder(() => ++time);

    async function exerciseAdapter() {
      await using adapter = new GitCliAdapter({ instrumentation });
      await collectFileBlobChanges(adapter, repoPath, root);
      await collectFileBlobChanges(adapter, repoPath, second, root);
    }
    await exerciseAdapter();

    const sessions = instrumentation
      .records()
      .filter((record) => record.name === "git.cli.file_blob_batch");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.counters).toEqual({ blob_bytes: 16, objects_read: 3 });
  });

  it("materializes CLI blob contents one change at a time as the consumer advances", async () => {
    const repoPath = await makeTempRepo();
    await writeFile(join(repoPath, "a.txt"), "a\n");
    await writeFile(join(repoPath, "b.txt"), "b\n");
    await git.add({ fs: nodeFs, dir: repoPath, filepath: "a.txt" });
    await git.add({ fs: nodeFs, dir: repoPath, filepath: "b.txt" });
    const root = (await git.commit({
      fs: nodeFs,
      dir: repoPath,
      message: "root",
      author: AUTHOR,
    })) as CommitOid;
    let time = 0;
    const instrumentation = new LocalInstrumentationRecorder(() => ++time);
    await using adapter = new GitCliAdapter({ instrumentation });
    const iterator = adapter.getFileBlobChanges(repoPath, root)[Symbol.asyncIterator]();
    const blobReadCalls = () =>
      instrumentation.summary().find((entry) => entry.name === "git.blob_read")?.calls ?? 0;

    expect(blobReadCalls()).toBe(0);
    expect((await iterator.next()).done).toBe(false);
    expect(blobReadCalls()).toBe(1);
    expect((await iterator.next()).done).toBe(false);
    expect(blobReadCalls()).toBe(2);
    expect((await iterator.next()).done).toBe(true);
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
