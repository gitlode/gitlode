import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { cp, lstat, mkdir, readFile, readdir, statfs } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { writeAtomicJson } from "../../scripts/tooling/atomic-json.js";
import { fixtureGitEnvironment, foregroundMaintenanceConfig } from "./fixture-git.js";

export const FIXTURE_LIFECYCLE_PROTOCOL = "foreground-maintenance-inventory-v1";
const execute = promisify(execFile);
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export type FixtureInventoryEntry = {
  readonly path: string;
  readonly type: "file" | "directory";
  readonly bytes: number;
  readonly sha256?: string;
};
export type FixtureIdentity = {
  readonly filesystem: { readonly type: number; readonly device: number };
  readonly inventory: readonly FixtureInventoryEntry[];
  readonly layoutDigest: string;
  readonly logical: Readonly<Record<string, string>>;
};
export type FixtureBoundary = {
  readonly id: string;
  readonly label: string;
  readonly layoutDigest: string;
  readonly identity: FixtureIdentity;
};
export type FixtureLink = {
  readonly protocol: typeof FIXTURE_LIFECYCLE_PROTOCOL;
  readonly instanceId: string;
  readonly preparedDigest: string;
  readonly pre: string;
  readonly post: string;
};

export async function fixtureGit(directory: string, args: readonly string[]): Promise<string> {
  return (
    await execute("git", [...foregroundMaintenanceConfig, ...args], {
      cwd: directory,
      env: fixtureGitEnvironment(),
      maxBuffer: 16 * 1024 * 1024,
    })
  ).stdout.trim();
}

/** No status/index refresh. Byte inventories deliberately warm caches outside child timing. */
export async function fixtureIdentity(directory: string): Promise<FixtureIdentity> {
  for (let ancestor = resolve(directory); ; ancestor = dirname(ancestor)) {
    if ((await lstat(ancestor)).isSymbolicLink())
      throw new Error("fixture root has a linked ancestor");
    if (dirname(ancestor) === ancestor) break;
  }
  const inventory: FixtureInventoryEntry[] = [];
  async function walk(relative: string): Promise<void> {
    const path = join(directory, relative);
    const stat = await lstat(path);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()))
      throw new Error(`unsafe fixture entry: ${relative}`);
    if (typeof process.getuid === "function" && stat.uid !== process.getuid())
      throw new Error(`unowned fixture entry: ${relative}`);
    if (stat.isFile() && stat.nlink !== 1) throw new Error(`shared fixture file: ${relative}`);
    if (relative.endsWith(".lock") || relative === ".git/gc.pid")
      throw new Error(`fixture writer marker: ${relative}`);
    if (
      relative === ".git/objects/info/alternates" ||
      relative === ".git/objects/info/http-alternates"
    )
      throw new Error("fixture alternates are prohibited");
    if (relative)
      inventory.push({
        path: relative,
        type: stat.isDirectory() ? "directory" : "file",
        bytes: stat.isFile() ? stat.size : 0,
        ...(stat.isFile() ? { sha256: digest(await readFile(path)) } : {}),
      });
    if (stat.isDirectory())
      for (const name of (await readdir(path)).sort())
        await walk(relative ? `${relative}/${name}` : name);
  }
  await walk("");
  if (!(await lstat(join(directory, ".git"))).isDirectory())
    throw new Error("fixture requires a private .git directory");
  const logical: Record<string, string> = {};
  for (const [key, args] of Object.entries({
    refs: ["for-each-ref", "--format=%(refname) %(objectname) %(objecttype) %(*objectname)"],
    head: ["rev-parse", "HEAD"],
    symbolicHead: ["symbolic-ref", "HEAD"],
    tree: ["rev-parse", "HEAD^{tree}"],
    format: ["rev-parse", "--show-object-format"],
    count: ["rev-list", "--all", "--count"],
    configuration: ["config", "--show-origin", "--show-scope", "--list"],
  }))
    logical[key] = await fixtureGit(directory, args);
  for (const key of ["maintenance.autoDetach", "gc.autoDetach"])
    if ((await fixtureGit(directory, ["config", "--local", "--get", key])) !== "false")
      throw new Error(`fixture requires persisted ${key}=false`);
  // Includes can redirect readers into unowned configuration even when inherited overrides are removed.
  if (
    /\b(?:include\.path|includeif\.|extensions\.worktreeconfig|core\.(?:worktree|hooksPath))=/i.test(
      logical.configuration ?? "",
    )
  )
    throw new Error("fixture configuration redirects ownership");
  return {
    inventory,
    layoutDigest: digest(JSON.stringify(inventory)),
    logical,
    filesystem: { type: (await statfs(directory)).type, device: (await lstat(directory)).dev },
  };
}

export class FixtureLifecycle {
  readonly instanceId = randomUUID();
  readonly protocol = FIXTURE_LIFECYCLE_PROTOCOL;
  readonly boundaries: FixtureBoundary[] = [];
  private prepared?: FixtureIdentity;
  private failed = false;
  readonly repository: string;
  readonly evidenceDirectory: string;
  constructor(repository: string, evidenceDirectory: string) {
    this.repository = repository;
    this.evidenceDirectory = evidenceDirectory;
  }

  async prepare(): Promise<void> {
    await mkdir(this.evidenceDirectory, { recursive: false });
    const identity = await fixtureIdentity(this.repository);
    this.prepared = identity;
    const preserved = join(this.evidenceDirectory, "prepared-repository");
    await cp(this.repository, preserved, { recursive: true, dereference: false });
    const copied = await fixtureIdentity(preserved);
    if (
      copied.layoutDigest !== identity.layoutDigest ||
      JSON.stringify(copied.logical) !== JSON.stringify(identity.logical)
    )
      throw new Error("prepared fixture copy mismatch");
    await this.boundary("prepared");
  }

  async boundary(label: string): Promise<FixtureBoundary> {
    if (this.failed) throw new Error("fixture attempt already inconclusive");
    try {
      const identity = await fixtureIdentity(this.repository);
      const boundary = {
        id: `${this.instanceId}-${this.boundaries.length}`,
        label,
        layoutDigest: identity.layoutDigest,
        identity,
      };
      this.boundaries.push(boundary);
      await writeAtomicJson(this.evidenceDirectory, `${boundary.id}.json`, boundary);
      if (
        !this.prepared ||
        identity.layoutDigest !== this.prepared.layoutDigest ||
        JSON.stringify(identity.logical) !== JSON.stringify(this.prepared.logical) ||
        JSON.stringify(identity.filesystem) !== JSON.stringify(this.prepared.filesystem)
      )
        throw new Error(`fixture drift at ${label}`);
      return boundary;
    } catch (error) {
      await this.fail(label, error);
      throw error;
    }
  }

  private async fail(label: string, error: unknown): Promise<void> {
    if (this.failed) return;
    this.failed = true;
    await writeAtomicJson(this.evidenceDirectory, "failure.json", {
      protocol: this.protocol,
      instanceId: this.instanceId,
      status: "inconclusive",
      label,
      error: error instanceof Error ? error.message : String(error),
      retainedRepository: this.repository,
    }).catch(() => undefined);
  }

  async capture<T>(
    label: string,
    child: () => Promise<T>,
  ): Promise<{ value: T; fixtureLink: FixtureLink }> {
    const pre = await this.boundary(`${label}-pre`);
    let value: T;
    try {
      value = await child();
    } catch (error) {
      await this.fail(label, error);
      throw error;
    }
    const post = await this.boundary(`${label}-post`);
    return {
      value,
      fixtureLink: {
        protocol: this.protocol,
        instanceId: this.instanceId,
        preparedDigest: this.prepared!.layoutDigest,
        pre: pre.id,
        post: post.id,
      },
    };
  }

  async finalize(): Promise<void> {
    await this.boundary("final-pre-destruction");
    try {
      await writeAtomicJson(this.evidenceDirectory, "lifecycle.json", this.evidence());
    } catch (error) {
      await this.fail("final-evidence-persistence", error);
      throw error;
    }
  }

  evidence() {
    return {
      protocol: this.protocol,
      instanceId: this.instanceId,
      preparedDigest: this.prepared?.layoutDigest,
      boundaries: this.boundaries,
      status: this.failed ? "inconclusive" : "verified",
    };
  }
}

export function validateFixtureLinks(
  links: readonly (FixtureLink | undefined)[],
  evidence: ReturnType<FixtureLifecycle["evidence"]>,
): string[] {
  const errors: string[] = [];
  if (
    evidence.protocol !== FIXTURE_LIFECYCLE_PROTOCOL ||
    evidence.status !== "verified" ||
    !evidence.preparedDigest ||
    !evidence.boundaries.length
  )
    errors.push("fixture lifecycle evidence is unqualified");
  if (
    evidence.boundaries[0]?.label !== "prepared" ||
    evidence.boundaries.at(-1)?.label !== "final-pre-destruction"
  )
    errors.push("fixture lifecycle final boundary is missing");
  const logical = JSON.stringify(evidence.boundaries[0]?.identity.logical);
  for (const boundary of evidence.boundaries) {
    if (
      boundary.layoutDigest !== evidence.preparedDigest ||
      !boundary.identity.inventory.length ||
      digest(JSON.stringify(boundary.identity.inventory)) !== boundary.layoutDigest ||
      JSON.stringify(boundary.identity.logical) !== logical
    )
      errors.push("fixture boundary inventory is missing or mismatched");
  }
  for (const link of links) {
    if (
      !link ||
      link.protocol !== evidence.protocol ||
      link.instanceId !== evidence.instanceId ||
      link.preparedDigest !== evidence.preparedDigest
    ) {
      errors.push("fixture link is missing or mismatched");
      continue;
    }
    const preIndex = evidence.boundaries.findIndex((entry) => entry.id === link.pre);
    if (
      preIndex < 0 ||
      evidence.boundaries[preIndex + 1]?.id !== link.post ||
      !evidence.boundaries[preIndex]?.label.endsWith("-pre") ||
      !evidence.boundaries[preIndex + 1]?.label.endsWith("-post")
    )
      errors.push("fixture child boundary order is invalid");
    for (const id of [link.pre, link.post]) {
      const boundary = evidence.boundaries.find((entry) => entry.id === id);
      if (
        !boundary ||
        boundary.layoutDigest !== evidence.preparedDigest ||
        !boundary.identity.inventory.length ||
        digest(JSON.stringify(boundary.identity.inventory)) !== boundary.layoutDigest
      )
        errors.push("fixture boundary inventory is missing or mismatched");
    }
  }
  return [...new Set(errors)];
}
