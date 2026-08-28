type BoundedAcceptance<Value> =
  | { readonly accepted: true; readonly isNew: boolean; readonly value: Value }
  | { readonly accepted: false };

export class FirstAcceptedBoundedMap<Key, Value> {
  readonly #values = new Map<Key, Value>();
  readonly #maximum: number;

  constructor(maximum: number) {
    this.#maximum = maximum;
  }

  accept(key: Key, create: () => Value): BoundedAcceptance<Value> {
    if (this.#values.has(key))
      return { accepted: true, isNew: false, value: this.#values.get(key) as Value };
    if (this.#values.size >= this.#maximum) return { accepted: false };
    const value = create();
    this.#values.set(key, value);
    return { accepted: true, isNew: true, value };
  }

  values(): IterableIterator<Value> {
    return this.#values.values();
  }
}
