/**
 * Fetchers for product use: activity days, new users, sign-up cohorts by
 * channel, and the cohort members and activity retention reads. Each applies
 * the population filter and identity stitching in SQL and returns plain rows
 * for the pure functions in `../../metrics`.
 */

import {
  INACTIVE_EVENTS,
  addDays,
  PAID_EVENT_TYPES,
  type ActivityRow,
  type ChannelCohortRow,
  type CohortMember,
  type DailyCount,
  type DateRange,
  type UserActivityRow,
} from "../../metrics";
import type { Names } from "../schema";
import type { SqlClient } from "../sql";
import {
  QueryParams,
  RANGE_END,
  activeEventsFilter,
  dayOf,
  dayStart,
  inRange,
  scopedEvents,
  type QueryScope,
} from "./context";

/**
 * Distinct `(actor, day, signed_in)` for activity events in the scope's range.
 * `signed_in` marks rows from events that carried a `user_id`.
 */
export async function fetchActivityRows(
  sql: SqlClient,
  names: Names,
  scope: QueryScope,
  activeEvents: readonly string[] | null,
): Promise<ActivityRow[]> {
  const params = new QueryParams(scope);
  const filter = activeEventsFilter(params, activeEvents, INACTIVE_EVENTS);
  return sql.query<ActivityRow>(
    `with ${scopedEvents(names, `${inRange("e.occurred_at")} and ${filter}`)}
    select distinct actor, ${dayOf("occurred_at")} as day, (user_id is not null) as signed_in
    from scoped
    where actor is not null`,
    params.values,
  );
}

/** Users first seen on each day of the range (only days with any). */
export async function fetchNewUsersByDay(sql: SqlClient, names: Names, scope: QueryScope): Promise<DailyCount[]> {
  const params = new QueryParams(scope);
  return sql.query<DailyCount>(
    `select ${dayOf("u.first_seen_at")} as date, count(*)::int as count
    from ${names.t.users} u
    where u.app_id = $1 and not u.excluded and ${inRange("u.first_seen_at")}
    group by 1
    order by 1`,
    params.values,
  );
}

/** Users first seen in the range, with the day they were first seen. */
export async function fetchCohortMembers(sql: SqlClient, names: Names, scope: QueryScope): Promise<CohortMember[]> {
  const params = new QueryParams(scope);
  return sql.query<CohortMember>(
    `select u.user_id, ${dayOf("u.first_seen_at")} as first_day
    from ${names.t.users} u
    where u.app_id = $1 and not u.excluded and ${inRange("u.first_seen_at")}`,
    params.values,
  );
}

/**
 * Distinct `(user, day)` for activity events in the scope's range, for users
 * first seen in `cohort`. An anonymous event counts for the user its device is
 * stitched to.
 */
export async function fetchCohortActivity(
  sql: SqlClient,
  names: Names,
  scope: QueryScope,
  cohort: DateRange,
  activeEvents: readonly string[] | null,
): Promise<UserActivityRow[]> {
  const params = new QueryParams(scope);
  const cohortStart = dayStart(params.add(cohort.from));
  const cohortEnd = dayStart(params.add(addDays(cohort.to, 1)));
  const filter = activeEventsFilter(params, activeEvents, INACTIVE_EVENTS);
  return sql.query<UserActivityRow>(
    `with cohort as (
      select u.user_id from ${names.t.users} u
      where u.app_id = $1 and not u.excluded and u.first_seen_at >= ${cohortStart} and u.first_seen_at < ${cohortEnd}
    ),
    ${scopedEvents(names, `${inRange("e.occurred_at")} and ${filter}`)}
    select distinct s.person_id as user_id, ${dayOf("s.occurred_at")} as day
    from scoped s
    join cohort c on c.user_id = s.person_id`,
    params.values,
  );
}

export interface ChannelCohortOptions {
  now: Date;
  activation: { event: string; withinDays: number } | null;
}

/**
 * Users first seen in the range, by `users.channel`, with what they went on to
 * do:
 * - `activated`: the activation event (theirs, or from a device stitched to
 *   them) no later than `withinDays` after first seen. An event before sign-up
 *   on a stitched device counts.
 * - `pending`: not activated and `first_seen_at + withinDays` is after `now`.
 * - `trial_started` and `paid`: a production `trial_started`, or paid
 *   (`purchased`, `trial_converted`, `renewed`), ledger row for the user at any
 *   time up to `now`.
 * `activated` and `pending` are 0 when activation is not configured.
 */
export async function fetchChannelCohorts(
  sql: SqlClient,
  names: Names,
  scope: QueryScope,
  options: ChannelCohortOptions,
): Promise<ChannelCohortRow[]> {
  const params = new QueryParams(scope);
  const now = `${params.add(options.now)}::timestamptz`;
  const paidTypes = `(select jsonb_array_elements_text(${params.add(JSON.stringify(PAID_EVENT_TYPES))}::text::jsonb))`;
  const activation = options.activation;

  let activationCtes = "";
  let activationColumns = "0 as activated, 0 as pending";
  let activationJoin = "";
  if (activation) {
    const event = `${params.add(activation.event)}::text`;
    const window = `make_interval(days => ${params.add(activation.withinDays)}::int)`;
    activationCtes = `,
    act_events as (
      select e.id, e.user_id, e.anonymous_id, e.occurred_at
      from ${names.t.events} e
      where e.app_id = $1 and e.name = ${event}
        and e.occurred_at < ${RANGE_END} + ${window} and e.occurred_at <= ${now}
        and (e.user_id is null or e.user_id in (select user_id from cohort))
    ),
    act_stitch as (
      select distinct on (s.anonymous_id) s.anonymous_id, s.user_id
      from ${names.t.events} s
      where s.app_id = $1 and s.user_id is not null
        and s.anonymous_id in (select a.anonymous_id from act_events a where a.user_id is null and a.anonymous_id is not null)
      order by s.anonymous_id, s.occurred_at, s.id
    ),
    act as (
      select coalesce(a.user_id, st.user_id) as user_id, min(a.occurred_at) as first_at
      from act_events a
      left join act_stitch st on a.user_id is null and st.anonymous_id = a.anonymous_id
      where coalesce(a.user_id, st.user_id) is not null
      group by 1
    )`;
    activationColumns = `count(*) filter (where act.first_at <= c.first_seen_at + ${window})::int as activated,
      count(*) filter (
        where (act.first_at is null or act.first_at > c.first_seen_at + ${window})
          and c.first_seen_at + ${window} > ${now}
      )::int as pending`;
    activationJoin = "left join act on act.user_id = c.user_id";
  }

  return sql.query<ChannelCohortRow>(
    `with cohort as (
      select u.user_id, u.channel, u.first_seen_at
      from ${names.t.users} u
      where u.app_id = $1 and not u.excluded and ${inRange("u.first_seen_at")}
    ),
    rev as (
      select r.user_id,
        bool_or(r.event_type = 'trial_started') as trial,
        bool_or(r.event_type in ${paidTypes}) as paid
      from ${names.t.revenueEvents} r
      join cohort c on c.user_id = r.user_id
      where r.app_id = $1 and r.environment = 'production' and r.occurred_at <= ${now}
      group by r.user_id
    )${activationCtes}
    select c.channel,
      count(*)::int as signups,
      ${activationColumns},
      count(*) filter (where rev.trial)::int as trial_started,
      count(*) filter (where rev.paid)::int as paid
    from cohort c
    left join rev on rev.user_id = c.user_id
    ${activationJoin}
    group by c.channel`,
    params.values,
  );
}

/** Sign-ups in the range by `signup_platform` ("unknown" when null). */
export async function fetchSignupsByPlatform(sql: SqlClient, names: Names, scope: QueryScope): Promise<{ key: string; count: number }[]> {
  const params = new QueryParams(scope);
  return sql.query(
    `select coalesce(u.signup_platform, 'unknown') as key, count(*)::int as count
    from ${names.t.users} u
    where u.app_id = $1 and not u.excluded and ${inRange("u.first_seen_at")}
    group by 1`,
    params.values,
  );
}

/** Link clicks in the range by channel. Clicks are anonymous, so no population filter applies. */
export async function fetchLinkClicksByChannel(sql: SqlClient, names: Names, scope: QueryScope): Promise<{ key: string; count: number }[]> {
  const params = new QueryParams(scope);
  return sql.query(
    `select l.channel as key, count(*)::int as count
    from ${names.t.linkClicks} l
    where l.app_id = $1 and ${inRange("l.occurred_at")}
    group by 1`,
    params.values,
  );
}
