import { rm } from "node:fs/promises";

await rm(new URL("../../../.cache/tsc/gitlode.tsbuildinfo", import.meta.url), { force: true });
