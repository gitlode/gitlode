import type {
  ProfileAttribute,
  ProfileAttributeValue,
  ProfileInstrumentationScope,
} from "./profile-report.js";

export type ProfileValueNormalization =
  | { readonly valid: true; readonly value: ProfileAttributeValue }
  | { readonly valid: false };
export function normalizeProfileAttributeValue(value: unknown): ProfileValueNormalization {
  if (typeof value === "string" || typeof value === "boolean") return { valid: true, value };
  if (typeof value === "number" && Number.isFinite(value))
    return { valid: true, value: Object.is(value, -0) ? 0 : value };
  return { valid: false };
}
export function normalizeProfileInstrumentationScope(
  name: string,
  version?: string | null,
): ProfileInstrumentationScope {
  return { name, version: version ?? null };
}
export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
const typeOrder = (value: ProfileAttributeValue): number =>
  typeof value === "boolean" ? 0 : typeof value === "number" ? 1 : 2;
export function compareProfileAttributeValues(
  left: ProfileAttributeValue,
  right: ProfileAttributeValue,
): number {
  const byType = typeOrder(left) - typeOrder(right);
  if (byType !== 0) return byType;
  if (typeof left === "string" && typeof right === "string") return compareCodeUnits(left, right);
  if (typeof left === "number" && typeof right === "number") return left - right;
  return left === right ? 0 : left === false ? -1 : 1;
}
export function compareProfileAttributes(left: ProfileAttribute, right: ProfileAttribute): number {
  return compareCodeUnits(left.key, right.key);
}
export function compareProfileScopes(
  left: ProfileInstrumentationScope,
  right: ProfileInstrumentationScope,
): number {
  const byName = compareCodeUnits(left.name, right.name);
  if (byName !== 0) return byName;
  if (left.version === null) return right.version === null ? 0 : -1;
  if (right.version === null) return 1;
  return compareCodeUnits(left.version, right.version);
}
