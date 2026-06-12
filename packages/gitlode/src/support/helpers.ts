export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}

export function atOrThrow<T>(
  items: readonly T[],
  index: number,
  message = `Expected array item at index ${index}.`,
): T {
  const item = items[index];

  if (item === undefined) {
    throw new Error(message);
  }

  return item;
}

export function firstOrThrow<T>(items: readonly T[], message = "Expected a non-empty array."): T {
  return atOrThrow(items, 0, message);
}

export function shiftOrThrow<T>(items: T[], message = "Expected a non-empty array."): T {
  const item = items.shift();

  if (item === undefined) {
    throw new Error(message);
  }

  return item;
}

export function cyclicAtOrThrow<T>(
  items: readonly T[],
  index: number,
  message = "Expected a non-empty array.",
): T {
  if (items.length === 0) {
    throw new Error(message);
  }

  const adjustedIndex = ((index % items.length) + items.length) % items.length;
  const item = items[adjustedIndex];

  if (item === undefined) {
    throw new Error(message);
  }

  return item;
}

export function getOrThrow<K, V>(
  map: ReadonlyMap<K, V>,
  key: K,
  message = `Expected map to contain key: ${String(key)}.`,
): V {
  const value = map.get(key);

  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

export function captureGroupOrThrow(
  match: RegExpExecArray,
  index: number,
  message = `Expected regex match to contain group at index ${index}.`,
): string {
  const group = match[index];

  if (group === undefined) {
    throw new Error(message);
  }

  return group;
}
