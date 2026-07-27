import { atOrThrow } from "./helpers.js";
import type { WorkQueue } from "./work-queue.js";

/** Comparator with the same ordering semantics as `Array.prototype.sort()`. */
export type Compare<T> = (a: T, b: T) => number;

interface PriorityQueueNode<T> {
  readonly item: T;
  readonly sequence: number;
}

/** Stable priority queue backed by a binary heap. */
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
      this.#heap.push({ item, sequence: this.#nextSequence++ });
      this.#siftUp(this.#heap.length - 1);
    }
  }

  enqueueMany(items: Iterable<T>): void {
    for (const item of items) this.enqueue(item);
  }

  peek(): T | undefined {
    return this.#heap[0]?.item;
  }

  peekOrThrow(): T {
    const item = this.peek();
    if (item === undefined) throw new Error("Cannot peek from an empty queue.");
    return item;
  }

  dequeue(): T | undefined {
    if (this.#heap.length === 0) return undefined;

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
    if (item === undefined) throw new Error("Cannot dequeue from an empty queue.");
    return item;
  }

  clear(): void {
    this.#heap = [];
    this.#nextSequence = 0;
  }

  #compareNodes(a: PriorityQueueNode<T>, b: PriorityQueueNode<T>): number {
    const result = this.#compare(a.item, b.item);
    return result === 0 ? a.sequence - b.sequence : result;
  }

  #siftUp(startIndex: number): void {
    let index = startIndex;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const currentNode = atOrThrow(this.#heap, index);
      const parentNode = atOrThrow(this.#heap, parentIndex);
      if (this.#compareNodes(currentNode, parentNode) >= 0) break;
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
      if (smallest === index) break;

      const currentNode = atOrThrow(this.#heap, index);
      this.#heap[index] = atOrThrow(this.#heap, smallest);
      this.#heap[smallest] = currentNode;
      index = smallest;
    }
  }
}
