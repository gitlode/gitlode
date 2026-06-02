import type { PluginFactory, PluginInitResult, PluginProjectionResult } from "gitlode/plugin-api";

type FieldValue = string | number | boolean | null;
type ParseResult =
  | { type: "ok"; fields: Readonly<Record<string, FieldValue>> }
  | { type: "error"; message: string };

const FIELD_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseConfig(rawConfig: unknown): ParseResult {
  if (!isRecord(rawConfig)) {
    return {
      type: "error",
      message: 'Invalid plugin config: top-level value must be an object with a "fields" property.',
    };
  }

  const fieldsRaw = rawConfig["fields"];
  if (!isRecord(fieldsRaw)) {
    return {
      type: "error",
      message: 'Invalid plugin config: "fields" must be an object containing at least one entry.',
    };
  }

  const entries = Object.entries(fieldsRaw);
  if (entries.length === 0) {
    return {
      type: "error",
      message: 'Invalid plugin config: "fields" must contain at least one entry.',
    };
  }

  const parsedFields: Record<string, FieldValue> = {};
  for (const [fieldName, value] of entries) {
    if (!FIELD_NAME_PATTERN.test(fieldName)) {
      return {
        type: "error",
        message: `Invalid plugin config: field name "${fieldName}" must match ^[A-Za-z_][A-Za-z0-9_-]*$.`,
      };
    }

    switch (typeof value) {
      case "string":
      case "boolean":
        parsedFields[fieldName] = value;
        break;
      case "number":
        if (!Number.isFinite(value)) {
          return {
            type: "error",
            message: `Invalid plugin config: field "${fieldName}" must be a finite number.`,
          };
        }
        parsedFields[fieldName] = value;
        break;
      case "object":
        if (value === null) {
          parsedFields[fieldName] = null;
          break;
        }
        return {
          type: "error",
          message: `Invalid plugin config: field "${fieldName}" must be string, number, boolean, or null.`,
        };
      default:
        return {
          type: "error",
          message: `Invalid plugin config: field "${fieldName}" must be string, number, boolean, or null.`,
        };
    }
  }

  return { type: "ok", fields: Object.freeze(parsedFields) };
}

const factory: PluginFactory = async (rawConfig: unknown) => {
  const parsedConfig = parseConfig(rawConfig);
  const initResult: PluginInitResult =
    parsedConfig.type === "ok"
      ? { type: "ready" }
      : { type: "fatal", message: parsedConfig.message };
  const projectResult: PluginProjectionResult =
    parsedConfig.type === "ok"
      ? { type: "success", data: parsedConfig.fields }
      : { type: "success", data: {} };

  return {
    async init() {
      return initResult;
    },
    async project() {
      return projectResult;
    },
  };
};

export default factory;
