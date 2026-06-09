import type { PreparedConfig } from "./config.js";

export type RuleSetName = "common";
export type MappingSource = "plugin-config" | RuleSetName;

declare const basenameSignatureBrand: unique symbol;
declare const suffixSignatureBrand: unique symbol;

export type BasenameSignature = string & {
  readonly [basenameSignatureBrand]: "BasenameSignature";
};
export type SuffixSignature = string & { readonly [suffixSignatureBrand]: "SuffixSignature" };

export interface BasenameMappingEntry {
  readonly signature: BasenameSignature;
  readonly name: string;
  readonly source: MappingSource;
}

export interface SuffixMappingEntry {
  readonly signature: SuffixSignature;
  readonly suffixLower: string;
  readonly name: string;
  readonly source: MappingSource;
}

export interface PreparedMappings {
  readonly basenames: ReadonlyMap<BasenameSignature, BasenameMappingEntry>;
  readonly suffixes: ReadonlyMap<SuffixSignature, SuffixMappingEntry>;
}

export interface MappingDefinition {
  readonly signature: string;
  readonly name: string;
  readonly source: MappingSource;
}

export type MappingParseResult =
  | { readonly ok: true; readonly value: PreparedMappings }
  | { readonly ok: false; readonly message: string };

type SignatureParseResult =
  | { readonly ok: true; readonly type: "basename"; readonly value: BasenameSignature }
  | { readonly ok: true; readonly type: "suffix"; readonly value: SuffixSignature }
  | { readonly ok: false; readonly message: string };

export interface Classification {
  readonly name: string;
  readonly source: MappingSource | "unknown";
  readonly matched: string | null;
}

export function prepareMappings(definitions: Iterable<MappingDefinition>): MappingParseResult {
  const basenames = new Map<BasenameSignature, BasenameMappingEntry>();
  const suffixes = new Map<SuffixSignature, SuffixMappingEntry>();
  const seenSignatures = new Set<string>();

  for (const definition of definitions) {
    if (seenSignatures.has(definition.signature)) {
      return {
        ok: false,
        message: `Invalid plugin config: duplicate mapping key "${definition.signature}".`,
      };
    }
    seenSignatures.add(definition.signature);

    const parsedSignature = parseMappingSignature(definition.signature);
    if (!parsedSignature.ok) {
      return parsedSignature;
    }

    if (parsedSignature.type === "basename") {
      basenames.set(parsedSignature.value, {
        signature: parsedSignature.value,
        name: definition.name,
        source: definition.source,
      });
      continue;
    }

    suffixes.set(parsedSignature.value, {
      signature: parsedSignature.value,
      suffixLower: parsedSignature.value.slice(1).toLowerCase(),
      name: definition.name,
      source: definition.source,
    });
  }

  return { ok: true, value: { basenames, suffixes } };
}

export function classifyPath(filePath: string, config: PreparedConfig): Classification {
  const normalizedPath = filePath.replaceAll("\\", "/");
  const basename = basenameOf(normalizedPath);
  const normalizedPathLower = normalizedPath.toLowerCase();

  const userBasename = findBasenameMatch(config.mappings, basename);
  if (userBasename) {
    return mappingEntryToClassification(userBasename);
  }

  const userSuffix = findSuffixMatch(config.mappings, normalizedPathLower);
  if (userSuffix) {
    return mappingEntryToClassification(userSuffix);
  }

  for (const ruleSet of config.ruleSets) {
    const builtInBasename = findBasenameMatch(ruleSet.mappings, basename);
    if (builtInBasename) {
      return mappingEntryToClassification(builtInBasename);
    }

    const builtInSuffix = findSuffixMatch(ruleSet.mappings, normalizedPathLower);
    if (builtInSuffix) {
      return mappingEntryToClassification(builtInSuffix);
    }
  }

  return { name: "Unknown", source: "unknown", matched: null };
}

function parseMappingSignature(signature: string): SignatureParseResult {
  if (signature.length === 0) {
    return { ok: false, message: "Invalid plugin config: mapping key must not be empty." };
  }

  if (signature.startsWith("*.")) {
    if (signature.length === 2) {
      return {
        ok: false,
        message: 'Invalid plugin config: suffix mapping key "*." must include a suffix.',
      };
    }

    if (signature.slice(2).includes("*")) {
      return {
        ok: false,
        message: `Invalid plugin config: mapping key "${signature}" must not contain "*" outside the leading "*." form.`,
      };
    }

    return { ok: true, type: "suffix", value: signature as SuffixSignature };
  }

  if (signature.includes("*")) {
    return {
      ok: false,
      message: `Invalid plugin config: mapping key "${signature}" must not contain "*" outside the leading "*." form.`,
    };
  }

  return { ok: true, type: "basename", value: signature as BasenameSignature };
}

function basenameOf(normalizedPath: string): string {
  const lastSlash = normalizedPath.lastIndexOf("/");
  return lastSlash === -1 ? normalizedPath : normalizedPath.slice(lastSlash + 1);
}

function findBasenameMatch(
  mappings: PreparedMappings,
  basename: string,
): BasenameMappingEntry | undefined {
  return mappings.basenames.get(basename as BasenameSignature);
}

function findSuffixMatch(
  mappings: PreparedMappings,
  normalizedPathLower: string,
): SuffixMappingEntry | undefined {
  let bestMatch: SuffixMappingEntry | undefined;

  for (const entry of mappings.suffixes.values()) {
    if (!normalizedPathLower.endsWith(entry.suffixLower)) {
      continue;
    }

    if (!bestMatch || entry.suffixLower.length > bestMatch.suffixLower.length) {
      bestMatch = entry;
    }
  }

  return bestMatch;
}

function mappingEntryToClassification(
  entry: BasenameMappingEntry | SuffixMappingEntry,
): Classification {
  return { name: entry.name, source: entry.source, matched: entry.signature };
}
