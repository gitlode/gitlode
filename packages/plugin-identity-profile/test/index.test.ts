import type { ProjectionContext } from "gitlode/plugin-api";
import { describe, expect, it, vi } from "vitest";

import factory from "../src/index.js";

describe("@gitlode/plugin-identity-profile", () => {
  it("returns ready init result and resolves author by email then committer by name", async () => {
    const plugin = await factory({
      attributeFields: ["team", "level"],
      profileMappings: [
        {
          matchEmail: "author@example.com",
          name: "Author Canonical",
          email: "author.canonical@example.com",
          team: "platform",
          level: 3,
        },
        {
          matchName: "Committer Alias",
          name: "Committer Canonical",
          email: "committer.canonical@example.com",
          team: "ops",
        },
      ],
    });
    const runtime = createRuntime();

    await expect(plugin.init(runtime)).resolves.toEqual({ type: "ready" });
    await expect(plugin.project(createProjectionContext())).resolves.toEqual({
      type: "success",
      data: {
        author: {
          name: "Author Canonical",
          email: "author.canonical@example.com",
          attributes: {
            team: "platform",
            level: 3,
          },
        },
        committer: {
          name: "Committer Canonical",
          email: "committer.canonical@example.com",
          attributes: {
            team: "ops",
          },
        },
      },
    });

    expect(runtime.warn).not.toHaveBeenCalled();
    expect(runtime.error).not.toHaveBeenCalled();
  });

  it("passes through unmatched identities and defaults attributeFields to an empty array", async () => {
    const plugin = await factory({
      profileMappings: [
        {
          matchEmail: "author@example.com",
          name: "Author Canonical",
          email: "author.canonical@example.com",
          team: "platform",
        },
      ],
    });
    const runtime = createRuntime();

    await expect(plugin.init(runtime)).resolves.toEqual({ type: "ready" });
    await expect(plugin.project(createProjectionContext())).resolves.toEqual({
      type: "success",
      data: {
        author: {
          name: "Author Canonical",
          email: "author.canonical@example.com",
        },
        committer: {
          name: "Committer Alias",
          email: "committer@example.com",
        },
      },
    });
  });

  it("emits debug metadata and preserves explicit empty string and null attribute values", async () => {
    const plugin = await factory({
      debug: true,
      attributeFields: ["team", "note"],
      profileMappings: [
        {
          matchEmail: "author@example.com",
          name: "Author Canonical",
          email: "author.canonical@example.com",
          team: null,
          note: "",
        },
      ],
    });
    const runtime = createRuntime();

    await expect(plugin.init(runtime)).resolves.toEqual({ type: "ready" });
    await expect(plugin.project(createProjectionContext())).resolves.toEqual({
      type: "success",
      data: {
        author: {
          name: "Author Canonical",
          email: "author.canonical@example.com",
          attributes: {
            team: null,
            note: "",
          },
          _debug: {
            source: "master",
            matchedBy: "email",
          },
        },
        committer: {
          name: "Committer Alias",
          email: "committer@example.com",
          _debug: {
            source: "input",
          },
        },
      },
    });
  });

  it("warns once for ignored fields and once per overlapping key while honoring first-match wins", async () => {
    const plugin = await factory({
      attributeFields: ["team"],
      profileMappings: [
        {
          matchEmail: "author@example.com",
          name: "First Match",
          email: "first@example.com",
          team: "platform",
          note: "ignored",
        },
        {
          matchEmail: "author@example.com",
          name: "Second Match",
          email: "second@example.com",
          team: "ops",
          note: "ignored again",
        },
      ],
    });
    const error = vi.fn();
    const warn = vi.fn();

    await expect(plugin.init({ error, warn })).resolves.toEqual({
      type: "ready",
    });

    await expect(plugin.project(createProjectionContext())).resolves.toEqual({
      type: "success",
      data: {
        author: {
          name: "First Match",
          email: "first@example.com",
          attributes: {
            team: "platform",
          },
        },
        committer: {
          name: "Committer Alias",
          email: "committer@example.com",
        },
      },
    });

    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenNthCalledWith(
      1,
      'Profile mapping field "note" is not reserved and not listed in attributeFields; it will be ignored.',
    );
    expect(warn).toHaveBeenNthCalledWith(
      2,
      'matchEmail "author@example.com" appears in multiple profileMappings; first matching row wins and later rows may be shadowed.',
    );
  });

  it("returns a fatal init result and emits detailed errors for invalid config", async () => {
    const plugin = await factory({
      attributeFields: ["email", "team"],
      profileMappings: [
        {
          matchEmail: "",
          matchName: null,
          name: "",
          email: 123,
          team: ["invalid"],
        },
      ],
    });
    const runtime = createRuntime();

    await expect(plugin.init(runtime)).resolves.toEqual({ type: "fatal" });

    expect(runtime.warn).not.toHaveBeenCalled();
    expect(runtime.error).toHaveBeenCalledWith(
      'Invalid plugin config: attributeFields must not contain reserved field name "email".',
    );
    expect(runtime.error).toHaveBeenCalledWith(
      "Invalid plugin config: profileMappings[0].name must be a non-empty string.",
    );
    expect(runtime.error).toHaveBeenCalledWith(
      "Invalid plugin config: profileMappings[0].email must be a non-empty string.",
    );
    expect(runtime.error).toHaveBeenCalledWith(
      "Invalid plugin config: profileMappings[0].team must be a scalar JSON value or null.",
    );
    expect(runtime.error).toHaveBeenCalledWith(
      'Invalid plugin config: profileMappings[0] must define at least one of "matchEmail" or "matchName".',
    );
  });

  it("returns a fatal projection result when used before init", async () => {
    const plugin = await factory({
      profileMappings: [
        {
          matchEmail: "author@example.com",
          name: "Author Canonical",
          email: "author.canonical@example.com",
        },
      ],
    });

    await expect(plugin.project(createProjectionContext())).resolves.toEqual({ type: "fatal" });
  });
});

function createRuntime() {
  return {
    error: vi.fn(),
    warn: vi.fn(),
  };
}

function createProjectionContext(): ProjectionContext {
  return {
    baseRecord: {
      oid: "abc123",
      message: "subject\n\nbody",
      author: {
        name: "Author Alias",
        email: "author@example.com",
        timestamp: "2026-06-05T00:00:00+00:00",
      },
      committer: {
        name: "Committer Alias",
        email: "committer@example.com",
        timestamp: "2026-06-05T00:00:00+00:00",
      },
      parents: [],
      repository: {
        name: "repo",
        url: null,
      },
    },
    fact: {
      type: "commit",
      oid: "abc123",
      message: "feat: test",
    },
  } as never;
}
