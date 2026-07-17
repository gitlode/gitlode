/*
 * KeyedSet is a set-like collection for values that carry their own stable key.
 *
 * It is intended for domain objects such as `{ id: number, name: string }`, where
 * the value itself contains the information that identifies it. Callers can add,
 * delete, and iterate values as they would with a Set, while still getting Map-like
 * lookup by the extracted key when they need it.
 *
 * This collection exists to avoid the double bookkeeping required by Map<K, V>.
 * With a Map, callers must repeatedly keep the map key and the value's embedded
 * identity in sync, for example `users.set(user.id, user)`. KeyedSet centralizes
 * that relationship by deriving the key from the value through `getKey`.
 *
 * Identity is therefore based on the extracted key, not object reference equality.
 * Adding another value with the same key replaces the previous value. Likewise,
 * value-based operations such as `has(value)` and `delete(value)` are expected to
 * operate on the extracted key.
 *
 * The extracted key should remain stable while a value is stored in the collection.
 * Mutating the fields used by `getKey` can make the stored Map entry inconsistent
 * with the value's current key.
 */

/**
 * A read-only view of a set-like collection whose values are identified by an
 * extracted key.
 *
 * Values are iterated directly, while key-based methods provide Map-like lookup
 * when the caller already has the key.
 */
export interface ReadonlyKeyedSet<K extends PropertyKey, V> extends Iterable<V> {
  readonly size: number;

  /** Returns whether a value with the same extracted key exists. */
  has(value: V): boolean;

  entries(): IterableIterator<[K, V]>;

  keys(): IterableIterator<K>;

  values(): IterableIterator<V>;

  hasKey(key: K): boolean;

  getByKey(key: K): V | undefined;

  [Symbol.iterator](): IterableIterator<V>;

  readonly [Symbol.toStringTag]: "KeyedSet";
}

/**
 * A set-like collection for values that can be identified by an extracted key.
 *
 * Values are added and iterated directly, while key-based methods provide Map-like
 * lookup and deletion when the caller already has the key.
 */
export interface KeyedSet<K extends PropertyKey, V> extends ReadonlyKeyedSet<K, V> {
  /** Adds a value, replacing any existing value with the same extracted key. */
  add(value: V): this;

  /** Deletes the value with the same extracted key as the given value. */
  delete(value: V): boolean;

  clear(): void;

  deleteByKey(key: K): boolean;
}

class KeyedSetImpl<K extends PropertyKey, V> implements KeyedSet<K, V> {
  protected readonly innerMap = new Map<K, V>();

  protected readonly getKey: (value: V) => K;

  constructor(getKey: (value: V) => K) {
    this.getKey = getKey;
  }

  public get size(): number {
    return this.innerMap.size;
  }

  public add(value: V): this {
    this.innerMap.set(this.getKey(value), value);
    return this;
  }

  public delete(value: V): boolean {
    return this.innerMap.delete(this.getKey(value));
  }

  public clear(): void {
    this.innerMap.clear();
  }

  public has(value: V): boolean {
    return this.innerMap.has(this.getKey(value));
  }

  public entries(): IterableIterator<[K, V]> {
    return this.innerMap.entries();
  }

  public keys(): IterableIterator<K> {
    return this.innerMap.keys();
  }

  public values(): IterableIterator<V> {
    return this.innerMap.values();
  }

  public [Symbol.iterator](): IterableIterator<V> {
    return this.values();
  }

  public get [Symbol.toStringTag](): "KeyedSet" {
    return "KeyedSet";
  }

  public hasKey(key: K): boolean {
    return this.innerMap.has(key);
  }

  public getByKey(key: K): V | undefined {
    return this.innerMap.get(key);
  }

  public deleteByKey(key: K): boolean {
    return this.innerMap.delete(key);
  }
}

export const KeyedSet: new <K extends PropertyKey, V>(getKey: (value: V) => K) => KeyedSet<K, V> =
  KeyedSetImpl;
