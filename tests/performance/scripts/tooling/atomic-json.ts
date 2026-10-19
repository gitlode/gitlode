import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface AtomicJsonOperations {
  mkdir(directory: string, options: { recursive: true }): Promise<unknown>;
  writeFile(path: string, contents: string): Promise<unknown>;
  rename(source: string, destination: string): Promise<unknown>;
  rm(path: string, options: { force: true }): Promise<unknown>;
}

const operations: AtomicJsonOperations = { mkdir, writeFile, rename, rm };

/** Writes a complete JSON document to a sibling, then replaces the destination. */
export async function writeAtomicJson(
  directory: string,
  name: string,
  value: unknown,
  injected: AtomicJsonOperations = operations,
) {
  await writeAtomicText(directory, name, `${JSON.stringify(value, undefined, 2)}\n`, injected);
}

/** Atomic sibling replacement shared by JSON artifacts and canonical manifest text. */
export async function writeAtomicText(
  directory: string,
  name: string,
  contents: string,
  injected: AtomicJsonOperations = operations,
) {
  await injected.mkdir(directory, { recursive: true });
  const destination = join(directory, name);
  const temporary = join(directory, `.${name}.${process.pid}.${Date.now()}.tmp`);
  try {
    await injected.writeFile(temporary, contents);
    await injected.rename(temporary, destination);
  } catch (error) {
    await injected.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}
