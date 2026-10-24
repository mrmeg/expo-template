/**
 * Playback time formatting for media controls. Pure, with no media-module
 * imports (this ships in the `lib` barrel).
 */
import { translateText } from "./i18n";

const PLACEHOLDER = "--:--";

const pad = (value: number) => (value < 10 ? `0${value}` : String(value));

/**
 * Playback time as `m:ss`, or `h:mm:ss` once the value or the reference is an
 * hour or more. Pass the total as `referenceDuration` when printing the
 * elapsed time next to it, so both readouts have the same shape and width
 * (`0:42 / 1:05:10` would otherwise jump from `59:59` to `1:00:00`).
 *
 * Fractional seconds are floored, so `59.9` reads `0:59`, the way players
 * count. A negative or `NaN` value is unknown time and reads `--:--`;
 * `Infinity` is a live stream and reads "Live" (`media.live`). A reference
 * that is not a finite number is ignored.
 *
 * ```ts
 * formatMediaTime(62); // "1:02"
 * formatMediaTime(62, 3725); // "0:01:02"
 * formatMediaTime(Number.NaN); // "--:--"
 * ```
 */
export function formatMediaTime(seconds: number, referenceDuration?: number): string {
  if (seconds === Number.POSITIVE_INFINITY) return translateText("media.live", "Live") ?? "Live";
  if (typeof seconds !== "number" || Number.isNaN(seconds) || seconds < 0) return PLACEHOLDER;

  const total = Math.floor(seconds);
  const reference =
    typeof referenceDuration === "number" && Number.isFinite(referenceDuration) && referenceDuration > 0
      ? Math.floor(referenceDuration)
      : 0;

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (total >= 3600 || reference >= 3600) return `${hours}:${pad(minutes)}:${pad(secs)}`;
  return `${Math.floor(total / 60)}:${pad(secs)}`;
}

/** One spoken unit: "1 minute", "2 seconds". Singular and plural are separate keys so a translation can inflect. */
function unit(count: number, singularKey: string, singular: string, pluralKey: string, plural: string) {
  const word = count === 1 ? translateText(singularKey, singular) : translateText(pluralKey, plural);
  return `${count} ${word ?? (count === 1 ? singular : plural)}`;
}

/** A duration in words: "1 hour 2 minutes 3 seconds". Zero units are left out, except a lone "0 seconds". */
function spokenDuration(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(unit(hours, "media.hour", "hour", "media.hours", "hours"));
  if (minutes > 0) parts.push(unit(minutes, "media.minute", "minute", "media.minutes", "minutes"));
  if (secs > 0 || parts.length === 0) {
    parts.push(unit(secs, "media.second", "second", "media.seconds", "seconds"));
  }
  return parts.join(" ");
}

/**
 * Playback position as words for `accessibilityValue.text`, because a screen
 * reader reads `1:02` as a clock time or a ratio:
 * `"1 minute 2 seconds of 3 minutes 45 seconds"`.
 *
 * Zero units are left out (`"1 minute of 3 minutes"`), and a position of zero
 * is `"0 seconds"`. A negative or non-finite `current` counts as zero. When
 * `duration` is `Infinity` (a live stream) the result is just "Live"
 * (`media.live`); when it is unknown (`NaN`, zero, negative) only the position
 * is spoken. Words go through `translateText` under `media.hour(s)`,
 * `media.minute(s)`, `media.second(s)` and `media.of`.
 */
export function mediaTimeA11y(current: number, duration: number): string {
  if (duration === Number.POSITIVE_INFINITY) return translateText("media.live", "Live") ?? "Live";

  const position = spokenDuration(current);
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) return position;

  const of = translateText("media.of", "of") ?? "of";
  return `${position} ${of} ${spokenDuration(duration)}`;
}
