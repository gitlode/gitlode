#!/usr/bin/env node
import { defineCommand, runMain } from "citty";

import { cmdDefinition, parseArgs } from "./cli/index.js";
import { Extractor } from "./core/index.js";
import { IsomorphicGitAdapter } from "./git/index.js";
import { GitAdapterError } from "./git/index.js";

const main = defineCommand({
  ...cmdDefinition,
  async run() {
    const adapter = new IsomorphicGitAdapter();
    let config;
    try {
      config = await parseArgs(adapter);
    } catch (e) {
      // parseArgs calls process.exit for user errors; if it throws, it's a runtime error
      if (e instanceof GitAdapterError) {
        process.stderr.write(e.message + "\n");
        process.exit(1);
      }
      process.stderr.write((e instanceof Error ? (e.stack ?? e.message) : String(e)) + "\n");
      process.exit(2);
    }
    try {
      const extractor = new Extractor(config, adapter);
      await extractor.run();
    } catch (e) {
      if (e instanceof GitAdapterError) {
        process.stderr.write(e.message + "\n");
        process.exit(1);
      }
      process.stderr.write((e instanceof Error ? (e.stack ?? e.message) : String(e)) + "\n");
      process.exit(2);
    }
  },
});

runMain(main);
