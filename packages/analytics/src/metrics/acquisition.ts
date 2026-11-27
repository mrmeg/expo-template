/**
 * Acquisition: sign-ups by `users.channel` and by `signup_platform`, link
 * clicks by channel, and a per-channel funnel.
 *
 * The funnel is cohort-based: of the users who signed up (were first seen) in
 * the range through a channel, how many activated (when activation is
 * configured), started a trial, and paid, the last two from the revenue ledger
 * joined on `user_id` at any time up to now. Link clicks are the channel's
 * clicks in the range; they are anonymous, so they sit beside the cohort
 * rather than inside it.
 */

import { sortCounts } from "./revenue";
import type { ChannelCohortRow, ChannelFunnelRow, CountByKey } from "./types";

export interface ChannelFunnelInput {
  cohorts: ChannelCohortRow[];
  linkClicks: CountByKey[];
  activationConfigured: boolean;
}

/** One row per channel with sign-ups or clicks, by sign-ups, then paid, then clicks, then name. */
export function computeChannelFunnel(input: ChannelFunnelInput): ChannelFunnelRow[] {
  const rows = new Map<string, ChannelFunnelRow>();
  const row = (channel: string): ChannelFunnelRow => {
    let existing = rows.get(channel);
    if (!existing) {
      existing = {
        channel,
        link_clicks: 0,
        signups: 0,
        activated: input.activationConfigured ? 0 : null,
        trial_started: 0,
        paid: 0,
      };
      rows.set(channel, existing);
    }
    return existing;
  };
  for (const cohort of input.cohorts) {
    const target = row(cohort.channel);
    target.signups += cohort.signups;
    if (target.activated !== null) target.activated += cohort.activated;
    target.trial_started += cohort.trial_started;
    target.paid += cohort.paid;
  }
  for (const click of input.linkClicks) row(click.key).link_clicks += click.count;
  return [...rows.values()].sort(
    (a, b) =>
      b.signups - a.signups ||
      b.paid - a.paid ||
      b.link_clicks - a.link_clicks ||
      a.channel.localeCompare(b.channel),
  );
}

/** Sign-ups per channel from the cohort rows, largest first. */
export function signupsByChannel(cohorts: ChannelCohortRow[]): CountByKey[] {
  const counts = new Map<string, number>();
  for (const cohort of cohorts) counts.set(cohort.channel, (counts.get(cohort.channel) ?? 0) + cohort.signups);
  return sortCounts([...counts].map(([key, count]) => ({ key, count })).filter((c) => c.count > 0));
}
