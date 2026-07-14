import * as git from "isomorphic-git";
import { Volume, createFsFromVolume } from "memfs";
import { describe, expect, it, vi } from "vitest";

import type { IsomorphicGitAdapterDependencies } from "../../src/git-impl/index.js";
import {
  IsomorphicGitAdapter,
  projectCommitParentSuccessors,
} from "../../src/git-impl/isomorphic-git-adapter.js";
import { JsDiffAdapter } from "../../src/git-impl/js-diff-adapter.js";
import { GitAdapterError, type RawCommit } from "../../src/git/index.js";
import { noopInstrumentation } from "../../src/instrumentation/index.js";

const AUTHOR = {
  name: "Tester",
  email: "test@example.com",
  timestamp: 1_000_000,
  timezoneOffset: 0,
};

function createAdapter(
  fs: IsomorphicGitAdapterDependencies["fs"],
  overrides: Partial<Omit<IsomorphicGitAdapterDependencies, "fs">> = {},
): IsomorphicGitAdapter {
  return new IsomorphicGitAdapter({
    fs,
    diffAdapter: overrides.diffAdapter ?? new JsDiffAdapter(),
    instrumentation: overrides.instrumentation ?? noopInstrumentation,
  });
}

/** Create a fresh in-memory repo and return the memfs-compatible fs and a helper to commit files. */
function makeRepo() {
  const vol = new Volume();
  const fs = createFsFromVolume(vol);

  async function init() {
    await git.init({ fs, dir: "/", defaultBranch: "main" });
    await git.setConfig({ fs, dir: "/", path: "user.name", value: "Tester" });
    await git.setConfig({
      fs,
      dir: "/",
      path: "user.email",
      value: "test@example.com",
    });
  }

  async function addCommit(
    filename: string,
    content: string,
    message: string,
    timestamp = AUTHOR.timestamp,
  ): Promise<string> {
    fs.mkdirSync("/", { recursive: true });
    fs.writeFileSync(`/${filename}`, content);
    await git.add({ fs, dir: "/", filepath: filename });
    return git.commit({
      fs,
      dir: "/",
      message,
      author: { ...AUTHOR, timestamp },
    });
  }

  async function collectAll(
    adapter: IsomorphicGitAdapter,
    head: string,
    excludeHash?: string,
  ): Promise<RawCommit[]> {
    const results: RawCommit[] = [];
    for await (const c of adapter.walkCommits("/", head, excludeHash)) {
      results.push(c);
    }
    return results;
  }

  return { fs, init, addCommit, collectAll };
}

async function writeCommit(
  fs: IsomorphicGitAdapterDependencies["fs"],
  tree: string,
  parents: string[],
  message: string,
  timestamp: number,
): Promise<string> {
  return git.writeCommit({
    fs,
    dir: "/",
    commit: {
      tree,
      parent: parents,
      message: `${message}\n`,
      author: { ...AUTHOR, timestamp },
      committer: { ...AUTHOR, timestamp },
    },
  });
}

describe("commit parent successor path scheduling hints", () => {
  it("projects the expanded child committer timestamp onto every parent path", () => {
    const commit: RawCommit = {
      oid: "c".repeat(40) as never,
      message: "merge\n",
      author: { ...AUTHOR, timestamp: 111 },
      committer: { ...AUTHOR, timestamp: 222 },
      parents: ["a".repeat(40) as never, "b".repeat(40) as never],
    };

    const successors = projectCommitParentSuccessors(commit);

    expect(successors).toEqual([
      { nodeId: "a".repeat(40), domainHint: { sourceCommitterTimestamp: 222 } },
      { nodeId: "b".repeat(40), domainHint: { sourceCommitterTimestamp: 222 } },
    ]);
  });
});

describe("IsomorphicGitAdapter.walkCommits", () => {
  it("full traversal (no excludeHash) yields all commits", async () => {
    const { fs, init, addCommit, collectAll } = makeRepo();
    await init();
    const sha1 = await addCommit("a.txt", "v1", "commit 1", 1000);
    const sha2 = await addCommit("a.txt", "v2", "commit 2", 2000);
    const sha3 = await addCommit("a.txt", "v3", "commit 3", 3000);

    const adapter = createAdapter(fs);
    const commits = await collectAll(adapter, sha3);

    const oids = commits.map((c) => c.oid);
    expect(oids).toContain(sha1);
    expect(oids).toContain(sha2);
    expect(oids).toContain(sha3);
    expect(oids).toHaveLength(3);
  });

  it("returns timezoneOffset as received from isomorphic-git (negated convention, pre-migration)", async () => {
    // isomorphic-git stores UTC offsets with inverted sign: JST (+09:00) is timezoneOffset -540.
    const { fs, init } = makeRepo();
    await init();

    fs.mkdirSync("/", { recursive: true });
    fs.writeFileSync("/a.txt", "content");
    await git.add({ fs, dir: "/", filepath: "a.txt" });
    const sha = await git.commit({
      fs,
      dir: "/",
      message: "commit with JST timezone",
      author: { ...AUTHOR, timezoneOffset: 540 },
      committer: { ...AUTHOR, timezoneOffset: 330 },
    });

    const adapter = createAdapter(fs);
    const commits: RawCommit[] = [];
    for await (const c of adapter.walkCommits("/", sha)) {
      commits.push(c);
    }

    expect(commits).toHaveLength(1);
    // Pre-migration: adapter passes through isomorphic-git's negated values
    expect(commits[0]!.author.timezoneOffset).toBe(-540);
    expect(commits[0]!.committer.timezoneOffset).toBe(-330);
  });

  it("traversal with excludeHash stops at the correct boundary", async () => {
    const { fs, init, addCommit, collectAll } = makeRepo();
    await init();
    const sha1 = await addCommit("a.txt", "v1", "commit 1", 1000);
    const sha2 = await addCommit("a.txt", "v2", "commit 2", 2000);
    const sha3 = await addCommit("a.txt", "v3", "commit 3", 3000);

    const adapter = createAdapter(fs);
    // Exclude sha1 and its ancestors — should only yield sha2 and sha3
    const commits = await collectAll(adapter, sha3, sha1);

    const oids = commits.map((c) => c.oid);
    expect(oids).not.toContain(sha1);
    expect(oids).toContain(sha2);
    expect(oids).toContain(sha3);
    expect(oids).toHaveLength(2);
  });

  it("uses the certified-lazy default through the adapter for a certified single-anchor walk", async () => {
    const { fs, init, addCommit, collectAll } = makeRepo();
    await init();
    const old = await addCommit("a.txt", "old", "old", 1000);
    const tree = (await git.readCommit({ fs, dir: "/", oid: old })).commit.tree;
    const release = await writeCommit(fs, tree, [old], "release", 2000);
    const after = await writeCommit(fs, tree, [release], "after", 3000);
    const head = await writeCommit(fs, tree, [after], "head", 4000);

    fs.unlinkSync(`/.git/objects/${old.slice(0, 2)}/${old.slice(2)}`);

    const commits = await collectAll(createAdapter(fs), head, release);

    expect(new Set(commits.map((commit) => commit.oid))).toEqual(new Set([head, after]));
  });

  it("reuses commit objects read during topology expansion for final yielding", async () => {
    const { fs, init, addCommit, collectAll } = makeRepo();
    await init();
    const root = await addCommit("a.txt", "root", "root", 1000);
    const child = await addCommit("a.txt", "child", "child", 2000);
    const head = await addCommit("a.txt", "head", "head", 3000);

    const readCommit = vi.spyOn(git, "readCommit");
    try {
      const commits = await collectAll(createAdapter(fs), head);

      expect(new Set(commits.map((commit) => commit.oid))).toEqual(new Set([head, child, root]));
      const reads = readCommit.mock.calls.map((call) => call[0].oid);
      expect(reads.filter((oid) => oid === head)).toHaveLength(1);
      expect(reads.filter((oid) => oid === child)).toHaveLength(1);
      expect(reads.filter((oid) => oid === root)).toHaveLength(1);
    } finally {
      readCommit.mockRestore();
    }
  });

  it("merge commit handling: exclusion stops at correct ancestors in a 2-parent DAG", async () => {
    // Build the DAG using writeCommit directly (no branch switching needed):
    //
    //   sha1 - sha2 - sha3 - sha4(merge) - sha5   <- main
    //                  \               /
    //                   shaA - shaB - shaC           <- side commits
    //
    // Previous run extracted up to sha3. Next run starts from sha5 with excludeHash=sha3.
    // Expected new commits: sha5, sha4, shaA, shaB, shaC
    // Must NOT appear: sha3, sha2, sha1

    const vol = new Volume();
    const fs = createFsFromVolume(vol);
    await git.init({ fs, dir: "/", defaultBranch: "main" });
    await git.setConfig({ fs, dir: "/", path: "user.name", value: "Tester" });
    await git.setConfig({
      fs,
      dir: "/",
      path: "user.email",
      value: "test@example.com",
    });

    fs.writeFileSync("/main.txt", "1");
    await git.add({ fs, dir: "/", filepath: "main.txt" });
    const sha1 = await git.commit({
      fs,
      dir: "/",
      message: "commit 1\n",
      author: { ...AUTHOR, timestamp: 1000 },
    });

    fs.writeFileSync("/main.txt", "2");
    await git.add({ fs, dir: "/", filepath: "main.txt" });
    const sha2 = await git.commit({
      fs,
      dir: "/",
      message: "commit 2\n",
      author: { ...AUTHOR, timestamp: 2000 },
    });

    fs.writeFileSync("/main.txt", "3");
    await git.add({ fs, dir: "/", filepath: "main.txt" });
    const sha3 = await git.commit({
      fs,
      dir: "/",
      message: "commit 3\n",
      author: { ...AUTHOR, timestamp: 3000 },
    });

    // Build side branch commits rooted at sha2 using writeCommit (controls parents directly)
    const treeForSide = (await git.readCommit({ fs, dir: "/", oid: sha2 })).commit.tree;

    const shaA = await git.writeCommit({
      fs,
      dir: "/",
      commit: {
        tree: treeForSide,
        parent: [sha2],
        message: "commit A\n",
        author: { ...AUTHOR, timestamp: 4000 },
        committer: { ...AUTHOR, timestamp: 4000 },
      },
    });

    const shaB = await git.writeCommit({
      fs,
      dir: "/",
      commit: {
        tree: treeForSide,
        parent: [shaA],
        message: "commit B\n",
        author: { ...AUTHOR, timestamp: 5000 },
        committer: { ...AUTHOR, timestamp: 5000 },
      },
    });

    const shaC = await git.writeCommit({
      fs,
      dir: "/",
      commit: {
        tree: treeForSide,
        parent: [shaB],
        message: "commit C\n",
        author: { ...AUTHOR, timestamp: 6000 },
        committer: { ...AUTHOR, timestamp: 6000 },
      },
    });

    // sha4 = merge commit with two parents: sha3 (main) and shaC (side)
    const treeSha3 = (await git.readCommit({ fs, dir: "/", oid: sha3 })).commit.tree;
    const sha4 = await git.writeCommit({
      fs,
      dir: "/",
      commit: {
        tree: treeSha3,
        parent: [sha3, shaC],
        message: "commit 4 (merge)\n",
        author: { ...AUTHOR, timestamp: 7000 },
        committer: { ...AUTHOR, timestamp: 7000 },
      },
    });

    // sha5 on top of sha4
    const sha5 = await git.writeCommit({
      fs,
      dir: "/",
      commit: {
        tree: treeSha3,
        parent: [sha4],
        message: "commit 5\n",
        author: { ...AUTHOR, timestamp: 8000 },
        committer: { ...AUTHOR, timestamp: 8000 },
      },
    });

    const adapter = createAdapter(fs);
    const results: RawCommit[] = [];
    for await (const c of adapter.walkCommits("/", sha5, sha3)) {
      results.push(c);
    }

    const oids = new Set(results.map((c) => c.oid));
    // Must include: sha5, sha4, shaA, shaB, shaC
    expect(oids.has(sha5)).toBe(true);
    expect(oids.has(sha4)).toBe(true);
    expect(oids.has(shaA)).toBe(true);
    expect(oids.has(shaB)).toBe(true);
    expect(oids.has(shaC)).toBe(true);
    // Must NOT include: sha3, sha2, sha1
    expect(oids.has(sha3)).toBe(false);
    expect(oids.has(sha2)).toBe(false);
    expect(oids.has(sha1)).toBe(false);
    expect(results).toHaveLength(5);
  });

  it("includes a branch forked before the excluded release and merged afterward", async () => {
    // root -- fork -- release -- mainAfter -- merge (head)
    //           \-- sideA -- sideB --------/
    const { fs, init, addCommit, collectAll } = makeRepo();
    await init();
    const root = await addCommit("a.txt", "root", "root", 1000);
    const tree = (await git.readCommit({ fs, dir: "/", oid: root })).commit.tree;
    const fork = await writeCommit(fs, tree, [root], "fork", 2000);
    const release = await writeCommit(fs, tree, [fork], "release", 3000);
    const mainAfter = await writeCommit(fs, tree, [release], "main after release", 4000);
    const sideA = await writeCommit(fs, tree, [fork], "side A", 2500);
    const sideB = await writeCommit(fs, tree, [sideA], "side B", 3500);
    const head = await writeCommit(fs, tree, [mainAfter, sideB], "merge", 5000);

    const commits = await collectAll(createAdapter(fs), head, release);

    expect(new Set(commits.map((commit) => commit.oid))).toEqual(
      new Set([head, mainAfter, sideB, sideA]),
    );
  });

  it("subtracts ancestors of an unreachable excludeHash that shares an ancestor with head", async () => {
    // root -- common -- headA -- headB (head)
    //                \-- excludedTip (excludeHash)
    const { fs, init, addCommit, collectAll } = makeRepo();
    await init();
    const root = await addCommit("a.txt", "root", "root", 1000);
    const tree = (await git.readCommit({ fs, dir: "/", oid: root })).commit.tree;
    const common = await writeCommit(fs, tree, [root], "common", 2000);
    const headA = await writeCommit(fs, tree, [common], "head A", 3000);
    const head = await writeCommit(fs, tree, [headA], "head B", 4000);
    const excludedTip = await writeCommit(fs, tree, [common], "excluded tip", 3500);

    const commits = await collectAll(createAdapter(fs), head, excludedTip);

    expect(new Set(commits.map((commit) => commit.oid))).toEqual(new Set([head, headA]));
  });

  it("walks the reachable set when commit timestamps run backward", async () => {
    // root(3000) -- child(1000) -- head(2000)
    const { fs, init, addCommit, collectAll } = makeRepo();
    await init();
    const root = await addCommit("a.txt", "root", "root", 3000);
    const tree = (await git.readCommit({ fs, dir: "/", oid: root })).commit.tree;
    const child = await writeCommit(fs, tree, [root], "child", 1000);
    const head = await writeCommit(fs, tree, [child], "head", 2000);

    const commits = await collectAll(createAdapter(fs), head);

    expect(new Set(commits.map((commit) => commit.oid))).toEqual(new Set([head, child, root]));
  });

  it("maps a missing include-side start commit to COMMIT_NOT_FOUND", async () => {
    const { fs, init, collectAll } = makeRepo();
    await init();

    const error = await collectAll(createAdapter(fs), "0".repeat(40)).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(GitAdapterError);
    expect((error as GitAdapterError).code).toBe("COMMIT_NOT_FOUND");
  });

  it("maps a missing excludeHash to COMMIT_NOT_FOUND", async () => {
    const { fs, init, addCommit, collectAll } = makeRepo();
    await init();
    const head = await addCommit("a.txt", "head", "head", 1000);

    const error = await collectAll(createAdapter(fs), head, "0".repeat(40)).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(GitAdapterError);
    expect((error as GitAdapterError).code).toBe("COMMIT_NOT_FOUND");
  });
});

describe("IsomorphicGitAdapter.getRemoteUrl", () => {
  it("returns null when no remote is configured", async () => {
    const { fs, init } = makeRepo();
    await init();
    const adapter = createAdapter(fs);
    const url = await adapter.getRemoteUrl("/");
    expect(url).toBeNull();
  });

  it("returns the remote URL when origin is configured", async () => {
    const { fs, init } = makeRepo();
    await init();
    await git.setConfig({
      fs,
      dir: "/",
      path: "remote.origin.url",
      value: "https://github.com/example/repo.git",
    });
    const adapter = createAdapter(fs);
    const url = await adapter.getRemoteUrl("/");
    expect(url).toBe("https://github.com/example/repo.git");
  });
});

describe("IsomorphicGitAdapter.resolveRef", () => {
  it("resolves a branch ref to a commit hash", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha = await addCommit("f.txt", "v1", "initial commit");
    const adapter = createAdapter(fs);
    const resolved = await adapter.resolveRef("/", "main");
    expect(resolved).toBe(sha);
  });

  it("resolves a lightweight tag directly to the commit OID", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha = await addCommit("f.txt", "v1", "initial");
    await git.tag({ fs, dir: "/", ref: "v1.0" });
    const adapter = createAdapter(fs);
    const resolved = await adapter.resolveRef("/", "v1.0");
    expect(resolved).toBe(sha);
  });

  it("peels an annotated tag to the target commit OID", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha = await addCommit("f.txt", "v1", "initial");
    await git.annotatedTag({
      fs,
      dir: "/",
      ref: "v1.0-ann",
      object: sha,
      tagger: {
        name: "Tagger",
        email: "tag@example.com",
        timestamp: 0,
        timezoneOffset: 0,
      },
      message: "release v1.0",
    });
    const adapter = createAdapter(fs);
    const resolved = await adapter.resolveRef("/", "v1.0-ann");
    expect(resolved).toBe(sha);
  });

  it("resolves a raw commit OID when the ref name is not found", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha = await addCommit("f.txt", "v1", "initial");
    const adapter = createAdapter(fs);
    const resolved = await adapter.resolveRef("/", sha);
    expect(resolved).toBe(sha);
  });

  it("throws REF_NOT_FOUND for a nonexistent ref name", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    await addCommit("f.txt", "v1", "initial");
    const { GitAdapterError } = await import("../../src/git/index.js");
    const adapter = createAdapter(fs);
    const err = await adapter.resolveRef("/", "nonexistent").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GitAdapterError);
    expect((err as InstanceType<typeof GitAdapterError>).code).toBe("REF_NOT_FOUND");
  });
});

describe("IsomorphicGitAdapter.classifyRefType", () => {
  it("returns 'branch' for a branch ref", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    await addCommit("f.txt", "v1", "initial commit");
    const adapter = createAdapter(fs);
    expect(await adapter.classifyRefType("/", "main")).toBe("branch");
  });

  it("returns 'tag-lightweight' for a lightweight tag", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha = await addCommit("f.txt", "v1", "initial");
    await git.tag({ fs, dir: "/", ref: "v1.0" });
    const adapter = createAdapter(fs);
    expect(await adapter.classifyRefType("/", "v1.0")).toBe("tag-lightweight");
    // Sanity: the tag still resolves correctly
    expect(await adapter.resolveRef("/", "v1.0")).toBe(sha);
  });

  it("returns 'tag-annotated' for an annotated tag", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha = await addCommit("f.txt", "v1", "initial");
    await git.annotatedTag({
      fs,
      dir: "/",
      ref: "v1.0-ann",
      object: sha,
      tagger: {
        name: "Tagger",
        email: "tag@example.com",
        timestamp: 0,
        timezoneOffset: 0,
      },
      message: "release v1.0",
    });
    const adapter = createAdapter(fs);
    expect(await adapter.classifyRefType("/", "v1.0-ann")).toBe("tag-annotated");
  });

  it("returns 'commit-oid' for a raw commit OID", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha = await addCommit("f.txt", "v1", "initial");
    const adapter = createAdapter(fs);
    expect(await adapter.classifyRefType("/", sha)).toBe("commit-oid");
  });

  it("returns 'commit-oid' for a nonexistent ref name", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    await addCommit("f.txt", "v1", "initial");
    const adapter = createAdapter(fs);
    expect(await adapter.classifyRefType("/", "nonexistent")).toBe("commit-oid");
  });
});

describe("IsomorphicGitAdapter.getRepositoryObjectFormat", () => {
  it("defaults to sha1 when extensions.objectformat is unset", async () => {
    const { fs, init } = makeRepo();
    await init();

    const adapter = createAdapter(fs);
    expect(await adapter.getRepositoryObjectFormat("/")).toBe("sha1");
  });

  it("returns configured repository object format", async () => {
    const { fs, init } = makeRepo();
    await init();
    await git.setConfig({
      fs,
      dir: "/",
      path: "extensions.objectformat",
      value: "sha256",
    });

    const adapter = createAdapter(fs);
    expect(await adapter.getRepositoryObjectFormat("/")).toBe("sha256");
  });
});

describe("IsomorphicGitAdapter.supportedObjectFormats", () => {
  it("returns the adapter capability list for object formats", async () => {
    const { fs, init } = makeRepo();
    await init();

    const adapter = createAdapter(fs);
    expect(adapter.supportedObjectFormats()).toEqual(["sha1"]);
  });
});

/** Extend makeRepo with helpers for deletion and binary content. */
function makeRepoExt() {
  const base = makeRepo();
  const { fs } = base;

  async function removeCommit(filename: string, message: string): Promise<string> {
    await git.remove({ fs, dir: "/", filepath: filename });
    return git.commit({
      fs,
      dir: "/",
      message,
      author: { ...AUTHOR, timestamp: AUTHOR.timestamp },
    });
  }

  async function addBinaryCommit(filename: string, message: string): Promise<string> {
    const binaryContent = Buffer.from([
      0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57, 0x6f, 0x72, 0x6c, 0x64,
    ]);
    (fs as { writeFileSync: (p: string, d: Buffer) => void }).writeFileSync(
      `/${filename}`,
      binaryContent,
    );
    await git.add({ fs, dir: "/", filepath: filename });
    return git.commit({
      fs,
      dir: "/",
      message,
      author: { ...AUTHOR, timestamp: AUTHOR.timestamp },
    });
  }

  return { ...base, removeCommit, addBinaryCommit };
}

describe("IsomorphicGitAdapter.getFileChanges – DiffAdapter substitution seam", () => {
  it("uses injected adapter counts for text file changes", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha1 = await addCommit("a.txt", "line1\nline2\n", "root commit");
    const sha2 = await addCommit("a.txt", "line1\nline3\nline4\n", "modify a.txt");

    let callCount = 0;
    const stubAdapter = {
      computeLineDiff: (_before: Uint8Array, _after: Uint8Array) => {
        callCount++;
        return { additions: 99, deletions: 77 };
      },
    };

    const adapter = createAdapter(fs, { diffAdapter: stubAdapter });
    const changes = await adapter.getFileChanges("/", sha2 as never, sha1 as never);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      path: "a.txt",
      status: "modified",
      additions: 99,
      deletions: 77,
    });
    expect(callCount).toBe(1);
  });

  it("does not invoke injected adapter when blob is binary", async () => {
    const { fs, init, addBinaryCommit } = makeRepoExt();
    await init();
    const sha1 = await addBinaryCommit("binary.bin", "add binary file");

    let callCount = 0;
    const stubAdapter = {
      computeLineDiff: (_before: Uint8Array, _after: Uint8Array) => {
        callCount++;
        return { additions: 1, deletions: 1 };
      },
    };

    const adapter = createAdapter(fs, { diffAdapter: stubAdapter });
    const changes = await adapter.getFileChanges("/", sha1 as never);

    expect(callCount).toBe(0);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ additions: null, deletions: null });
  });

  it("throws when injected adapter returns negative additions", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha1 = await addCommit("a.txt", "line1\n", "root commit");

    const badAdapter = {
      computeLineDiff: (_before: Uint8Array, _after: Uint8Array) => ({
        additions: -1,
        deletions: 0,
      }),
    };

    const adapter = createAdapter(fs, { diffAdapter: badAdapter });
    const { GitAdapterError } = await import("../../src/git/index.js");
    await expect(adapter.getFileChanges("/", sha1 as never)).rejects.toBeInstanceOf(
      GitAdapterError,
    );
  });
});

describe("IsomorphicGitAdapter.getFileChanges", () => {
  it("root commit: all files are 'added'", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha1 = await addCommit("a.txt", "line1\nline2\n", "root commit");

    const adapter = createAdapter(fs);
    const changes = await adapter.getFileChanges("/", sha1 as never);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      path: "a.txt",
      status: "added",
      additions: 2,
      deletions: 0,
    });
  });

  it("file added: correct addition count, deletions = 0", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha1 = await addCommit("a.txt", "line1\nline2\n", "root commit");
    const sha2 = await addCommit("b.txt", "new1\n", "add b.txt");

    const adapter = createAdapter(fs);
    const changes = await adapter.getFileChanges("/", sha2 as never, sha1 as never);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      path: "b.txt",
      status: "added",
      additions: 1,
      deletions: 0,
    });
  });

  it("file modified: correct addition and deletion counts", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha1 = await addCommit("a.txt", "line1\nline2\n", "root commit");
    // Modify: remove line2, add line3 and line4
    const sha2 = await addCommit("a.txt", "line1\nline3\nline4\n", "modify a.txt");

    const adapter = createAdapter(fs);
    const changes = await adapter.getFileChanges("/", sha2 as never, sha1 as never);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      path: "a.txt",
      status: "modified",
      additions: 2,
      deletions: 1,
    });
  });

  it("file deleted: additions = 0, correct deletion count", async () => {
    const { fs, init, addCommit, removeCommit } = makeRepoExt();
    await init();
    await addCommit("a.txt", "line1\nline2\n", "root commit");
    const sha2 = await addCommit("b.txt", "x\n", "add b.txt");
    const sha3 = await removeCommit("b.txt", "delete b.txt");

    const adapter = createAdapter(fs);
    const changes = await adapter.getFileChanges("/", sha3 as never, sha2 as never);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      path: "b.txt",
      status: "deleted",
      additions: 0,
      deletions: 1,
    });
  });

  it("binary file: additions and deletions are null", async () => {
    const { fs, init, addBinaryCommit } = makeRepoExt();
    await init();
    const sha1 = await addBinaryCommit("binary.bin", "add binary file");

    const adapter = createAdapter(fs);
    const changes = await adapter.getFileChanges("/", sha1 as never);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      path: "binary.bin",
      status: "added",
      additions: null,
      deletions: null,
    });
  });

  it("empty commit: returns empty array", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha1 = await addCommit("a.txt", "line1\n", "root commit");

    // Create a commit with same tree as sha1 (no file changes)
    const { commit: parentCommit } = await git.readCommit({
      fs,
      dir: "/",
      oid: sha1,
    });
    const emptyCommit = await git.writeCommit({
      fs,
      dir: "/",
      commit: {
        tree: parentCommit.tree,
        parent: [sha1],
        message: "empty commit\n",
        author: { ...AUTHOR, timestamp: AUTHOR.timestamp + 1000 },
        committer: { ...AUTHOR, timestamp: AUTHOR.timestamp + 1000 },
      },
    });

    const adapter = createAdapter(fs);
    const changes = await adapter.getFileChanges("/", emptyCommit as never, sha1 as never);

    expect(changes).toHaveLength(0);
  });
});

describe("IsomorphicGitAdapter.findMergeBase", () => {
  it("returns the common ancestor for a forked history", async () => {
    // Build:  sha1 → sha2 (main)
    //                ↓
    //               shaA (feature)
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha1 = await addCommit("a.txt", "v1", "commit 1", 1000);
    const sha2 = await addCommit("a.txt", "v2", "commit 2", 2000);

    // Feature branch diverges from sha1
    const treeForFeature = (await git.readCommit({ fs, dir: "/", oid: sha1 })).commit.tree;
    const shaA = await git.writeCommit({
      fs,
      dir: "/",
      commit: {
        tree: treeForFeature,
        parent: [sha1],
        message: "feature A\n",
        author: { ...AUTHOR, timestamp: 3000 },
        committer: { ...AUTHOR, timestamp: 3000 },
      },
    });

    const adapter = createAdapter(fs);
    // Merge base of sha2 and shaA should be sha1 (their common ancestor)
    const result = await adapter.findMergeBase("/", [sha2, shaA] as never);
    expect(result).toBe(sha1);
  });

  it("returns null for detached histories (no common ancestor)", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha1 = await addCommit("a.txt", "v1", "main commit", 1000);

    // Create an orphan commit with no parents
    const existingTree = (await git.readCommit({ fs, dir: "/", oid: sha1 })).commit.tree;
    const orphanSha = await git.writeCommit({
      fs,
      dir: "/",
      commit: {
        tree: existingTree,
        parent: [],
        message: "orphan commit\n",
        author: { ...AUTHOR, timestamp: 2000 },
        committer: { ...AUTHOR, timestamp: 2000 },
      },
    });

    const adapter = createAdapter(fs);
    // sha1 and orphanSha have no common ancestor
    const result = await adapter.findMergeBase("/", [sha1, orphanSha] as never);
    expect(result).toBeNull();
  });

  it("wraps unexpected errors as MERGE_BASE_NOT_FOUND", async () => {
    const { fs, init } = makeRepo();
    await init();

    const adapter = createAdapter(fs);

    // Force git.findMergeBase to throw an unexpected error
    const spy = vi.spyOn(git, "findMergeBase").mockRejectedValueOnce(new Error("internal error"));

    try {
      await expect(adapter.findMergeBase("/", ["a".repeat(40)] as never)).rejects.toMatchObject({
        code: "MERGE_BASE_NOT_FOUND",
      });
    } finally {
      spy.mockRestore();
    }
  });
});

describe("IsomorphicGitAdapter instrumentation injection", () => {
  it("adapter-level and file-change spans accumulate when instrumentation is passed to the constructor", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha1 = await addCommit("a.txt", "hello\nworld\n", "root commit");
    const sha2 = await addCommit("a.txt", "hello\nuniverse\n", "modify file");

    let time = 0;
    const clock = () => ++time;

    const { LocalInstrumentationRecorder } = await import("../../src/instrumentation/index.js");
    const instrumentation = new LocalInstrumentationRecorder(clock);

    const adapter = createAdapter(fs, { instrumentation });

    await adapter.getFileChanges("/", sha2 as never, sha1 as never);
    // Also exercise resolve and merge-base paths so adapter-level buckets are populated.
    await adapter.resolveRef("/", "main");
    await adapter.findMergeBase("/", [sha2 as never, sha1 as never]);
    for await (const _c of adapter.walkCommits("/", sha2 as never, sha1 as never)) {
      // Drain iterator
    }

    const entries = instrumentation.summary();
    const resolveRefEntry = entries.find((e) => e.name === "git.resolve_ref");
    const mergeBaseEntry = entries.find((e) => e.name === "git.merge_base");
    const walkEntry = entries.find((e) => e.name === "git.walk_commits");
    const traversalEntry = entries.find((e) => e.name === "dag.traversal");
    const fileChangesEntry = entries.find((e) => e.name === "git.file_changes");
    const blobEntry = entries.find((e) => e.name === "git.blob_read");
    const diffEntry = entries.find((e) => e.name === "git.diff");
    expect(resolveRefEntry?.totalMs).toBeGreaterThan(0);
    expect(mergeBaseEntry?.totalMs).toBeGreaterThan(0);
    expect(walkEntry?.totalMs).toBeGreaterThan(0);
    expect(walkEntry?.counters).toEqual({
      commit_reads: 2,
      commits_yielded: 1,
      materialize_commit_cache_hits: 1,
      topology_commit_cache_hits: 1,
      topology_commit_reads: 2,
    });
    expect(traversalEntry?.attributes).toEqual({
      result: ["certified"],
      strategy: ["certifiedLazy"],
    });
    expect(traversalEntry?.counters).toEqual(
      expect.objectContaining({
        exclude_expansions: 2,
        main_expansions: 1,
        successor_expansions: 3,
        yielded_nodes: 1,
      }),
    );
    expect(fileChangesEntry?.totalMs).toBeGreaterThan(0);
    expect(blobEntry?.totalMs).toBeGreaterThan(0);
    expect(diffEntry?.totalMs).toBeGreaterThan(0);
  });
});
