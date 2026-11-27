/**
 * The users upsert shared by ingest and `identify`.
 *
 * First touch wins: an acquisition field already set is never overwritten, a
 * null one is filled. `channel` is recomputed from the merged row on every
 * write, so a later fill (a self-reported answer arriving after a direct
 * visit) still moves the user out of the default channel.
 */
import { PLATFORMS } from "../shared/wire";
import { EMPTY_ACQUISITION, resolveChannel, type Acquisition } from "./acquisition";
import type { StoreContext } from "./config";
import type { SqlClient } from "./sql";
import { isPlainObject, jsonParam } from "./util";

export interface UserWrite {
  userId: string;
  /** Moves `last_seen_at` forward (activity). `identify` alone does not. */
  touch: boolean;
  /** Sets `first_seen_at` when earlier than the stored value (backfilled sign-up date). */
  createdAt?: Date | null;
  excluded?: boolean | null;
  /** Merged into the stored traits, key by key. */
  traits?: Record<string, unknown> | null;
  firstAnonymousId?: string | null;
  signupPlatform?: string | null;
  signupAppVersion?: string | null;
  acquisition?: Acquisition;
}

const ACQUISITION_COLUMNS = Object.keys(EMPTY_ACQUISITION) as (keyof Acquisition)[];

export const USER_ID_MAX_LENGTH = 256;

/** Host user ids are opaque text; this only rejects what cannot be one. */
export function validUserId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= USER_ID_MAX_LENGTH && !trimmed.includes("\u0000") ? trimmed : null;
}

export function validPlatform(value: unknown): string | null {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value) ? value : null;
}

export async function upsertUser(tx: SqlClient, ctx: StoreContext, write: UserWrite): Promise<void> {
  const acquisition = write.acquisition ?? EMPTY_ACQUISITION;
  const record = {
    ...acquisition,
    first_anonymous_id: write.firstAnonymousId ?? null,
    signup_platform: write.signupPlatform ?? null,
    signup_app_version: write.signupAppVersion ?? null,
    traits: isPlainObject(write.traits) ? write.traits : null,
  };
  const fill = (column: string) => `${column} = coalesce(u.${column}, excluded.${column})`;
  const now = ctx.now();

  const rows = await tx.query<{
    utm_source: string | null;
    self_reported_source: string | null;
    signup_platform: string | null;
    channel: string;
  }>(
    `insert into ${ctx.names.t.users} as u (
       app_id, user_id, first_seen_at, last_seen_at, excluded, traits, first_anonymous_id, signup_platform,
       signup_app_version, ${ACQUISITION_COLUMNS.join(", ")}, channel
     )
     select $1, $2, coalesce($3::timestamptz, $4::timestamptz), $4::timestamptz, coalesce($5::boolean, false), r.traits,
       r.first_anonymous_id, r.signup_platform, r.signup_app_version, ${ACQUISITION_COLUMNS.map((c) => `r.${c}`).join(", ")}, $7
     from jsonb_to_record($6::text::jsonb) as r(
       traits jsonb, first_anonymous_id text, signup_platform text, signup_app_version text,
       ${ACQUISITION_COLUMNS.map((c) => `${c} ${c === "link_click_id" ? "uuid" : "text"}`).join(", ")}
     )
     on conflict (app_id, user_id) do update set
       first_seen_at = least(u.first_seen_at, coalesce($3::timestamptz, u.first_seen_at)),
       last_seen_at = case when $8::boolean then greatest(u.last_seen_at, excluded.last_seen_at) else u.last_seen_at end,
       excluded = coalesce($5::boolean, u.excluded),
       traits = case when excluded.traits is null then u.traits else coalesce(u.traits, '{}'::jsonb) || excluded.traits end,
       ${["first_anonymous_id", "signup_platform", "signup_app_version", ...ACQUISITION_COLUMNS].map(fill).join(",\n       ")}
     returning utm_source, self_reported_source, signup_platform, channel`,
    [
      ctx.appId,
      write.userId,
      write.createdAt ?? null,
      now,
      write.excluded ?? null,
      jsonParam(record),
      resolveChannel({ ...acquisition, signup_platform: record.signup_platform }),
      write.touch,
    ],
  );

  const merged = rows[0];
  if (!merged) return;
  const channel = resolveChannel(merged);
  if (channel !== merged.channel) {
    await tx.query(`update ${ctx.names.t.users} set channel = $3 where app_id = $1 and user_id = $2`, [
      ctx.appId,
      write.userId,
      channel,
    ]);
  }
}
