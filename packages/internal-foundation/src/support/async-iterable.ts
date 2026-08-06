export async function collectAsyncIterableToSet<T>(values: AsyncIterable<T>): Promise<Set<T>> {
  const collected = new Set<T>();
  for await (const value of values) collected.add(value);
  return collected;
}
