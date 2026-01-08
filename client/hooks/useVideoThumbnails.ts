import { Platform } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";

export interface ThumbnailResult {
  uri: string;
  width: number;
  height: number;
  blob?: Blob;
}

/**
 * Extract a thumbnail frame from a video file.
 * - Native: Uses expo-video-thumbnails
 * - Web: Uses canvas-based extraction
 */
export async function extractVideoThumbnail(
  videoUri: string,
  timeMs: number = 1000
): Promise<ThumbnailResult | null> {
  if (Platform.OS === "web") {
    return extractThumbnailWeb(videoUri, timeMs);
  }
  return extractThumbnailNative(videoUri, timeMs);
}

/**
 * Native implementation using expo-video-thumbnails
 */
async function extractThumbnailNative(
  uri: string,
  timeMs: number
): Promise<ThumbnailResult | null> {
  try {
    const result = await VideoThumbnails.getThumbnailAsync(uri, {
      time: timeMs,
      quality: 0.8,
    });
    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.error("Native thumbnail extraction failed:", error);
    return null;
  }
}

/**
 * Web implementation using HTML5 video + canvas
 */
function extractThumbnailWeb(
  uri: string,
  timeMs: number
): Promise<ThumbnailResult | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.removeEventListener("loadeddata", handleLoaded);
      video.removeEventListener("error", handleError);
      video.src = "";
      video.load();
    };

    const handleLoaded = () => {
      // Seek to the desired time
      video.currentTime = timeMs / 1000;
    };

    const handleSeeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }

        ctx.drawImage(video, 0, 0);

        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) {
              resolve({
                uri: URL.createObjectURL(blob),
                width: canvas.width,
                height: canvas.height,
                blob,
              });
            } else {
              resolve(null);
            }
          },
          "image/jpeg",
          0.8
        );
      } catch (error) {
        console.error("Web thumbnail extraction failed:", error);
        cleanup();
        resolve(null);
      }
    };

    const handleError = () => {
      console.error("Video load error for thumbnail extraction");
      cleanup();
      resolve(null);
    };

    video.addEventListener("loadeddata", handleLoaded);
    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("error", handleError);

    // Set source and begin loading
    video.src = uri;
    video.load();

    // Timeout after 10 seconds
    setTimeout(() => {
      cleanup();
      resolve(null);
    }, 10000);
  });
}
