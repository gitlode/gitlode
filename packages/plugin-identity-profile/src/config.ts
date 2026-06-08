import type { PluginRuntimeContext } from "gitlode/plugin-api";

const RESERVED_FIELDS = new Set(["matchEmail", "matchName", "name", "email"]);

type AttributeValue = string | number | boolean | null;
type RawMappingRow = Record<string, unknown>;

export interface PreparedMappingRow {
  readonly order: number;
  readonly matchEmail?: string;
  readonly matchName?: string;
  readonly name: string;
  readonly email: string;
  readonly attributes: Readonly<Record<string, AttributeValue>>;
}

export interface PreparedConfig {
  readonly debug: boolean;
  readonly attributeFields: readonly string[];
  readonly emailIndex: ReadonlyMap<string, readonly PreparedMappingRow[]>;
  readonly nameIndex: ReadonlyMap<string, readonly PreparedMappingRow[]>;
}

type ParseSuccess = { readonly ok: true; readonly value: PreparedConfig };
type ParseFailure = { readonly ok: false };

export function prepareConfig(
  rawConfig: unknown,
  runtime: PluginRuntimeContext,
): ParseSuccess | ParseFailure {
  const errors: string[] = [];
  const warnings = new Set<string>();

  if (!isRecord(rawConfig)) {
    return failWith(runtime, ["Invalid plugin config: top-level value must be an object."]);
  }

  const debug = parseDebug(rawConfig["debug"], errors);
  const attributeFields = parseAttributeFields(rawConfig["attributeFields"], errors);
  const attributeFieldSet = new Set(attributeFields);

  for (const field of attributeFields) {
    if (RESERVED_FIELDS.has(field)) {
      errors.push(
        `Invalid plugin config: attributeFields must not contain reserved field name "${field}".`,
      );
    }
  }

  const rawProfileMappings = rawConfig["profileMappings"];
  if (!Array.isArray(rawProfileMappings)) {
    errors.push('Invalid plugin config: "profileMappings" must be an array.');
    return failWith(runtime, errors);
  }
  if (rawProfileMappings.length === 0) {
    errors.push('Invalid plugin config: "profileMappings" must contain at least one row.');
    return failWith(runtime, errors);
  }

  const preparedRows: PreparedMappingRow[] = [];

  rawProfileMappings.forEach((rowValue, index) => {
    const label = `profileMappings[${index}]`;
    if (!isRecord(rowValue)) {
      errors.push(`Invalid plugin config: ${label} must be an object.`);
      return;
    }

    for (const fieldName of Object.keys(rowValue)) {
      if (!RESERVED_FIELDS.has(fieldName) && !attributeFieldSet.has(fieldName)) {
        warnings.add(
          `Profile mapping field "${fieldName}" is not reserved and not listed in attributeFields; it will be ignored.`,
        );
      }
    }

    const matchEmail = parseOptionalMatcher(rowValue["matchEmail"], `${label}.matchEmail`, errors);
    const matchName = parseOptionalMatcher(rowValue["matchName"], `${label}.matchName`, errors);
    const name = parseRequiredString(rowValue["name"], `${label}.name`, errors);
    const email = parseRequiredString(rowValue["email"], `${label}.email`, errors);
    const attributes = parseAttributes(rowValue, attributeFields, label, errors);

    if (matchEmail === undefined && matchName === undefined) {
      errors.push(
        `Invalid plugin config: ${label} must define at least one of "matchEmail" or "matchName".`,
      );
    }

    if (name === undefined || email === undefined) {
      return;
    }

    preparedRows.push({
      order: index,
      matchEmail,
      matchName,
      name,
      email,
      attributes,
    });
  });

  if (errors.length > 0) {
    return failWith(runtime, errors);
  }

  const emailIndex = new Map<string, PreparedMappingRow[]>();
  const nameIndex = new Map<string, PreparedMappingRow[]>();

  for (const row of preparedRows) {
    if (row.matchEmail !== undefined) {
      const bucket = emailIndex.get(row.matchEmail);
      if (bucket) {
        bucket.push(row);
      } else {
        emailIndex.set(row.matchEmail, [row]);
      }
    }
    if (row.matchName !== undefined) {
      const bucket = nameIndex.get(row.matchName);
      if (bucket) {
        bucket.push(row);
      } else {
        nameIndex.set(row.matchName, [row]);
      }
    }
  }

  for (const warning of warnings) {
    runtime.warn(warning);
  }

  warnOnOverlaps(emailIndex, "matchEmail", runtime);
  warnOnOverlaps(nameIndex, "matchName", runtime);

  return {
    ok: true,
    value: {
      debug,
      attributeFields,
      emailIndex,
      nameIndex,
    },
  };
}

function failWith(runtime: PluginRuntimeContext, errors: readonly string[]): ParseFailure {
  for (const error of errors) {
    runtime.error(error);
  }
  return { ok: false };
}

function parseDebug(rawDebug: unknown, errors: string[]): boolean {
  if (rawDebug === undefined) {
    return false;
  }
  if (typeof rawDebug !== "boolean") {
    errors.push('Invalid plugin config: "debug" must be a boolean.');
    return false;
  }
  return rawDebug;
}

function parseAttributeFields(rawAttributeFields: unknown, errors: string[]): readonly string[] {
  if (rawAttributeFields === undefined) {
    return [];
  }
  if (!Array.isArray(rawAttributeFields)) {
    errors.push('Invalid plugin config: "attributeFields" must be an array of strings.');
    return [];
  }

  const uniqueFields: string[] = [];
  const seen = new Set<string>();

  rawAttributeFields.forEach((field, index) => {
    if (typeof field !== "string") {
      errors.push(`Invalid plugin config: attributeFields[${index}] must be a string.`);
      return;
    }
    if (!seen.has(field)) {
      seen.add(field);
      uniqueFields.push(field);
    }
  });

  return uniqueFields;
}

function parseOptionalMatcher(
  rawValue: unknown,
  path: string,
  errors: string[],
): string | undefined {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return undefined;
  }
  if (typeof rawValue !== "string") {
    errors.push(`Invalid plugin config: ${path} must be a string, empty string, or null.`);
    return undefined;
  }
  return rawValue;
}

function parseRequiredString(
  rawValue: unknown,
  path: string,
  errors: string[],
): string | undefined {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    errors.push(`Invalid plugin config: ${path} must be a non-empty string.`);
    return undefined;
  }
  return rawValue;
}

function parseAttributes(
  row: RawMappingRow,
  attributeFields: readonly string[],
  label: string,
  errors: string[],
): Readonly<Record<string, AttributeValue>> {
  const attributes: Record<string, AttributeValue> = {};

  for (const field of attributeFields) {
    if (!(field in row)) {
      continue;
    }
    const value = row[field];
    if (value === undefined) {
      continue;
    }
    switch (typeof value) {
      case "string":
      case "number":
      case "boolean":
        attributes[field] = value;
        break;
      case "object":
        if (value === null) {
          attributes[field] = null;
          break;
        }
        errors.push(
          `Invalid plugin config: ${label}.${field} must be a scalar JSON value or null.`,
        );
        break;
      default:
        errors.push(
          `Invalid plugin config: ${label}.${field} must be a scalar JSON value or null.`,
        );
        break;
    }
  }

  return Object.freeze(attributes);
}

function warnOnOverlaps(
  index: ReadonlyMap<string, readonly PreparedMappingRow[]>,
  fieldName: "matchEmail" | "matchName",
  runtime: PluginRuntimeContext,
): void {
  for (const [key, rows] of index.entries()) {
    if (rows.length > 1) {
      runtime.warn(
        `${fieldName} "${key}" appears in multiple profileMappings; first matching row wins and later rows may be shadowed.`,
      );
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
