/**
 * Funnels.
 *
 * Ordered steps; other events may occur between them. An actor enters at their
 * first step-1 event inside the range, and the conversion window starts there
 * (default 7 days, inclusive of its last instant). The actor is counted at step
 * k if they did steps 1..k in that order inside the window. Matching is greedy
 * (each step takes the earliest qualifying event at or after the previous
 * step's instant, never reusing an event), which finds an ordered completion
 * whenever one exists. An event at the same instant as the previous step
 * qualifies, so steps recorded in one batch with one timestamp count in step
 * order, and the result never depends on row ids or arrival order.
 *
 * Per step: actors, conversion from step 1, conversion from the previous step,
 * and the median seconds from the previous step among actors who reached it.
 * Actors whose window is still open at `now` and who have not finished are
 * reported as `open`: their figures may still rise.
 */

import { DAY_MS } from "./dates";
import { DEFAULT_FUNNEL_WINDOW_DAYS, rateCell } from "./definitions";
import type { FunnelDefinition, FunnelEventRow, FunnelResult, FunnelStepResult } from "./types";

export interface FunnelBounds {
  /** Range start and end instants (epoch ms, end exclusive) that step 1 must fall in. */
  startMs: number;
  endMs: number;
  nowMs: number;
}

/** Median of a non-empty list; the mean of the middle two for an even count. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface TimedEvent {
  name: string;
  at: number;
  order: number;
}

export function computeFunnel(definition: FunnelDefinition, rows: FunnelEventRow[], bounds: FunnelBounds): FunnelResult {
  const steps = definition.steps;
  const windowDays = definition.windowDays ?? DEFAULT_FUNNEL_WINDOW_DAYS;
  const windowMs = windowDays * DAY_MS;

  const byActor = new Map<string, TimedEvent[]>();
  rows.forEach((row, order) => {
    const list = byActor.get(row.actor) ?? [];
    list.push({ name: row.name, at: Date.parse(row.occurred_at), order });
    byActor.set(row.actor, list);
  });

  const reached = new Array<number>(steps.length).fill(0);
  const gaps: number[][] = steps.map(() => []);
  let open = 0;

  for (const events of byActor.values()) {
    events.sort((a, b) => a.at - b.at || a.order - b.order);
    const entry = events.findIndex((e) => e.name === steps[0] && e.at >= bounds.startMs && e.at < bounds.endMs);
    if (entry === -1) continue;
    const used = new Set<number>([entry]);
    const enteredAt = events[entry].at;
    const deadline = enteredAt + windowMs;
    let step = 1;
    let previousAt = enteredAt;
    reached[0] += 1;
    while (step < steps.length) {
      // The earliest unused event of the next step at or after the previous
      // step's instant. Only time and name decide, so two events at one
      // instant match in step order whatever order they arrived in.
      let match = -1;
      for (let i = 0; i < events.length; i += 1) {
        const event = events[i];
        if (event.at > deadline) break;
        if (event.at < previousAt || used.has(i) || event.name !== steps[step]) continue;
        match = i;
        break;
      }
      if (match === -1) break;
      used.add(match);
      reached[step] += 1;
      gaps[step].push((events[match].at - previousAt) / 1000);
      previousAt = events[match].at;
      step += 1;
    }
    if (step < steps.length && deadline > bounds.nowMs) open += 1;
  }

  const results: FunnelStepResult[] = steps.map((step, i) => ({
    step,
    actors: reached[i],
    from_first: rateCell(reached[i], reached[0]),
    from_previous: rateCell(reached[i], i === 0 ? reached[0] : reached[i - 1]),
    median_seconds_from_previous: i === 0 ? null : median(gaps[i]),
  }));

  return { key: definition.key, name: definition.name, window_days: windowDays, steps: results, open };
}
