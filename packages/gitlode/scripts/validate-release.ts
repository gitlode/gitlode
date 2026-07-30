import { access, readFile, readdir } from "node:fs/promises";

const required = [
  "index.js",
  "plugin-api.js",
  "worker-entry.js",
  "index.js.map",
  "plugin-api.js.map",
  "worker-entry.js.map",
  "index.d.ts",
  "plugin-api.d.ts",
];
const files = await readdir(new URL("../dist/", import.meta.url));
for (const file of required) await access(new URL(`../dist/${file}`, import.meta.url));
for (const forbidden of ["worker-entry.d.ts", "index.d.ts.map", "plugin-api.d.ts.map"])
  if (files.includes(forbidden)) throw new Error(`Unexpected release output: ${forbidden}`);
const text = await Promise.all(
  files
    .filter((f) => /\.(?:js|d\.ts)$/.test(f))
    .map((f) => readFile(new URL(`../dist/${f}`, import.meta.url), "utf8")),
);
if (text.some((value) => /@gitlode\/(?:internal-|git-adapters|line-diff-adapters)/.test(value)))
  throw new Error("Private package specifier leaked into the release");
if (
  !(await readFile(new URL("../dist/index.js", import.meta.url), "utf8")).startsWith(
    "#!/usr/bin/env node",
  )
)
  throw new Error("CLI shebang is missing");
console.log(`Validated ${files.length} release files`);
