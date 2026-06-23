import * as git from "isomorphic-git";
import { Volume, createFsFromVolume } from "memfs";
import { expect } from "vitest";

import type { IsomorphicGitAdapterDependencies } from "../../src/git-impl/index.js";
import type { RawCommit } from "../../src/git/index.js";
import type { CommitOid } from "../../src/model/index.js";

const IDENTITY = {
  name: "DAG fixture",
  email: "dag@example.com",
  timezoneOffset: 0,
};

export interface DagNode {
  readonly parents?: readonly string[];
  readonly timestamp?: number;
}

export interface ReadExpectation {
  readonly unread: readonly string[];
  readonly note: string;
}

export interface DagDefinition {
  readonly name: string;
  /** Nodes must be declared after all of their parents. */
  readonly nodes: Readonly<Record<string, DagNode>>;
  readonly head: string;
  readonly exclude?: string;
  readonly expectedRead?: ReadExpectation;
}

export interface BuiltDag {
  readonly definition: DagDefinition;
  readonly fs: IsomorphicGitAdapterDependencies["fs"];
  readonly oids: ReadonlyMap<string, CommitOid>;
  oid(label: string): CommitOid;
  removeObject(label: string): void;
}

export async function buildDag(definition: DagDefinition): Promise<BuiltDag> {
  const volume = new Volume();
  const fs = createFsFromVolume(volume);
  await git.init({ fs, dir: "/", defaultBranch: "main" });
  const tree = await git.writeTree({ fs, dir: "/", tree: [] });
  const oids = new Map<string, CommitOid>();

  for (const [label, node] of Object.entries(definition.nodes)) {
    const parents = (node.parents ?? []).map((parent) => {
      const oid = oids.get(parent);
      if (oid === undefined) {
        throw new Error(`DAG ${definition.name}: parent ${parent} must precede ${label}`);
      }
      return oid;
    });
    const timestamp = node.timestamp ?? oids.size + 1;
    const oid = await git.writeCommit({
      fs,
      dir: "/",
      commit: {
        tree,
        parent: parents,
        message: `${label}\n`,
        author: { ...IDENTITY, timestamp },
        committer: { ...IDENTITY, timestamp },
      },
    });
    oids.set(label, oid as CommitOid);
  }

  function oid(label: string): CommitOid {
    const value = oids.get(label);
    if (value === undefined) throw new Error(`DAG ${definition.name}: unknown node ${label}`);
    return value;
  }

  return {
    definition,
    fs,
    oids,
    oid,
    removeObject(label: string): void {
      const objectOid = oid(label);
      fs.unlinkSync(`/.git/objects/${objectOid.slice(0, 2)}/${objectOid.slice(2)}`);
    },
  };
}

/** Oracle over the declared graph only; it deliberately does not read Git objects. */
export function expectedLabels(definition: DagDefinition): Set<string> {
  const reachable = (start: string | undefined): Set<string> => {
    const result = new Set<string>();
    if (start === undefined) return result;
    const pending = [start];
    while (pending.length > 0) {
      const label = pending.pop()!;
      if (result.has(label)) continue;
      const node = definition.nodes[label];
      if (node === undefined) throw new Error(`DAG ${definition.name}: unknown node ${label}`);
      result.add(label);
      pending.push(...(node.parents ?? []));
    }
    return result;
  };

  const fromHead = reachable(definition.head);
  for (const excluded of reachable(definition.exclude)) fromHead.delete(excluded);
  return fromHead;
}

export function expectedOids(dag: BuiltDag): Set<string> {
  return new Set([...expectedLabels(dag.definition)].map((label) => dag.oid(label)));
}

export function assertOidSet(commits: readonly RawCommit[], expected: ReadonlySet<string>): void {
  const returned = commits.map((commit) => commit.oid);
  expect(new Set(returned), "walkCommits OID set").toEqual(new Set(expected));
  expect(returned, "walkCommits must not return duplicate OIDs").toHaveLength(
    new Set(returned).size,
  );
}
