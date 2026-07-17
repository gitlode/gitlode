import { atOrThrow } from "./helpers.js";

/**
 * A queue-like container for pending work items.
 *
 * Implementations define how the next item is selected:
 * FIFO, LIFO, block-aware order, priority order, etc.
 *
 * Queue elements should not be `undefined`.
 * `undefined` is used to represent an empty queue in `peek()` and `dequeue()`.
 */
export interface WorkQueue<T> {
  readonly size: number;

  isEmpty(): boolean;

  /**
   * Adds one block of items.
   *
   * For ordered queues, the argument list is treated as one block.
   */
  enqueue(...items: T[]): void;

  /**
   * Adds one block of items from an iterable.
   *
   * For ordered queues, the iterable is treated as one block.
   */
  enqueueMany(items: Iterable<T>): void;

  peek(): T | undefined;
  peekOrThrow(): T;

  dequeue(): T | undefined;
  dequeueOrThrow(): T;

  clear(): void;
}

/**
 * Comparator used by {@link PriorityQueue}.
 *
 * Semantics match `Array.prototype.sort()`:
 * - result < 0: `a` comes before `b`
 * - result > 0: `b` comes before `a`
 * - result = 0: same priority (stable enqueue order is used)
 */
export type Compare<T> = (a: T, b: T) => number;

type PriorityQueueNode<T> = {
  item: T;
  sequence: number;
};

/**
 * Priority-based work queue backed by a binary heap.
 *
 * Tie-break is stable: if comparator returns `0`, items are dequeued
 * in the same order they were enqueued.
 *
 * Mutation contract:
 * Items must not be mutated in a way that changes comparator results
 * while they remain inside the queue.
 */
export class PriorityQueue<T> implements WorkQueue<T> {
  readonly #compare: Compare<T>;

  #heap: PriorityQueueNode<T>[] = [];
  #nextSequence = 0;

  constructor(compare: Compare<T>) {
    this.#compare = compare;
  }

  get size(): number {
    return this.#heap.length;
  }

  isEmpty(): boolean {
    return this.#heap.length === 0;
  }

  enqueue(...items: T[]): void {
    for (const item of items) {
      const node: PriorityQueueNode<T> = {
        item,
        sequence: this.#nextSequence,
      };

      this.#nextSequence += 1;
      this.#heap.push(node);
      this.#siftUp(this.#heap.length - 1);
    }
  }

  enqueueMany(items: Iterable<T>): void {
    for (const item of items) {
      this.enqueue(item);
    }
  }

  peek(): T | undefined {
    return this.#heap[0]?.item;
  }

  peekOrThrow(): T {
    const item = this.peek();

    if (item === undefined) {
      throw new Error("Cannot peek from an empty queue.");
    }

    return item;
  }

  dequeue(): T | undefined {
    if (this.#heap.length === 0) {
      return undefined;
    }

    const root = atOrThrow(this.#heap, 0);
    const tail = this.#heap.pop();

    if (tail !== undefined && this.#heap.length > 0) {
      this.#heap[0] = tail;
      this.#siftDown(0);
    }

    return root.item;
  }

  dequeueOrThrow(): T {
    const item = this.dequeue();

    if (item === undefined) {
      throw new Error("Cannot dequeue from an empty queue.");
    }

    return item;
  }

  clear(): void {
    this.#heap = [];
    this.#nextSequence = 0;
  }

  #compareNodes(a: PriorityQueueNode<T>, b: PriorityQueueNode<T>): number {
    const result = this.#compare(a.item, b.item);

    if (result !== 0) {
      return result;
    }

    return a.sequence - b.sequence;
  }

  #siftUp(startIndex: number): void {
    let index = startIndex;

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const currentNode = atOrThrow(this.#heap, index);
      const parentNode = atOrThrow(this.#heap, parentIndex);

      if (this.#compareNodes(currentNode, parentNode) >= 0) {
        break;
      }

      this.#heap[index] = parentNode;
      this.#heap[parentIndex] = currentNode;
      index = parentIndex;
    }
  }

  #siftDown(startIndex: number): void {
    let index = startIndex;

    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      const smallestNode = atOrThrow(this.#heap, smallest);

      if (
        left < this.#heap.length &&
        this.#compareNodes(atOrThrow(this.#heap, left), smallestNode) < 0
      ) {
        smallest = left;
      }

      const nextSmallestNode = atOrThrow(this.#heap, smallest);

      if (
        right < this.#heap.length &&
        this.#compareNodes(atOrThrow(this.#heap, right), nextSmallestNode) < 0
      ) {
        smallest = right;
      }

      if (smallest === index) {
        break;
      }

      const currentNode = atOrThrow(this.#heap, index);
      const smallestNodeAfterCheck = atOrThrow(this.#heap, smallest);
      this.#heap[index] = smallestNodeAfterCheck;
      this.#heap[smallest] = currentNode;
      index = smallest;
    }
  }
}

export type DequeueOrder = "fifo" | "lifo";

export type BlockOrder = "preserve" | "reverse";

export type OrderedQueueOptions = {
  dequeueOrder: DequeueOrder;
  blockOrder: BlockOrder;
};

/**
 * Order-based work queue with FIFO/LIFO dequeue strategies and block-aware enqueue behavior.
 *
 * `enqueue(...items)` and `enqueueMany(items)` each add exactly one block.
 * `blockOrder` is applied to every block at enqueue-time.
 */
export class OrderedQueue<T> implements WorkQueue<T> {
  readonly #dequeueOrder: DequeueOrder;
  readonly #blockOrder: BlockOrder;

  // FIFO storage
  #fifoItems: T[] = [];
  #fifoHeadIndex = 0;

  // LIFO storage
  #lifoItems: T[] = [];

  #size = 0;

  constructor(options: OrderedQueueOptions) {
    if (options.dequeueOrder !== "fifo" && options.dequeueOrder !== "lifo") {
      throw new TypeError(`Invalid dequeueOrder: ${String(options.dequeueOrder)}`);
    }

    if (options.blockOrder !== "preserve" && options.blockOrder !== "reverse") {
      throw new TypeError(`Invalid blockOrder: ${String(options.blockOrder)}`);
    }

    this.#dequeueOrder = options.dequeueOrder;
    this.#blockOrder = options.blockOrder;
  }

  get size(): number {
    return this.#size;
  }

  isEmpty(): boolean {
    return this.#size === 0;
  }

  enqueue(...items: T[]): void {
    this.#enqueueBlock(items);
  }

  enqueueMany(items: Iterable<T>): void {
    this.#enqueueBlock(Array.from(items));
  }

  peek(): T | undefined {
    if (this.#size === 0) {
      return undefined;
    }

    if (this.#dequeueOrder === "fifo") {
      return this.#fifoItems[this.#fifoHeadIndex];
    }

    return this.#lifoItems[this.#lifoItems.length - 1];
  }

  peekOrThrow(): T {
    const item = this.peek();

    if (item === undefined) {
      throw new Error("Cannot peek from an empty queue.");
    }

    return item;
  }

  dequeue(): T | undefined {
    if (this.#size === 0) {
      return undefined;
    }

    this.#size -= 1;

    if (this.#dequeueOrder === "fifo") {
      const item = this.#fifoItems[this.#fifoHeadIndex];
      this.#fifoHeadIndex += 1;

      if (this.#fifoHeadIndex > 1024 && this.#fifoHeadIndex * 2 >= this.#fifoItems.length) {
        this.#fifoItems = this.#fifoItems.slice(this.#fifoHeadIndex);
        this.#fifoHeadIndex = 0;
      }

      return item;
    }

    return this.#lifoItems.pop();
  }

  dequeueOrThrow(): T {
    const item = this.dequeue();

    if (item === undefined) {
      throw new Error("Cannot dequeue from an empty queue.");
    }

    return item;
  }

  clear(): void {
    this.#fifoItems = [];
    this.#fifoHeadIndex = 0;
    this.#lifoItems = [];
    this.#size = 0;
  }

  #enqueueBlock(items: T[]): void {
    if (items.length === 0) {
      return;
    }

    this.#size += items.length;

    if (this.#dequeueOrder === "fifo") {
      this.#appendFifoBlock(items);
      return;
    }

    this.#appendLifoBlock(items);
  }

  #appendFifoBlock(items: T[]): void {
    if (this.#blockOrder === "preserve") {
      this.#fifoItems.push(...items);
      return;
    }

    for (let index = items.length - 1; index >= 0; index -= 1) {
      this.#fifoItems.push(atOrThrow(items, index));
    }
  }

  #appendLifoBlock(items: T[]): void {
    if (this.#blockOrder === "preserve") {
      for (let index = items.length - 1; index >= 0; index -= 1) {
        this.#lifoItems.push(atOrThrow(items, index));
      }

      return;
    }

    this.#lifoItems.push(...items);
  }
}
