import { readdirSync, readFileSync } from "node:fs";

export interface ProcessIdentity {
  readonly pid: number;
  readonly group: number;
  readonly start: string;
  readonly state: string;
}

export function processIdentity(pid: number): ProcessIdentity {
  const raw = readFileSync(`/proc/${pid}/stat`, "utf8");
  if (Number(raw.slice(0, raw.indexOf(" "))) !== pid) throw new Error("process PID mismatch");
  const fields = raw
    .slice(raw.lastIndexOf(")") + 2)
    .trim()
    .split(/\s+/);
  const group = Number(fields[2]);
  const start = fields[19];
  const state = fields[0];
  if (!Number.isSafeInteger(group) || !start || !/^\d+$/.test(start) || !state)
    throw new Error("invalid process identity");
  return { pid, group, start, state };
}

/** The deadline starts before signaling and is never renewed by close or observation. */
export async function completeProcessGroup(input: {
  readonly budgetMs: number;
  readonly force: (deadline: number) => void;
  readonly observe: (deadline: number) => boolean;
  readonly closed: () => boolean;
  readonly errors: string[];
}): Promise<boolean> {
  const started = performance.now();
  const deadline = started + input.budgetMs;
  try {
    input.force(deadline);
  } catch {
    input.errors.push("group-SIGKILL-failed");
  }
  while (performance.now() - started < input.budgetMs) {
    try {
      const quiet = input.observe(deadline);
      if (performance.now() - started >= input.budgetMs) break;
      if (quiet && input.closed()) return input.errors.length === 0;
    } catch {
      if (!input.errors.includes("group-observation-or-identity-failed"))
        input.errors.push("group-observation-or-identity-failed");
    }
    await new Promise<void>((resolve) => {
      setTimeout(
        resolve,
        Math.min(10, Math.max(0, input.budgetMs - (performance.now() - started))),
      );
    });
  }
  if (!input.closed()) input.errors.push("worker-close-not-observed");
  input.errors.push("group-quiescence-not-confirmed");
  return false;
}

/** ENOENT is disappearance; other failures cannot establish group quiescence. */
export function observeProcessGroup(group: number, deadline = Infinity): ProcessIdentity[] {
  const members: ProcessIdentity[] = [];
  for (const name of readdirSync("/proc")) {
    if (performance.now() >= deadline) throw new Error("group-observation-deadline-exceeded");
    if (!/^\d+$/.test(name)) continue;
    try {
      const member = processIdentity(Number(name));
      if (member.group === group) members.push(member);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return members;
}

/** Retain identities across observations, including zombies, to detect reuse. */
export class GroupCompletion {
  private readonly starts = new Map<number, string>();
  private readonly leader: ProcessIdentity;

  constructor(leader: ProcessIdentity) {
    if (leader.pid !== leader.group) throw new Error("worker-group-identity-mismatch");
    this.leader = leader;
    this.starts.set(leader.pid, leader.start);
  }

  observe(members: readonly ProcessIdentity[]): boolean {
    for (const member of members) {
      if (
        member.group !== this.leader.group ||
        (this.starts.has(member.pid) && this.starts.get(member.pid) !== member.start)
      )
        throw new Error("process-identity-mismatch");
      this.starts.set(member.pid, member.start);
    }
    return members.every((member) => member.state === "Z");
  }
}
