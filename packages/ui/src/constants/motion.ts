/**
 * Motion Duration Tokens
 *
 * Standard durations (ms) for `Animated.timing` transitions. Convention:
 * ease-out on enter (element appearing/growing), ease-in on exit
 * (element disappearing/shrinking). Pick the token closest to the intended
 * feel rather than hand-picking a duration inline.
 *
 * - instant: near-immediate feedback (e.g. checkmark/dot toggles)
 * - fast: small, frequent UI transitions (e.g. switches, accordions)
 * - normal: default entrance/exit transitions (e.g. drawers, dialogs, toasts)
 * - slow: larger or more deliberate transitions
 * - slower: pronounced, attention-getting transitions
 *
 * Deliberate outliers (e.g. skeleton/indeterminate pulse loops) are not
 * expected to use these tokens.
 */
export const durations = {
  instant: 75,
  fast: 150,
  normal: 200,
  slow: 300,
  slower: 500,
} as const;
