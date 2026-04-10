#!/usr/bin/env node
import { defineCommand, runMain } from "citty";

export { Extractor } from "./core/index.js";

const main = defineCommand({
  meta: {
    name: "gitrail",
    description: "Extract Git commit history to JSON Lines",
  },
  run() {
    // TODO: delegate to CLI layer
  },
});

runMain(main);
