/**
 * Retention, cohorted on `users.first_seen_at` (the day a user was first seen,
 * in the configured zone). Activity is any `activeEvents` event by the user,
 * directly or through a stitched anonymous device.
 *
 * Modes, for day N after first seen (first seen is day 0):
 * - `on`: active on exactly day N.
 * - `on_or_after`: active on day N or any later day, up to today.
 * - `bracket`: active on any day in [N, N + 6].
 * Headline default: `on` for N = 1, `bracket` for N >= 7.
 *
 * A window has closed once its last day is over (before today in the zone);
 * an `on_or_after` window counts as closed once day N is over, though its
 * value can still rise. A cohort cell is `not_yet` until the window has closed
 * for the cohort's youngest member. The headline figure instead leaves members
 * whose window is still open out of the denominator and reports them as
 * pending, so a range that ends today still has a measured headline.
 *
 * Weekly grid: the last 12 ISO-week cohorts ending with the week containing the
 * range end, by weeks 0 to 12, where week w is classic week-N retention: active
 * on any day in [7w, 7w + 6] after first seen.
 */

import { addDays, dayNumber, eachDay, isoWeekLabel, isoWeekStart, minDay } from "./dates";
import {
  BRACKET_SPAN_DAYS,
  WEEKLY_COHORT_COUNT,
  WEEKLY_GRID_WEEKS,
  defaultRetentionMode,
  rateCell,
  settledRateCell,
} from "./definitions";
import type {
  CohortMember,
  DateRange,
  RateCell,
  RetentionCohortRow,
  RetentionHeadline,
  RetentionMode,
  UserActivityRow,
  WeeklyRetentionCohort,
} from "./types";

/** Day offsets after first seen that count, inclusive; `last` is null for an open-ended window. */
export interface RetentionWindow {
  first: number;
  last: number | null;
}

export function retentionWindow(mode: RetentionMode, day: number): RetentionWindow {
  switch (mode) {
    case "on":
      return { first: day, last: day };
    case "bracket":
      return { first: day, last: day + BRACKET_SPAN_DAYS - 1 };
    case "on_or_after":
      return { first: day, last: null };
  }
}

/** Last day offset that must be over before the window counts as closed. */
function closingOffset(window: RetentionWindow): number {
  return window.last ?? window.first;
}

/** True once the window's closing day, counted from `firstDay`, is before `today`. */
export function windowClosed(firstDay: string, window: RetentionWindow, today: string): boolean {
  return addDays(firstDay, closingOffset(window)) < today;
}

/** user id to active day numbers, plus the latest one for open-ended windows. */
export interface UserActivityIndex {
  days: Map<string, Set<number>>;
  latest: Map<string, number>;
}

export function indexUserActivity(rows: UserActivityRow[]): UserActivityIndex {
  const days = new Map<string, Set<number>>();
  const latest = new Map<string, number>();
  for (const row of rows) {
    const day = dayNumber(row.day);
    let set = days.get(row.user_id);
    if (!set) {
      set = new Set();
      days.set(row.user_id, set);
    }
    set.add(day);
    if ((latest.get(row.user_id) ?? Number.NEGATIVE_INFINITY) < day) latest.set(row.user_id, day);
  }
  return { days, latest };
}

/** Active on any day in the window, counted from the member's first day. */
export function isRetained(index: UserActivityIndex, member: CohortMember, window: RetentionWindow): boolean {
  const first = dayNumber(member.first_day) + window.first;
  if (window.last === null) return (index.latest.get(member.user_id) ?? Number.NEGATIVE_INFINITY) >= first;
  const days = index.days.get(member.user_id);
  if (!days) return false;
  const last = dayNumber(member.first_day) + window.last;
  for (let day = first; day <= last; day += 1) if (days.has(day)) return true;
  return false;
}

function cohortCell(members: CohortMember[], index: UserActivityIndex, window: RetentionWindow, today: string): RateCell {
  if (members.length === 0) return rateCell(0, 0);
  let youngest = members[0].first_day;
  let retained = 0;
  for (const member of members) {
    if (member.first_day > youngest) youngest = member.first_day;
    if (isRetained(index, member, window)) retained += 1;
  }
  return rateCell(retained, members.length, windowClosed(youngest, window, today));
}

export interface RetentionInput {
  /** Every user first seen in the range or the weekly grid's window; extras are ignored. */
  members: CohortMember[];
  activity: UserActivityRow[] | UserActivityIndex;
  range: DateRange;
  /** Today in the configured zone. */
  today: string;
  /** N values for the headline and the daily cohort table. */
  days: readonly number[];
  /** Overrides the per-N default mode. */
  mode?: RetentionMode;
}

export interface RetentionResult {
  headline: RetentionHeadline[];
  cohorts: RetentionCohortRow[];
  weekly: WeeklyRetentionCohort[];
}

function toIndex(activity: UserActivityRow[] | UserActivityIndex): UserActivityIndex {
  return Array.isArray(activity) ? indexUserActivity(activity) : activity;
}

/** Headline per N: members first seen in the range whose window has closed; the rest are pending. */
export function computeRetentionHeadline(input: RetentionInput): RetentionHeadline[] {
  const index = toIndex(input.activity);
  const members = input.members.filter((m) => m.first_day >= input.range.from && m.first_day <= input.range.to);
  return input.days.map((day) => {
    const mode = input.mode ?? defaultRetentionMode(day);
    const window = retentionWindow(mode, day);
    let settled = 0;
    let retained = 0;
    for (const member of members) {
      if (!windowClosed(member.first_day, window, input.today)) continue;
      settled += 1;
      if (isRetained(index, member, window)) retained += 1;
    }
    const pending = members.length - settled;
    return { day, mode, cell: settledRateCell(retained, settled, pending), pending };
  });
}

/** One cohort per day of the range, each cell `not_yet` until that day's window has closed. */
export function computeDailyCohorts(input: RetentionInput): RetentionCohortRow[] {
  const index = toIndex(input.activity);
  const byDay = new Map<string, CohortMember[]>();
  for (const member of input.members) {
    const list = byDay.get(member.first_day) ?? [];
    list.push(member);
    byDay.set(member.first_day, list);
  }
  return eachDay(input.range).map((cohort) => {
    const members = byDay.get(cohort) ?? [];
    return {
      cohort,
      size: members.length,
      cells: input.days.map((day) => {
        const mode = input.mode ?? defaultRetentionMode(day);
        return { day, mode, cell: cohortCell(members, index, retentionWindow(mode, day), input.today) };
      }),
    };
  });
}

/** First day of the weekly grid: Monday 11 weeks before the week containing `range.to`. */
export function weeklyGridStart(range: DateRange): string {
  return addDays(isoWeekStart(range.to), -7 * (WEEKLY_COHORT_COUNT - 1));
}

/** The last 12 ISO-week cohorts ending at the range end, by weeks 0 to 12. */
export function computeWeeklyGrid(input: Omit<RetentionInput, "days" | "mode">): WeeklyRetentionCohort[] {
  const index = toIndex(input.activity);
  const gridStart = weeklyGridStart(input.range);
  const cohorts: WeeklyRetentionCohort[] = [];
  for (let i = 0; i < WEEKLY_COHORT_COUNT; i += 1) {
    const start = addDays(gridStart, 7 * i);
    const end = minDay(addDays(start, 6), input.range.to);
    const members = input.members.filter((m) => m.first_day >= start && m.first_day <= end);
    const weeks: RateCell[] = [];
    for (let week = 0; week < WEEKLY_GRID_WEEKS; week += 1) {
      weeks.push(cohortCell(members, index, { first: 7 * week, last: 7 * week + 6 }, input.today));
    }
    cohorts.push({ cohort: start, label: isoWeekLabel(start), start, end, size: members.length, weeks });
  }
  return cohorts;
}

export function computeRetention(input: RetentionInput): RetentionResult {
  const index = toIndex(input.activity);
  const withIndex = { ...input, activity: index };
  return {
    headline: computeRetentionHeadline(withIndex),
    cohorts: computeDailyCohorts(withIndex),
    weekly: computeWeeklyGrid(withIndex),
  };
}

/**
 * Furthest day offset any retention figure for these N values reads, so the
 * fetcher can bound the activity it loads. Open-ended windows read to today.
 */
export function retentionReach(days: readonly number[], mode?: RetentionMode): { offset: number; openEnded: boolean } {
  let offset = 7 * (WEEKLY_GRID_WEEKS - 1) + 6;
  let openEnded = false;
  for (const day of days) {
    const window = retentionWindow(mode ?? defaultRetentionMode(day), day);
    if (window.last === null) openEnded = true;
    offset = Math.max(offset, window.last ?? window.first);
  }
  return { offset, openEnded };
}
