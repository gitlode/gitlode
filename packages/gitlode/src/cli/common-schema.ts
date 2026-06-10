import { z } from "zod";

import { atOrThrow, captureGroupOrThrow } from "../core/helpers.js";

/**
 * Parse a binary size string (e.g. "100K", "1M") to bytes.
 * Supports suffixes K (1024), M (1048576), G (1073741824).

 * - minBytes - Minimum allowed value in bytes; null for no minimum
 * - maxBytes - Maximum allowed value in bytes; null for no maximum
 * - optionName - name for error messages
 */
export function byteSizeString(options?: {
  minBytes?: bigint;
  maxBytes?: bigint;
  optionName?: string;
}) {
  const optionName = options?.optionName ?? "value";
  const defaultError = `${optionName} must be a positive integer (bytes) or an integer with suffix K, M, or G (e.g. 500M, 1G)`;
  return z
    .string(defaultError)
    .min(1)
    .transform((value, ctx) => {
      const trimmed = value.trim();
      const match = /^(\d+)([kKmMgG]?)$/.exec(trimmed);
      if (!match) {
        ctx.issues.push({
          code: "custom",
          message: defaultError,
          input: value,
        });

        return z.NEVER;
      }
      const numPart = BigInt(captureGroupOrThrow(match, 1));
      const suffix = captureGroupOrThrow(match, 2).toUpperCase();
      const multipliers: Record<string, bigint> = {
        "": 1n,
        K: 1024n,
        M: 1_048_576n,
        G: 1_073_741_824n,
      };

      const multiplier = multipliers[suffix];
      if (multiplier === undefined) {
        ctx.issues.push({
          code: "custom",
          message: defaultError,
          input: value,
        });

        return z.NEVER;
      }

      const bytes = numPart * multiplier;
      if (options === undefined) {
        return Number(bytes);
      }

      // range checks
      const { minBytes, maxBytes } = options;
      if (
        minBytes !== undefined &&
        maxBytes !== undefined &&
        (bytes < minBytes || bytes > maxBytes)
      ) {
        ctx.issues.push({
          code: "custom",
          message: `${optionName} must be between ${Number(minBytes)} and ${Number(maxBytes)} bytes`,
          input: value,
        });

        return z.NEVER;
      }
      if (minBytes !== undefined && maxBytes === undefined && bytes < minBytes) {
        ctx.issues.push({
          code: "custom",
          message: `${optionName} must be at least ${Number(minBytes)} byte`,
          input: value,
        });

        return z.NEVER;
      }
      if (minBytes === undefined && maxBytes !== undefined && bytes > maxBytes) {
        ctx.issues.push({
          code: "custom",
          message: `${optionName} must be at most ${Number(maxBytes)} bytes`,
          input: value,
        });

        return z.NEVER;
      }

      return Number(bytes);
    });
}
