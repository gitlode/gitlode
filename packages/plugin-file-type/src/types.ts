import type { Brand } from "gitlode/plugin-api";

export type RuleSetName = "common";
export type MappingSource = "plugin-config" | RuleSetName;

export type BasenameSignature = Brand<string, "BasenameSignature">;
export type SuffixSignature = Brand<string, "SuffixSignature">;

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

export type SignatureParseResult =
  | { readonly ok: true; readonly type: "basename"; readonly value: BasenameSignature }
  | { readonly ok: true; readonly type: "suffix"; readonly value: SuffixSignature }
  | { readonly ok: false; readonly message: string };

export interface Classification {
  readonly name: string;
  readonly source: MappingSource | "unknown";
  readonly matched: string | null;
}

export type UnknownPolicy = "emit" | "skip";

export interface PreparedConfig {
  readonly debug: boolean;
  readonly ruleSets: readonly PreparedRuleSet[];
  readonly mappings: PreparedMappings;
  readonly unknownPolicy: UnknownPolicy;
}

export interface PreparedRuleSet {
  readonly name: RuleSetName;
  readonly mappings: PreparedMappings;
}
