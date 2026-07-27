import { z } from "zod";

import {
  byteSizeString,
  ROTATION_SIZE_MAX_BYTES,
  ROTATION_SIZE_MIN_BYTES,
} from "../config/index.js";
import type { IsoDateTimeString } from "../support/index.js";
import { MISSING_STATE_OPTION_VALUES } from "./missing-state-option.js";

export function positiveIntegerString(error?: string) {
  return z
    .string({
      error,
    })
    .transform((value, ctx) => {
      const trimmed = value.trim();

      if (!/^[1-9]\d*$/.test(trimmed)) {
        ctx.issues.push({
          code: "custom",
          message: error,
          input: value,
        });

        return z.NEVER;
      }

      const parsed = Number(trimmed);

      if (!Number.isSafeInteger(parsed)) {
        ctx.issues.push({
          code: "custom",
          message: error,
          input: value,
        });

        return z.NEVER;
      }

      return parsed;
    });
}

export const CommandArgsSchema = z.object({
  ref: z
    .array(z.string().min(1))
    .min(1)
    .optional()
    .transform((val) => val ?? []),
  incremental: z.boolean(),
  outputDir: z.string().min(1).optional(),
  outputPrefix: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  missingState: z
    .enum(MISSING_STATE_OPTION_VALUES, {
      error: `--missing-states must be one of the following values: ${MISSING_STATE_OPTION_VALUES.join(", ")}`,
    })
    .optional(),
  sinceRef: z.string().min(1).optional(),
  sinceDate: z.iso
    .datetime({
      offset: true,
      error: "Invalid date format for --since-date. Expected ISO 8601 (e.g. 2024-01-01T00:00:00Z)",
    })
    .transform((value) => value as IsoDateTimeString)
    .optional(),
  rotateLines: positiveIntegerString("--rotate-lines must be a positive integer").optional(),
  rotateSize: byteSizeString({
    minBytes: ROTATION_SIZE_MIN_BYTES,
    maxBytes: ROTATION_SIZE_MAX_BYTES,
    optionName: "--rotate-size",
  }).optional(),
  maxDiffSize: byteSizeString({ minBytes: 1n, optionName: "--max-diff-size" }).optional(),
  quiet: z.boolean(),
  profile: z.boolean(),
  perFile: z.boolean(),
  repoName: z.string().min(1).optional(),
  repoUrl: z.string().min(1).optional(),
  config: z.string().min(1).optional(),
});

export type ParsedCliOptions = z.infer<typeof CommandArgsSchema>;
