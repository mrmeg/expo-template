/**
 * The video / thumbnail pairing convention, as pure functions.
 *
 * A video stored as `videos/<ID>.mov` keeps its thumbnail at
 * `thumbnails/<ID>.jpg`: the same ID under another prefix. Nothing links the two
 * objects in storage, so every place that lists, uploads, or deletes them has to
 * agree on this mapping; this module is that agreement. It has no React Native,
 * Expo, or storage imports, so it runs in Node, in a Worker, and in the app.
 *
 * The thumbnail upload names its file with `customFilename`, which the server
 * sanitizes. An ID outside `[A-Za-z0-9_-]` (the ULIDs the server mints are inside
 * it) can come back with a different base name and then no longer pairs.
 */

import { normalizeMediaPrefix } from "./config";
import { joinMediaKey } from "./keys";

export interface VideoThumbnailPairing {
  /** Storage prefix thumbnails live under, e.g. "thumbnails" (normalized like other prefixes). */
  thumbnailPrefix: string;
  /** Thumbnail file extension. @default "jpg" */
  extension?: string;
}

export const DEFAULT_VIDEO_THUMBNAIL_EXTENSION = "jpg";

/** Basename without extension: "videos/01ABC.mov" -> "01ABC". */
export function mediaKeyId(key: string): string {
  const name = key.split("/").pop() || "";
  return name.replace(/\.[^.]+$/, "");
}

function thumbnailExtension(pairing: VideoThumbnailPairing): string {
  return (pairing.extension ?? DEFAULT_VIDEO_THUMBNAIL_EXTENSION).replace(/^\.+/, "");
}

/** "videos/01ABC.mov" -> "thumbnails/01ABC.jpg". */
export function videoThumbnailKey(videoKey: string, pairing: VideoThumbnailPairing): string {
  return joinMediaKey(
    pairing.thumbnailPrefix,
    `${mediaKeyId(videoKey)}.${thumbnailExtension(pairing)}`,
  );
}

/** True when `key` sits directly under the pairing's thumbnail prefix with its extension. */
export function isVideoThumbnailKey(key: string, pairing: VideoThumbnailPairing): boolean {
  const prefix = `${normalizeMediaPrefix(pairing.thumbnailPrefix)}/`;
  if (!key.startsWith(prefix)) return false;

  const name = key.slice(prefix.length);
  const suffix = `.${thumbnailExtension(pairing)}`;
  return name.length > suffix.length && !name.includes("/") && name.endsWith(suffix);
}

export interface PairedVideo<T extends { key: string }> {
  video: T;
  /** Where its thumbnail is (or would be) stored. */
  thumbnailKey: string;
  /** The listed thumbnail, when one exists. */
  thumbnail?: T;
}

/**
 * Join listed videos to listed thumbnails by ID, preserving video order.
 *
 * A thumbnail pairs when its key is exactly the video's `videoThumbnailKey`, so
 * a `.png` beside a pairing that expects `.jpg` is not a match. Videos that share
 * an ID (`a.mov`, `a.mp4`) share its thumbnail. `orphanThumbnails` are the listed
 * thumbnails no listed video claims, in their listed order.
 *
 * Both inputs are what a list call returned, so a truncated page can show a
 * thumbnail as an orphan whose video is on the next one. Do not delete orphans
 * unless both lists were read in full.
 */
export function pairVideoThumbnails<T extends { key: string }>(
  videos: readonly T[],
  thumbnails: readonly T[],
  pairing: VideoThumbnailPairing,
): { videos: PairedVideo<T>[]; orphanThumbnails: T[] } {
  const thumbnailsByKey = new Map<string, T>();
  for (const thumbnail of thumbnails) {
    if (!thumbnailsByKey.has(thumbnail.key)) thumbnailsByKey.set(thumbnail.key, thumbnail);
  }

  const claimed = new Set<string>();
  const paired = videos.map((video): PairedVideo<T> => {
    const thumbnailKey = videoThumbnailKey(video.key, pairing);
    const thumbnail = thumbnailsByKey.get(thumbnailKey);
    if (!thumbnail) return { video, thumbnailKey };
    claimed.add(thumbnailKey);
    return { video, thumbnailKey, thumbnail };
  });

  return {
    videos: paired,
    orphanThumbnails: thumbnails.filter((thumbnail) => !claimed.has(thumbnail.key)),
  };
}

/**
 * Delete-payload helper: `keys` plus each video key's thumbnail key, deduped,
 * order kept. The requested keys come first in their own order, then the
 * thumbnail keys in the order their videos appeared; a key already present is
 * not repeated.
 */
export function withVideoThumbnailKeys(
  keys: readonly string[],
  options: { pairing: VideoThumbnailPairing; isVideoKey: (key: string) => boolean },
): string[] {
  const result = new Set<string>(keys);
  for (const key of keys) {
    if (options.isVideoKey(key)) result.add(videoThumbnailKey(key, options.pairing));
  }
  return [...result];
}

/**
 * A `createMediaHandlers({ deleteCompanions })` value for the pairing: deleting a
 * video key also deletes its thumbnail, so a client that sends only the video
 * leaves no orphan behind. Non-video keys have no companions.
 */
export function videoThumbnailDeleteCompanions(options: {
  pairing: VideoThumbnailPairing;
  isVideoKey: (key: string) => boolean;
}): (key: string) => string[] {
  return (key) =>
    options.isVideoKey(key) ? [videoThumbnailKey(key, options.pairing)] : [];
}
