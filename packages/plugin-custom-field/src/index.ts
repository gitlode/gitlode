import type {
  PluginFactory,
  PluginInitResult,
  PluginProjectionResult,
  PluginProjectionValue,
  PluginRuntimeContext,
  ProjectorPlugin,
} from "gitlode/plugin-api";

type FieldValue = string | number | boolean | null;
type ParseResult =
  | { type: "ok"; value: PluginProjectionValue }
  | { type: "error"; message: string };

const FIELD_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseScalarValue(valueRaw: unknown): ParseResult {
  switch (typeof valueRaw) {
    case "string":
    case "boolean":
      return { type: "ok", value: valueRaw };
    case "number":
      if (!Number.isFinite(valueRaw)) {
        return {
          type: "error",
          message: 'Invalid plugin config: "value" must be a finite number.',
        };
      }
      return { type: "ok", value: valueRaw };
    default:
      return {
        type: "error",
        message: 'Invalid plugin config: "value" must be an object, string, number, or boolean.',
      };
  }
}

export function parseConfig(rawConfig: unknown): ParseResult {
  if (!isRecord(rawConfig)) {
    return {
      type: "error",
      message: 'Invalid plugin config: top-level value must be an object with a "value" property.',
    };
  }

  const valueRaw = rawConfig["value"];
  if (!isRecord(valueRaw)) {
    return parseScalarValue(valueRaw);
  }

  const entries = Object.entries(valueRaw);
  if (entries.length === 0) {
    return {
      type: "error",
      message: 'Invalid plugin config: "value" must contain at least one entry.',
    };
  }

  const parsedValue: Record<string, FieldValue> = {};
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
        parsedValue[fieldName] = value;
        break;
      case "number":
        if (!Number.isFinite(value)) {
          return {
            type: "error",
            message: `Invalid plugin config: field "${fieldName}" must be a finite number.`,
          };
        }
        parsedValue[fieldName] = value;
        break;
      case "object":
        // Top-level value does not allow null, but object field values may be null.
        if (value === null) {
          parsedValue[fieldName] = null;
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

  return { type: "ok", value: Object.freeze(parsedValue) };
}

const factory: PluginFactory = async (rawConfig: unknown) => {
  let runtime: PluginRuntimeContext | undefined;
  let projectionValue: PluginProjectionValue | undefined;

  return {
    async init(runtimeContext: PluginRuntimeContext): Promise<PluginInitResult> {
      runtime = runtimeContext;
      const parseResult = parseConfig(rawConfig);
      if (parseResult.type !== "ok") {
        runtimeContext.error(parseResult.message);
        return { type: "fatal" };
      }
      projectionValue = parseResult.value;
      return { type: "ready" };
    },
    async project(): Promise<PluginProjectionResult> {
      if (projectionValue === undefined) {
        runtime?.error("Plugin used before successful initialization.");
        return { type: "fatal" };
      }
      return { type: "success", data: projectionValue };
    },
  } satisfies ProjectorPlugin;
};

export default factory;
