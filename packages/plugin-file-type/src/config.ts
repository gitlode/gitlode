import { prepareMappings } from "./classifier.js";
import { BUILT_IN_RULE_SETS } from "./rule-sets.js";
import type {
  MappingDefinition,
  PreparedConfig,
  PreparedMappings,
  PreparedRuleSet,
  RuleSetName,
  UnknownPolicy,
} from "./types.js";

export type ConfigParseResult =
  | { readonly ok: true; readonly value: PreparedConfig }
  | { readonly ok: false; readonly message: string };

const DEFAULT_RULE_SETS: readonly RuleSetName[] = ["common"];
const ALLOWED_CONFIG_KEYS = new Set(["debug", "ruleSets", "mappings", "unknownPolicy"]);

export function parseConfig(rawConfig: unknown): ConfigParseResult {
  if (rawConfig === undefined || rawConfig === null) {
    return buildPreparedConfig({});
  }

  if (!isRecord(rawConfig)) {
    return { ok: false, message: "Invalid plugin config: top-level value must be an object." };
  }

  return buildPreparedConfig(rawConfig);
}

function buildPreparedConfig(rawConfig: Readonly<Record<string, unknown>>): ConfigParseResult {
  for (const key of Object.keys(rawConfig)) {
    if (!ALLOWED_CONFIG_KEYS.has(key)) {
      return { ok: false, message: `Invalid plugin config: unknown field "${key}".` };
    }
  }

  const debugResult = parseDebug(rawConfig["debug"]);
  if (!debugResult.ok) {
    return debugResult;
  }

  const ruleSetsResult = parseRuleSets(rawConfig["ruleSets"]);
  if (!ruleSetsResult.ok) {
    return ruleSetsResult;
  }

  const mappingsResult = parseMappings(rawConfig["mappings"]);
  if (!mappingsResult.ok) {
    return mappingsResult;
  }

  const unknownPolicyResult = parseUnknownPolicy(rawConfig["unknownPolicy"]);
  if (!unknownPolicyResult.ok) {
    return unknownPolicyResult;
  }

  return {
    ok: true,
    value: {
      debug: debugResult.value,
      ruleSets: ruleSetsResult.value,
      mappings: mappingsResult.value,
      unknownPolicy: unknownPolicyResult.value,
    },
  };
}

function parseDebug(
  value: unknown,
):
  | { readonly ok: true; readonly value: boolean }
  | { readonly ok: false; readonly message: string } {
  if (value === undefined) {
    return { ok: true, value: false };
  }

  if (typeof value !== "boolean") {
    return { ok: false, message: 'Invalid plugin config: "debug" must be a boolean.' };
  }

  return { ok: true, value };
}

function parseRuleSets(
  value: unknown,
):
  | { readonly ok: true; readonly value: readonly PreparedRuleSet[] }
  | { readonly ok: false; readonly message: string } {
  if (value === undefined) {
    return { ok: true, value: resolveRuleSets(DEFAULT_RULE_SETS) };
  }

  if (!Array.isArray(value)) {
    return { ok: false, message: 'Invalid plugin config: "ruleSets" must be an array.' };
  }

  const names: RuleSetName[] = [];
  const seen = new Set<RuleSetName>();

  for (const [index, item] of value.entries()) {
    if (item !== "common") {
      return {
        ok: false,
        message: `Invalid plugin config: "ruleSets[${index}]" must be one of: common.`,
      };
    }

    if (seen.has(item)) {
      return {
        ok: false,
        message: `Invalid plugin config: "ruleSets" must not contain duplicate value "${item}".`,
      };
    }

    seen.add(item);
    names.push(item);
  }

  return { ok: true, value: resolveRuleSets(names) };
}

function resolveRuleSets(names: readonly RuleSetName[]): readonly PreparedRuleSet[] {
  return names
    .map((name) => BUILT_IN_RULE_SETS.get(name))
    .filter((ruleSet) => ruleSet !== undefined);
}

function parseMappings(
  value: unknown,
):
  | { readonly ok: true; readonly value: PreparedMappings }
  | { readonly ok: false; readonly message: string } {
  if (value === undefined) {
    return emptyMappings();
  }

  if (!isRecord(value)) {
    return { ok: false, message: 'Invalid plugin config: "mappings" must be an object.' };
  }

  const definitions: MappingDefinition[] = [];
  for (const [signature, name] of Object.entries(value)) {
    if (typeof name !== "string" || name.length === 0) {
      return {
        ok: false,
        message: `Invalid plugin config: mapping value for "${signature}" must be a non-empty string.`,
      };
    }

    definitions.push({ signature, name, source: "plugin-config" });
  }

  return prepareMappings(definitions);
}

function emptyMappings(): { readonly ok: true; readonly value: PreparedMappings } {
  const prepared = prepareMappings([]);
  if (!prepared.ok) {
    throw new Error(prepared.message);
  }

  return prepared;
}

function parseUnknownPolicy(
  value: unknown,
):
  | { readonly ok: true; readonly value: UnknownPolicy }
  | { readonly ok: false; readonly message: string } {
  if (value === undefined) {
    return { ok: true, value: "emit" };
  }

  if (value !== "emit" && value !== "skip") {
    return {
      ok: false,
      message: 'Invalid plugin config: "unknownPolicy" must be "emit" or "skip".',
    };
  }

  return { ok: true, value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
