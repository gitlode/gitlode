/**
 * A queue-like container for pending work items.
 *
 * Implementations own how the next item is selected. Queue elements should not
 * be `undefined`; that value represents an empty queue in `peek()` and
 * `dequeue()`.
 */
export interface WorkQueue<T> {
  readonly size: number;

  isEmpty(): boolean;
  enqueue(...items: T[]): void;
  enqueueMany(items: Iterable<T>): void;
  peek(): T | undefined;
  peekOrThrow(): T;
  dequeue(): T | undefined;
  dequeueOrThrow(): T;
  clear(): void;
}
