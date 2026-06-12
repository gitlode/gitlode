import { dirname, resolve } from "node:path";

import type { AbsoluteDirectoryPath, AbsolutePath } from "./type.js";

export function resolveFilePath(...paths: string[]): AbsolutePath {
  return resolve(...paths) as AbsolutePath;
}

export function dirnameOfFilePath(filePath: AbsolutePath): AbsoluteDirectoryPath {
  return dirname(filePath) as AbsoluteDirectoryPath;
}
