/**
 * Active users.
 *
 * Actor: `coalesce(user_id, stitched user, anonymous_id)`, resolved in SQL (an
 * `anonymous_id` that appears on any event together with a `user_id` belongs
 * to that user, the earliest if several). Activity is any event in
 * `activeEvents`, on any platform; by default every event except
 * `$session_end` and except events whose platform is `server` (the host's own
 * `track()` calls, such as a renewal webhook, say nothing about the user).
 *
 * Reported twice:
 * - `signed_in`: distinct `user_id` on events that carried one.
 * - `all`: distinct actor, which includes anonymous devices.
 *
 * DAU counts actors active on a day, WAU the 7 days ending on it, MAU the 30
 * days ending on it. Stickiness is the average DAU over the range divided by
 * MAU on the range's last day.
 */

import { addDays, dayNumber, eachDay } from "./dates";
import { rateCell } from "./definitions";
import type { ActiveUsers, ActiveUsersPoint, ActiveUsersVariant, ActivityRow, DateRange } from "./types";

export const WAU_DAYS = 7;
export const MAU_DAYS = 30;

/** The earliest day activity rows must cover for a range: 29 days before `from`. */
export function activityWindowStart(range: DateRange): string {
  return addDays(range.from, -(MAU_DAYS - 1));
}

/**
 * Distinct actors per day for trailing windows of 1, 7 and 30 days. Each
 * actor's active days are turned into merged coverage intervals and added to a
 * difference array, so the cost is linear in the rows, not rows times days.
 */
function trailingCounts(daysByActor: Map<string, number[]>, start: number, length: number, windowDays: number): number[] {
  const diff = new Array<number>(length + 1).fill(0);
  const end = start + length - 1;
  for (const days of daysByActor.values()) {
    let runStart = Number.NaN;
    let runEnd = Number.NaN;
    const flush = () => {
      if (Number.isNaN(runStart)) return;
      const a = Math.max(runStart, start);
      const b = Math.min(runEnd, end);
      if (a <= b) {
        diff[a - start] += 1;
        diff[b - start + 1] -= 1;
      }
    };
    for (const day of days) {
      const coverEnd = day + windowDays - 1;
      if (!Number.isNaN(runEnd) && day <= runEnd + 1) {
        runEnd = Math.max(runEnd, coverEnd);
      } else {
        flush();
        runStart = day;
        runEnd = coverEnd;
      }
    }
    flush();
  }
  const counts: number[] = [];
  let running = 0;
  for (let i = 0; i < length; i += 1) {
    running += diff[i];
    counts.push(running);
  }
  return counts;
}

function variant(rows: ActivityRow[], range: DateRange, include: (row: ActivityRow) => boolean): ActiveUsersVariant {
  const dates = eachDay(range);
  const start = dayNumber(range.from);
  const sets = new Map<string, Set<number>>();
  for (const row of rows) {
    if (!include(row)) continue;
    let days = sets.get(row.actor);
    if (!days) {
      days = new Set();
      sets.set(row.actor, days);
    }
    days.add(dayNumber(row.day));
  }
  const daysByActor = new Map<string, number[]>();
  for (const [actor, days] of sets) daysByActor.set(actor, [...days].sort((a, b) => a - b));

  const dau = trailingCounts(daysByActor, start, dates.length, 1);
  const wau = trailingCounts(daysByActor, start, dates.length, WAU_DAYS);
  const mau = trailingCounts(daysByActor, start, dates.length, MAU_DAYS);
  const series: ActiveUsersPoint[] = dates.map((date, i) => ({ date, dau: dau[i], wau: wau[i], mau: mau[i] }));
  const last = series[series.length - 1];
  const averageDau = dau.reduce((sum, value) => sum + value, 0) / dates.length;
  return {
    series,
    last: { dau: last.dau, wau: last.wau, mau: last.mau },
    stickiness: rateCell(averageDau, last.mau, true),
  };
}

/**
 * DAU, WAU and MAU for every day of the range, both variants. `rows` must
 * cover `activityWindowStart(range)` through `range.to`; rows outside that are
 * ignored by the window arithmetic.
 */
export function computeActiveUsers(rows: ActivityRow[], range: DateRange): ActiveUsers {
  return {
    signed_in: variant(rows, range, (row) => row.signed_in),
    all: variant(rows, range, () => true),
  };
}
