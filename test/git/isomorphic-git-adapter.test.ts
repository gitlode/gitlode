import { Volume, createFsFromVolume } from "memfs";
import * as git from "isomorphic-git";
import { describe, expect, it } from "vitest";
import { IsomorphicGitAdapter } from "../../src/git/isomorphic-git-adapter.js";
import type { RawCommit } from "../../src/git/index.js";

const AUTHOR = {
  name: "Tester",
  email: "test@example.com",
  timestamp: 1_000_000,
  timezoneOffset: 0,
};

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

describe("IsomorphicGitAdapter.walkCommits", () => {
  it("full traversal (no excludeHash) yields all commits", async () => {
    const { fs, init, addCommit, collectAll } = makeRepo();
    await init();
    const sha1 = await addCommit("a.txt", "v1", "commit 1", 1000);
    const sha2 = await addCommit("a.txt", "v2", "commit 2", 2000);
    const sha3 = await addCommit("a.txt", "v3", "commit 3", 3000);

    const adapter = new IsomorphicGitAdapter(fs);
    const commits = await collectAll(adapter, sha3);

    const oids = commits.map((c) => c.oid);
    expect(oids).toContain(sha1);
    expect(oids).toContain(sha2);
    expect(oids).toContain(sha3);
    expect(oids).toHaveLength(3);
  });

  it("traversal with excludeHash stops at the correct boundary", async () => {
    const { fs, init, addCommit, collectAll } = makeRepo();
    await init();
    const sha1 = await addCommit("a.txt", "v1", "commit 1", 1000);
    const sha2 = await addCommit("a.txt", "v2", "commit 2", 2000);
    const sha3 = await addCommit("a.txt", "v3", "commit 3", 3000);

    const adapter = new IsomorphicGitAdapter(fs);
    // Exclude sha1 and its ancestors — should only yield sha2 and sha3
    const commits = await collectAll(adapter, sha3, sha1);

    const oids = commits.map((c) => c.oid);
    expect(oids).not.toContain(sha1);
    expect(oids).toContain(sha2);
    expect(oids).toContain(sha3);
    expect(oids).toHaveLength(2);
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

    const adapter = new IsomorphicGitAdapter(fs);
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
});

describe("IsomorphicGitAdapter.getRemoteUrl", () => {
  it("returns null when no remote is configured", async () => {
    const { fs, init } = makeRepo();
    await init();
    const adapter = new IsomorphicGitAdapter(fs);
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
    const adapter = new IsomorphicGitAdapter(fs);
    const url = await adapter.getRemoteUrl("/");
    expect(url).toBe("https://github.com/example/repo.git");
  });
});

describe("IsomorphicGitAdapter.resolveRef", () => {
  it("resolves a branch ref to a commit hash", async () => {
    const { fs, init, addCommit } = makeRepo();
    await init();
    const sha = await addCommit("f.txt", "v1", "initial commit");
    const adapter = new IsomorphicGitAdapter(fs);
    const resolved = await adapter.resolveRef("/", "main");
    expect(resolved).toBe(sha);
  });
});
