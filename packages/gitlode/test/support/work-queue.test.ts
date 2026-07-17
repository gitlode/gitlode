import { describe, expect, it } from "vitest";

import {
  OrderedQueue,
  type OrderedQueueOptions,
  PriorityQueue,
  type WorkQueue,
} from "../../src/support/work-queue.js";

function dequeueAll<T>(queue: WorkQueue<T>): T[] {
  const result: T[] = [];

  while (!queue.isEmpty()) {
    result.push(queue.dequeueOrThrow());
  }

  return result;
}

function runCommonQueueBehaviorTests(label: string, createQueue: () => WorkQueue<number>): void {
  describe(label, () => {
    it("starts empty", () => {
      const queue = createQueue();

      expect(queue.size).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    it("supports enqueue and enqueueMany", () => {
      const queue = createQueue();

      queue.enqueue(1, 2);
      queue.enqueueMany([3, 4]);

      expect(queue.size).toBe(4);
      expect(queue.isEmpty()).toBe(false);
    });

    it("peek returns the next item without removing it", () => {
      const queue = createQueue();

      queue.enqueue(1, 2, 3);

      expect(queue.peek()).toBe(queue.peekOrThrow());
      expect(queue.size).toBe(3);
    });

    it("dequeue returns and removes the next item", () => {
      const queue = createQueue();

      queue.enqueue(1, 2, 3);
      const first = queue.dequeueOrThrow();

      expect(first).toBeDefined();
      expect(queue.size).toBe(2);
    });

    it("returns undefined for peek/dequeue on empty queue", () => {
      const queue = createQueue();

      expect(queue.peek()).toBeUndefined();
      expect(queue.dequeue()).toBeUndefined();
    });

    it("throws for peekOrThrow/dequeueOrThrow on empty queue", () => {
      const queue = createQueue();

      expect(() => queue.peekOrThrow()).toThrowError("Cannot peek from an empty queue.");
      expect(() => queue.dequeueOrThrow()).toThrowError("Cannot dequeue from an empty queue.");
    });

    it("clear empties queue", () => {
      const queue = createQueue();

      queue.enqueue(1, 2, 3);
      queue.clear();

      expect(queue.size).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.peek()).toBeUndefined();
      expect(queue.dequeue()).toBeUndefined();
    });
  });
}

describe("PriorityQueue", () => {
  runCommonQueueBehaviorTests("common behavior", () => new PriorityQueue<number>((a, b) => a - b));

  it("dequeues in ascending priority order", () => {
    const queue = new PriorityQueue<number>((a, b) => a - b);

    queue.enqueue(3, 1, 2);

    expect(dequeueAll(queue)).toEqual([1, 2, 3]);
  });

  it("dequeues in descending priority order", () => {
    const queue = new PriorityQueue<number>((a, b) => b - a);

    queue.enqueue(3, 1, 2);

    expect(dequeueAll(queue)).toEqual([3, 2, 1]);
  });

  it("uses stable tie-break for equal priorities", () => {
    type Item = { priority: number; name: string };

    const queue = new PriorityQueue<Item>((a, b) => a.priority - b.priority);

    queue.enqueue(
      { priority: 1, name: "a" },
      { priority: 1, name: "b" },
      { priority: 1, name: "c" },
    );

    expect(dequeueAll(queue).map((item) => item.name)).toEqual(["a", "b", "c"]);
  });

  it("keeps stable tie-break across separate enqueue calls", () => {
    type Item = { priority: number; name: string };

    const queue = new PriorityQueue<Item>((a, b) => a.priority - b.priority);

    queue.enqueue({ priority: 1, name: "a" });
    queue.enqueue({ priority: 1, name: "b" });
    queue.enqueueMany([{ priority: 1, name: "c" }]);

    expect(dequeueAll(queue).map((item) => item.name)).toEqual(["a", "b", "c"]);
  });

  it("clear resets stable-order sequence", () => {
    type Item = { priority: number; name: string };

    const queue = new PriorityQueue<Item>((a, b) => a.priority - b.priority);

    queue.enqueue({ priority: 1, name: "before-clear" });
    queue.clear();
    queue.enqueue({ priority: 1, name: "after-clear-1" });
    queue.enqueue({ priority: 1, name: "after-clear-2" });

    expect(dequeueAll(queue).map((item) => item.name)).toEqual(["after-clear-1", "after-clear-2"]);
  });
});

describe("OrderedQueue", () => {
  runCommonQueueBehaviorTests(
    "common behavior (fifo/preserve)",
    () => new OrderedQueue<number>({ dequeueOrder: "fifo", blockOrder: "preserve" }),
  );

  it("fifo x preserve", () => {
    const queue = new OrderedQueue<number>({
      dequeueOrder: "fifo",
      blockOrder: "preserve",
    });

    queue.enqueueMany([1, 2, 3]);
    queue.enqueueMany([4, 5, 6]);

    expect(dequeueAll(queue)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("fifo x reverse applies to every block", () => {
    const queue = new OrderedQueue<number>({
      dequeueOrder: "fifo",
      blockOrder: "reverse",
    });

    queue.enqueueMany([1, 2, 3]);
    queue.enqueueMany([4, 5, 6]);

    expect(dequeueAll(queue)).toEqual([3, 2, 1, 6, 5, 4]);
  });

  it("fifo x reverse with initial single-item blocks", () => {
    const queue = new OrderedQueue<number>({
      dequeueOrder: "fifo",
      blockOrder: "reverse",
    });

    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    queue.enqueueMany([4, 5, 6]);

    expect(dequeueAll(queue)).toEqual([1, 2, 3, 6, 5, 4]);
  });

  it("lifo x preserve", () => {
    const queue = new OrderedQueue<number>({
      dequeueOrder: "lifo",
      blockOrder: "preserve",
    });

    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    queue.enqueueMany([4, 5, 6]);

    expect(dequeueAll(queue)).toEqual([4, 5, 6, 3, 2, 1]);
  });

  it("lifo x reverse", () => {
    const queue = new OrderedQueue<number>({
      dequeueOrder: "lifo",
      blockOrder: "reverse",
    });

    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    queue.enqueueMany([4, 5, 6]);

    expect(dequeueAll(queue)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it("block-to-block semantics are explicit by enqueue call", () => {
    const makeQueue = (options: OrderedQueueOptions): OrderedQueue<number> => {
      const queue = new OrderedQueue<number>(options);
      queue.enqueueMany([1, 2, 3]);
      queue.enqueueMany([4, 5, 6]);
      return queue;
    };

    expect(
      dequeueAll(
        makeQueue({
          dequeueOrder: "fifo",
          blockOrder: "preserve",
        }),
      ),
    ).toEqual([1, 2, 3, 4, 5, 6]);

    expect(
      dequeueAll(
        makeQueue({
          dequeueOrder: "fifo",
          blockOrder: "reverse",
        }),
      ),
    ).toEqual([3, 2, 1, 6, 5, 4]);

    expect(
      dequeueAll(
        makeQueue({
          dequeueOrder: "lifo",
          blockOrder: "preserve",
        }),
      ),
    ).toEqual([4, 5, 6, 1, 2, 3]);

    expect(
      dequeueAll(
        makeQueue({
          dequeueOrder: "lifo",
          blockOrder: "reverse",
        }),
      ),
    ).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it("validates constructor options", () => {
    expect(
      () =>
        new OrderedQueue<number>({
          dequeueOrder: "invalid" as unknown as "fifo",
          blockOrder: "preserve",
        }),
    ).toThrowError("Invalid dequeueOrder: invalid");

    expect(
      () =>
        new OrderedQueue<number>({
          dequeueOrder: "fifo",
          blockOrder: "invalid" as unknown as "preserve",
        }),
    ).toThrowError("Invalid blockOrder: invalid");
  });
});
