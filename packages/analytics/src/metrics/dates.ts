/**
 * Calendar dates and zones.
 *
 * Day strings (`YYYY-MM-DD`) are calendar dates with no zone attached: SQL cuts
 * them in the configured zone, and the arithmetic here treats them as plain
 * dates (it runs on UTC midnights only so that adding days never crosses a DST
 * change). The two functions that do touch a zone, `zonedDate` and
 * `zonedDayStart`, use `Intl`, which every browser, Node and Hermes ship.
 */

import type { DateRange } from "./types";

export const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  return toIsoDate(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))) === value;
}

/** `YYYY-MM-DD` to that date's UTC midnight. */
export function parseIsoDate(value: string): Date {
  const match = ISO_DATE.exec(value);
  if (!match) throw new Error(`expo-analytics: not an ISO date: ${value}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/** UTC calendar date of an instant. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Whole days since 1970-01-01, for cheap day arithmetic. */
export function dayNumber(iso: string): number {
  return Math.round(parseIsoDate(iso).getTime() / DAY_MS);
}

export function fromDayNumber(day: number): string {
  return toIsoDate(new Date(day * DAY_MS));
}

export function addDays(iso: string, days: number): string {
  return fromDayNumber(dayNumber(iso) + days);
}

/** `b - a` in days. */
export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

/** Days in an inclusive range. */
export function daysInclusive(range: DateRange): number {
  return daysBetween(range.from, range.to) + 1;
}

/** Every date of an inclusive range, in order. */
export function eachDay(range: DateRange): string[] {
  const days: string[] = [];
  for (let day = dayNumber(range.from), end = dayNumber(range.to); day <= end; day += 1) {
    days.push(fromDayNumber(day));
  }
  return days;
}

export function minDay(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxDay(a: string, b: string): string {
  return a >= b ? a : b;
}

/** Last day of the month containing `iso`. */
export function monthEnd(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  return toIsoDate(new Date(Date.UTC(year, month, 0)));
}

/** Month-end dates that fall inside the range, in order. */
export function monthEndsInRange(range: DateRange): string[] {
  const ends: string[] = [];
  for (let end = monthEnd(range.from); end <= range.to; end = monthEnd(addDays(end, 1))) {
    ends.push(end);
  }
  return ends;
}

/** Monday of the ISO week containing `iso`. */
export function isoWeekStart(iso: string): string {
  const isoDow = (parseIsoDate(iso).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(iso, -isoDow);
}

/** `YYYY-Www` label of the ISO week containing `iso`. */
export function isoWeekLabel(iso: string): string {
  const thursday = parseIsoDate(addDays(isoWeekStart(iso), 3));
  const isoYear = thursday.getUTCFullYear();
  const ordinal = Math.round((thursday.getTime() - Date.UTC(isoYear, 0, 1)) / DAY_MS) + 1;
  const week = Math.floor((ordinal - 1) / 7) + 1;
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/** The period of equal length that ends the day before `range.from`. */
export function previousRange(range: DateRange): DateRange {
  const days = daysInclusive(range);
  return { from: addDays(range.from, -days), to: addDays(range.from, -1) };
}

// ── Zones ────────────────────────────────────────────────────────────────────

export const DEFAULT_TIMEZONE = "UTC";

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timezone, formatter);
  }
  return formatter;
}

/** True when `Intl` knows the zone. Postgres and ICU share the IANA database, so this is the check before SQL sees it. */
export function isTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return false;
  try {
    formatterFor(value);
    return true;
  } catch {
    return false;
  }
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClock(ms: number, timezone: string): WallClock {
  const values: Record<string, number> = {};
  for (const part of formatterFor(timezone).formatToParts(new Date(ms))) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    // Some engines still print midnight as 24 under h23.
    hour: values.hour % 24,
    minute: values.minute,
    second: values.second,
  };
}

/** Zone offset at an instant, in ms (wall clock minus UTC). */
function offsetMs(ms: number, timezone: string): number {
  const wall = wallClock(ms, timezone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Calendar date of an instant in `timezone`. */
export function zonedDate(instant: Date | number, timezone: string): string {
  const wall = wallClock(typeof instant === "number" ? instant : instant.getTime(), timezone);
  return `${String(wall.year).padStart(4, "0")}-${String(wall.month).padStart(2, "0")}-${String(wall.day).padStart(2, "0")}`;
}

/**
 * The instant (epoch ms) at which `day` begins in `timezone`, matching
 * Postgres's `day::date::timestamp at time zone tz`. The offset is read twice
 * because the first guess can sit on the other side of a DST change.
 */
export function zonedDayStart(day: string, timezone: string): number {
  const wallMidnight = parseIsoDate(day).getTime();
  const first = offsetMs(wallMidnight, timezone);
  const candidate = wallMidnight - first;
  const second = offsetMs(candidate, timezone);
  return second === first ? candidate : wallMidnight - second;
}

/** The instant (epoch ms) at which `day` ends in `timezone`: the start of the next day. */
export function zonedDayEnd(day: string, timezone: string): number {
  return zonedDayStart(addDays(day, 1), timezone);
}

// ── Range parameters ─────────────────────────────────────────────────────────

export const MAX_RANGE_DAYS = 400;
export const DEFAULT_RANGE_DAYS = 30;

export type RangeResolution = { ok: true; range: DateRange } | { ok: false; message: string };

/**
 * Resolves optional `from` and `to` (inclusive `YYYY-MM-DD`) against `today`
 * in the configured zone. Defaults: the last 30 days ending today, or 30 days
 * ending on `to`, or `from` through today. Rejects malformed dates, `to` before
 * `from`, and spans over 400 days.
 */
export function resolveDateRange(
  params: { from?: string | null; to?: string | null } | undefined,
  today: string,
): RangeResolution {
  const fromParam = params?.from || null;
  const toParam = params?.to || null;
  if (fromParam !== null && !isIsoDate(fromParam)) {
    return { ok: false, message: "from must be a calendar date formatted YYYY-MM-DD" };
  }
  if (toParam !== null && !isIsoDate(toParam)) {
    return { ok: false, message: "to must be a calendar date formatted YYYY-MM-DD" };
  }
  const to = toParam ?? (fromParam !== null && fromParam > today ? fromParam : today);
  const from = fromParam ?? addDays(to, -(DEFAULT_RANGE_DAYS - 1));
  if (to < from) return { ok: false, message: "to must be on or after from" };
  const range = { from, to };
  if (daysInclusive(range) > MAX_RANGE_DAYS) {
    return { ok: false, message: `The range must span at most ${MAX_RANGE_DAYS} days` };
  }
  return { ok: true, range };
}
