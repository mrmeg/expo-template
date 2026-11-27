/**
 * Funnel rows: `(actor, name, time)` for a funnel's step events, from the
 * range start to the range end plus the conversion window (a window opened on
 * the range's last day runs past it; the window is elapsed days, fixed 86400
 * seconds each, as in `computeFunnel`). Ordering and windows are applied by
 * `computeFunnel`, which decides ties by time and step, never by row id.
 */

import type { FunnelEventRow } from "../../metrics";
import type { Names } from "../schema";
import type { SqlClient } from "../sql";
import { QueryParams, elapsedDays, RANGE_END, RANGE_START, isoInstant, scopedEvents, type QueryScope } from "./context";

export async function fetchFunnelEvents(
  sql: SqlClient,
  names: Names,
  scope: QueryScope,
  funnel: { steps: readonly string[]; windowDays: number },
): Promise<FunnelEventRow[]> {
  const params = new QueryParams(scope);
  const steps = params.add(JSON.stringify([...new Set(funnel.steps)]));
  const window = params.add(funnel.windowDays);
  return sql.query<FunnelEventRow>(
    `with ${scopedEvents(
      names,
      `e.name in (select jsonb_array_elements_text(${steps}::text::jsonb))
        and e.occurred_at >= ${RANGE_START}
        and e.occurred_at <= ${RANGE_END} + ${elapsedDays(window)}`,
    )}
    select actor, name, ${isoInstant("occurred_at")} as occurred_at
    from scoped
    where actor is not null
    order by actor, scoped.occurred_at, name`,
    params.values,
  );
}
