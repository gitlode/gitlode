import { describe, expect, expectTypeOf, it } from "vitest";

import { KeyedSet } from "../../src/support/keyed-set.js";
import type { ReadonlyKeyedSet } from "../../src/support/keyed-set.js";

type User = {
  id: number;
  name: string;
};

function createUserSet(): KeyedSet<number, User> {
  return new KeyedSet<number, User>((user) => user.id);
}

describe("KeyedSet", () => {
  it("is assignable to a read-only keyed set view", () => {
    const alice = { id: 1, name: "Alice" };
    const users = createUserSet();
    const readonlyUsers: ReadonlyKeyedSet<number, User> = users;

    users.add(alice);

    expect(readonlyUsers.size).toBe(1);
    expect(readonlyUsers.has(alice)).toBe(true);
    expect(readonlyUsers.hasKey(1)).toBe(true);
    expect(readonlyUsers.getByKey(1)).toBe(alice);
    expect([...readonlyUsers]).toEqual([alice]);
    expect(readonlyUsers[Symbol.toStringTag]).toBe("KeyedSet");
  });

  it("keeps the read-only view separate from mutation methods", () => {
    expectTypeOf<KeyedSet<number, User>>().toMatchTypeOf<ReadonlyKeyedSet<number, User>>();
    expectTypeOf<ReadonlyKeyedSet<number, User>>().not.toMatchTypeOf<KeyedSet<number, User>>();
  });

  it("adds values and exposes Map-like key lookup", () => {
    const user = { id: 1, name: "Alice" };
    const users = createUserSet();

    users.add(user);

    expect(users.size).toBe(1);
    expect(users.hasKey(1)).toBe(true);
    expect(users.getByKey(1)).toBe(user);
  });

  it("exposes a KeyedSet string tag", () => {
    const users = createUserSet();

    expect(users[Symbol.toStringTag]).toBe("KeyedSet");
    expect(Object.prototype.toString.call(users)).toBe("[object KeyedSet]");
  });

  it("replaces an existing value with the same extracted key", () => {
    const first = { id: 1, name: "Alice" };
    const replacement = { id: 1, name: "Alicia" };
    const users = createUserSet();

    users.add(first).add(replacement);

    expect(users.size).toBe(1);
    expect(users.getByKey(1)).toBe(replacement);
    expect([...users.values()]).toEqual([replacement]);
  });

  it("uses the extracted key for value-based membership", () => {
    const stored = { id: 1, name: "Alice" };
    const sameKey = { id: 1, name: "Alicia" };
    const users = createUserSet();

    users.add(stored);

    expect(users.has(sameKey)).toBe(true);
  });

  it("uses the extracted key for value-based deletion", () => {
    const stored = { id: 1, name: "Alice" };
    const sameKey = { id: 1, name: "Alicia" };
    const users = createUserSet();

    users.add(stored);

    expect(users.delete(sameKey)).toBe(true);

    expect(users.size).toBe(0);
    expect(users.hasKey(1)).toBe(false);
  });

  it("deletes values by key", () => {
    const user = { id: 1, name: "Alice" };
    const users = createUserSet();

    users.add(user);

    expect(users.deleteByKey(1)).toBe(true);

    expect(users.size).toBe(0);
    expect(users.has(user)).toBe(false);
  });

  it("iterates values by default", () => {
    const alice = { id: 1, name: "Alice" };
    const bob = { id: 2, name: "Bob" };
    const users = createUserSet();

    users.add(alice).add(bob);

    expect([...users]).toEqual([alice, bob]);
    expect([...users.values()]).toEqual([alice, bob]);
  });

  it("exposes key-value entries", () => {
    const alice = { id: 1, name: "Alice" };
    const bob = { id: 2, name: "Bob" };
    const users = createUserSet();

    users.add(alice).add(bob);

    expect([...users.keys()]).toEqual([1, 2]);
    expect([...users.entries()]).toEqual([
      [1, alice],
      [2, bob],
    ]);
  });
});
