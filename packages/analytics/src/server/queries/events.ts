/**
 * Raw events, newest first, keyset-paginated on `(occurred_at, id)`.
 *
 * The population filter here works from the excluded side instead of
 * stitching every event: excluded users are few, so the query finds the
 * anonymous ids stitched to them (same rule: the user on the earliest event
 * that carries both) and filters while it walks the time index, stopping at
 * the page size.
 */

import type { EventRow } from "../../metrics";
import type { Names } from "../schema";
import type { SqlClient } from "../sql";
import { QueryParams, inRange, isoInstant, type QueryScope } from "./context";

export interface EventCursor {
  /** ISO 8601 UTC with microseconds, as `isoInstant` writes it. */
  occurredAt: string;
  id: string;
}

export interface EventListFilter {
  name?: string;
  userId?: string;
  before?: EventCursor;
  limit: number;
}

export async function fetchEvents(sql: SqlClient, names: Names, scope: QueryScope, filter: EventListFilter): Promise<EventRow[]> {
  const params = new QueryParams(scope);
  const conditions = [`e.app_id = $1`, inRange("e.occurred_at")];
  if (filter.name !== undefined) conditions.push(`e.name = ${params.add(filter.name)}::text`);
  if (filter.userId !== undefined) conditions.push(`e.user_id = ${params.add(filter.userId)}::text`);
  if (filter.before) {
    conditions.push(
      `(e.occurred_at, e.id) < (${params.add(filter.before.occurredAt)}::timestamptz, ${params.add(filter.before.id)}::uuid)`,
    );
  }
  const limit = params.add(filter.limit);
  return sql.query<EventRow>(
    `with excluded_users as (
      select x.user_id from ${names.t.users} x where x.app_id = $1 and x.excluded
    ),
    excluded_devices as (
      select t.anonymous_id from (
        select distinct on (s.anonymous_id) s.anonymous_id, s.user_id
        from ${names.t.events} s
        where s.app_id = $1 and s.user_id is not null
          and s.anonymous_id in (
            select d.anonymous_id from ${names.t.events} d
            where d.app_id = $1 and d.anonymous_id is not null and d.user_id in (select user_id from excluded_users)
          )
        order by s.anonymous_id, s.occurred_at, s.id
      ) t
      where t.user_id in (select user_id from excluded_users)
    )
    select e.id::text as id, e.name,
      ${isoInstant("e.occurred_at")} as occurred_at,
      ${isoInstant("e.received_at")} as received_at,
      e.user_id, e.anonymous_id, e.session_id, e.platform, e.app_version, e.path, e.properties
    from ${names.t.events} e
    where ${conditions.join(" and ")}
      and not exists (select 1 from excluded_users x where x.user_id = e.user_id)
      and (e.user_id is not null or not exists (select 1 from excluded_devices d where d.anonymous_id = e.anonymous_id))
    order by e.occurred_at desc, e.id desc
    limit ${limit}::int`,
    params.values,
  );
}
