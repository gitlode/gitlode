import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const cachePath = resolve(import.meta.dirname, "../../../.cache/tsc/gitlode.tsbuildinfo");

await rm(cachePath, { force: true });
