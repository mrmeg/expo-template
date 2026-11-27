/**
 * Small value helpers shared by the server modules. Pure.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Lowercased canonical UUID, or null. Postgres returns `uuid::text` lowercase, so ids are compared that way. */
export function asUuid(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

/** Trimmed, non-empty string capped at `max`, or null. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = cleanString(value).trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * Postgres `jsonb` and `text` reject NUL, and `jsonb` rejects the escapes
 * `JSON.stringify` emits for lone surrogates. Either would fail a whole batch,
 * so strings are cleaned before they reach a parameter.
 */
export function cleanString(value: string): string {
  return value.replace(/\u0000/g, "").replace(LONE_SURROGATE, "�");
}

/** Deep copy with every key and string cleaned (see `cleanString`). */
export function cleanJson(value: unknown): unknown {
  if (typeof value === "string") return cleanString(value);
  if (Array.isArray(value)) return value.map(cleanJson);
  if (typeof value === "object" && value !== null) {
    if (value instanceof Date) return value.toISOString();
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[cleanString(key)] = cleanJson(item);
    return out;
  }
  return value;
}

/**
 * One JSON parameter, per the `sql.ts` conventions. Cast it `$n::text::jsonb`,
 * never `$n::jsonb`: postgres.js reads the parameter type the server infers,
 * and for `jsonb` it JSON-encodes the string a second time, so the value would
 * arrive as a JSON string scalar instead of the array or object.
 */
export function jsonParam(value: unknown): string {
  return JSON.stringify(cleanJson(value));
}

/** Lowercased hostname of a URL (or of a bare host), or null. */
export function hostOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const host = url.hostname.toLowerCase();
    return host.length > 0 ? host : null;
  } catch {
    return null;
  }
}

/** Hosts compared for "same site" purposes: case-insensitive, ignoring a leading `www.`. */
export function sameHost(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const strip = (host: string) => host.toLowerCase().replace(/^www\./, "");
  return strip(a) === strip(b);
}

export function toDate(value: number | Date | string): Date {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}
