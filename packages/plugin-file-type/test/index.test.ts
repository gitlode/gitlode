import type { CommitFact, CommitOid, ProjectedCommit, ProjectionContext } from "gitlode/plugin-api";
import { describe, expect, it } from "vitest";

import factory from "../src/index.js";

describe("plugin factory", () => {
  it("exports a default factory function", () => {
    expect(typeof factory).toBe("function");
  });

  it("classifies file-change facts with the common rule set", async () => {
    const plugin = await factory(undefined);
    await plugin.init(createRuntime());

    await expect(plugin.project(createFileChangeContext("src/index.ts"))).resolves.toEqual({
      type: "success",
      data: { name: "TypeScript" },
    });
  });

  it("skips commit facts", async () => {
    const plugin = await factory(undefined);
    await plugin.init(createRuntime());

    await expect(plugin.project(createCommitContext())).resolves.toEqual({
      type: "skip",
    });
  });

  it("uses plugin mappings before built-in mappings", async () => {
    const plugin = await factory({ mappings: { "*.ts": "Custom TypeScript" } });
    await plugin.init(createRuntime());

    await expect(plugin.project(createFileChangeContext("src/index.ts"))).resolves.toEqual({
      type: "success",
      data: { name: "Custom TypeScript" },
    });
  });

  it("emits Unknown by default for unknown paths", async () => {
    const plugin = await factory(undefined);
    await plugin.init(createRuntime());

    await expect(plugin.project(createFileChangeContext("src/file.unmapped"))).resolves.toEqual({
      type: "success",
      data: { name: "Unknown" },
    });
  });

  it("skips unknown paths when unknownPolicy is skip", async () => {
    const plugin = await factory({ unknownPolicy: "skip" });
    await plugin.init(createRuntime());

    await expect(plugin.project(createFileChangeContext("src/file.unmapped"))).resolves.toEqual({
      type: "skip",
    });
  });

  it("classifies deleted file changes", async () => {
    const plugin = await factory(undefined);
    await plugin.init(createRuntime());

    await expect(
      plugin.project(createFileChangeContext("src/index.ts", "deleted")),
    ).resolves.toEqual({
      type: "success",
      data: { name: "TypeScript" },
    });
  });

  it("emits debug metadata when configured", async () => {
    const plugin = await factory({ debug: true });
    await plugin.init(createRuntime());

    await expect(plugin.project(createFileChangeContext("src/index.ts"))).resolves.toEqual({
      type: "success",
      data: {
        name: "TypeScript",
        _debug: {
          source: "common",
          matched: "*.ts",
        },
      },
    });
  });

  it("fails initialization for invalid config", async () => {
    const errors: string[] = [];
    const plugin = await factory({ unknown: true });

    await expect(plugin.init(createRuntime(errors))).resolves.toEqual({
      type: "fatal",
    });
    expect(errors).toEqual(['Invalid plugin config: unknown field "unknown".']);
  });
});

function createRuntime(errors: string[] = []) {
  return {
    warn(_message: string) {},
    error(message: string) {
      errors.push(message);
    },
  };
}

function createCommitContext(): ProjectionContext {
  return {
    fact: createCommitFact(),
    baseRecord: createBaseRecord(),
  } as ProjectionContext;
}

function createFileChangeContext(
  path: string,
  status: "added" | "modified" | "deleted" = "modified",
): ProjectionContext {
  const commit = createCommitFact();
  return {
    fact: {
      type: "file-change",
      commit,
      file: {
        path,
        status,
        additions: 1,
        deletions: 0,
      },
    },
    baseRecord: {
      ...createBaseRecord(),
      file: {
        path,
        status,
        additions: 1,
        deletions: 0,
      },
    },
  } as ProjectionContext;
}

function createCommitFact(): CommitFact {
  return {
    type: "commit" as const,
    oid: "0123456789abcdef0123456789abcdef01234567" as CommitOid,
    message: "feat: add file\n",
    author: {
      name: "Author",
      email: "author@example.com",
      timestamp: 1,
      timezoneOffset: 0,
    },
    committer: {
      name: "Committer",
      email: "committer@example.com",
      timestamp: 1,
      timezoneOffset: 0,
    },
    parents: [],
    repository: {
      name: "repo",
      url: null,
    },
  };
}

function createBaseRecord(): ProjectedCommit {
  return {
    oid: "0123456789abcdef0123456789abcdef01234567" as CommitOid,
    message: "feat: add file",
    author: {
      name: "Author",
      email: "author@example.com",
      timestamp: "1970-01-01T00:00:01.000Z",
    },
    committer: {
      name: "Committer",
      email: "committer@example.com",
      timestamp: "1970-01-01T00:00:01.000Z",
    },
    parents: [],
    repository: {
      name: "repo",
      url: null,
    },
  };
}
