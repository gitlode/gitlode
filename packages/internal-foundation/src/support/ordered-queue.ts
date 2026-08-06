import { atOrThrow } from "./helpers.js";
import type { WorkQueue } from "./work-queue.js";

type DequeueOrder = "fifo" | "lifo";
type BlockOrder = "preserve" | "reverse";

export interface OrderedQueueOptions {
  readonly dequeueOrder: DequeueOrder;
  readonly blockOrder: BlockOrder;
}

/** Order-based queue with block-aware FIFO and LIFO strategies. */
export class OrderedQueue<T> implements WorkQueue<T> {
  readonly #dequeueOrder: DequeueOrder;
  readonly #blockOrder: BlockOrder;
  #fifoItems: T[] = [];
  #fifoHeadIndex = 0;
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
    if (this.#size === 0) return undefined;
    return this.#dequeueOrder === "fifo"
      ? this.#fifoItems[this.#fifoHeadIndex]
      : this.#lifoItems[this.#lifoItems.length - 1];
  }

  peekOrThrow(): T {
    const item = this.peek();
    if (item === undefined) throw new Error("Cannot peek from an empty queue.");
    return item;
  }

  dequeue(): T | undefined {
    if (this.#size === 0) return undefined;
    this.#size -= 1;
    if (this.#dequeueOrder === "fifo") {
      const item = this.#fifoItems[this.#fifoHeadIndex++];
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
    if (item === undefined) throw new Error("Cannot dequeue from an empty queue.");
    return item;
  }

  clear(): void {
    this.#fifoItems = [];
    this.#fifoHeadIndex = 0;
    this.#lifoItems = [];
    this.#size = 0;
  }

  #enqueueBlock(items: T[]): void {
    if (items.length === 0) return;
    this.#size += items.length;
    if (this.#dequeueOrder === "fifo") this.#appendFifoBlock(items);
    else this.#appendLifoBlock(items);
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
