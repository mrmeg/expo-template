import type { ImageManipulatorContext, SaveFormat } from "expo-image-manipulator";
import type { VideoPlayer, VideoThumbnail } from "expo-video";

export interface NativeThumbnailDependencies {
  createVideoPlayer(uri: string): VideoPlayer;
  manipulate(thumbnail: VideoThumbnail): ImageManipulatorContext;
  jpegFormat: SaveFormat;
}

/** Longest wait for the player to load the asset before giving up on a thumbnail. */
export const PLAYER_READY_TIMEOUT_MS = 10_000;

/**
 * Resolve once `player` has loaded its source, or reject on its error or the
 * timeout. iOS returns no frames from `generateThumbnailsAsync` while the
 * player is still `idle`/`loading` (it resolves to `[]`), which is the state
 * `createVideoPlayer` hands back, so a thumbnail must wait for `readyToPlay`.
 */
function waitUntilReady(player: VideoPlayer, timeoutMs: number): Promise<void> {
  if (player.status === "readyToPlay") return Promise.resolve();
  if (player.status === "error") return Promise.reject(new Error("The video could not be loaded."));

  return new Promise((resolve, reject) => {
    let subscription: { remove(): void } | undefined;
    const timer = setTimeout(() => {
      subscription?.remove();
      reject(new Error(`The video did not load within ${timeoutMs} ms.`));
    }, timeoutMs);
    subscription = player.addListener("statusChange", ({ status, error }) => {
      if (status !== "readyToPlay" && status !== "error") return;
      clearTimeout(timer);
      subscription?.remove();
      if (status === "readyToPlay") resolve();
      else reject(new Error(error?.message ?? "The video could not be loaded."));
    });
  });
}

export async function extractVideoThumbnailNative(
  uri: string,
  timeMs: number,
  dependencies: NativeThumbnailDependencies,
  readyTimeoutMs = PLAYER_READY_TIMEOUT_MS,
) {
  const player = dependencies.createVideoPlayer(uri);
  try {
    await waitUntilReady(player, readyTimeoutMs);
    // A clip shorter than `timeMs` has no frame there; fall back to the first.
    let thumbnails = await player.generateThumbnailsAsync(timeMs / 1000);
    if (thumbnails.length === 0 && timeMs > 0) thumbnails = await player.generateThumbnailsAsync(0);
    const thumbnail = thumbnails[0];
    if (!thumbnail) throw new Error("The player returned no frame.");

    try {
      const context = dependencies.manipulate(thumbnail);
      try {
        const image = await context.renderAsync();
        try {
          const result = await image.saveAsync({
            compress: 0.8,
            format: dependencies.jpegFormat,
          });

          return {
            uri: result.uri,
            width: result.width,
            height: result.height,
          };
        } finally {
          image.release();
        }
      } finally {
        context.release();
      }
    } finally {
      thumbnail.release();
    }
  } finally {
    player.release();
  }
}
