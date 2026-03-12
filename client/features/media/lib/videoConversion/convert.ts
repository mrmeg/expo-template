/**
 * Web implementation of video conversion using FFmpeg.wasm
 *
 * Converts non-MP4 videos (WebM, AVI, MKV, etc.) to MP4 (H.264/AAC)
 * for cross-platform playback compatibility.
 *
 * Note: FFmpeg.wasm is ~30MB and loaded lazily on first use.
 *
 * IMPORTANT: This file loads FFmpeg via script injection instead of npm import
 * because @ffmpeg/ffmpeg uses import.meta.url which Metro doesn't support.
 */

import { logDev } from "@/client/devtools";
import {
  CONVERSION_PRESETS,
  DEFAULT_PRESET,
  FFMPEG_CDN_BASE_URL,
  FFMPEG_WORKER_URL,
} from "./config";
import { getFormatFromMimeType, TARGET_MIME_TYPE } from "./utils";
import type { VideoConversionOptions, VideoConversionResult } from "./types";

// ============================================================================
// FFmpeg type definitions (since we're not importing from npm package)
// ============================================================================

interface FFmpegProgress {
  progress: number;
  time: number;
}

interface FFmpegInstance {
  loaded: boolean;
  load: (config: {
    coreURL: string;
    wasmURL: string;
    workerURL?: string;
    classWorkerURL?: string; // Key fix: classWorkerURL goes here, not in constructor
  }) => Promise<void>;
  exec: (args: string[]) => Promise<number>;
  writeFile: (name: string, data: Uint8Array) => Promise<void>;
  readFile: (name: string) => Promise<Uint8Array | string>;
  deleteFile: (name: string) => Promise<void>;
  on: (event: string, callback: (data: FFmpegProgress) => void) => void;
  off: (event: string, callback: (data: FFmpegProgress) => void) => void;
}

interface FFmpegModule {
  FFmpeg: new () => FFmpegInstance;
}

// ============================================================================
// Script loading utilities
// ============================================================================

/**
 * Load a script from URL and return when loaded
 */
function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (document.querySelector(`script[src="${url}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(script);
  });
}

/**
 * Fetch a URL and create a blob URL from it
 */
async function toBlobURL(url: string, mimeType: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  const typedBlob = new Blob([blob], { type: mimeType });
  return URL.createObjectURL(typedBlob);
}

/**
 * Create a worker blob URL that uses importScripts to load the actual worker
 * This is the workaround from GitHub Issue #694 for cross-origin worker loading
 * @see https://github.com/ffmpegwasm/ffmpeg.wasm/issues/694
 */
function createWorkerBlobURL(workerURL: string): string {
  const workerScript = `importScripts("${workerURL}");`;
  const blob = new Blob([workerScript], { type: "text/javascript" });
  return URL.createObjectURL(blob);
}

/**
 * Fetch a file from URL and convert to Uint8Array
 */
async function fetchFile(input: string | Blob | File): Promise<Uint8Array> {
  if (input instanceof Blob) {
    const buffer = await input.arrayBuffer();
    return new Uint8Array(buffer);
  }

  if (typeof input === "string") {
    const response = await fetch(input);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  throw new Error("Unsupported input type for fetchFile");
}

// ============================================================================
// FFmpeg loading and conversion
// ============================================================================

// Singleton FFmpeg instance
let ffmpeg: FFmpegInstance | null = null;
let isLoading = false;
let loadPromise: Promise<FFmpegInstance> | null = null;

// FFmpeg UMD bundle URL (using jsdelivr for better CORS support)
const FFMPEG_MAIN_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js";

/**
 * Load FFmpeg.wasm (lazy, cached)
 * Only downloads the ~30MB core on first use
 */
async function loadFFmpeg(onLoadingFFmpeg?: () => void): Promise<FFmpegInstance> {
  // Return existing instance if already loaded
  if (ffmpeg?.loaded) {
    return ffmpeg;
  }

  // Wait for existing load operation
  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  onLoadingFFmpeg?.();

  loadPromise = (async () => {
    try {
      logDev("Loading FFmpeg.wasm...");

      // Load FFmpeg UMD bundle via script tag
      await loadScript(FFMPEG_MAIN_URL);

      // Access FFmpeg from global scope
      const FFmpegModule = (window as unknown as { FFmpegWASM: FFmpegModule }).FFmpegWASM;
      if (!FFmpegModule?.FFmpeg) {
        throw new Error("FFmpeg not found on window after script load");
      }

      // Create FFmpeg instance (no constructor options needed)
      ffmpeg = new FFmpegModule.FFmpeg();

      logDev("Loading FFmpeg core and WASM from CDN...");

      // Load FFmpeg core - use direct CDN URLs (worker handles CORS via import)
      // KEY FIX: classWorkerURL must be passed to load() as a blob URL
      // This overrides the default CDN worker path (see GitHub issue #694)
      await ffmpeg.load({
        coreURL: `${FFMPEG_CDN_BASE_URL}/ffmpeg-core.js`,
        wasmURL: `${FFMPEG_CDN_BASE_URL}/ffmpeg-core.wasm`,
        // Use blob URL for the bundled worker (self-contained, no relative imports)
        classWorkerURL: await toBlobURL(
          `${window.location.origin}${FFMPEG_WORKER_URL}`,
          "text/javascript"
        ),
      });

      logDev("FFmpeg.wasm loaded successfully");
      return ffmpeg;
    } catch (error) {
      ffmpeg = null;
      throw error;
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

/**
 * Convert a video to MP4 (H.264/AAC) format
 *
 * @param uri - Source video URI (blob URL or data URL)
 * @param originalMimeType - Original MIME type for format detection
 * @param options - Conversion options (preset, progress callback)
 * @returns Converted video result with blob and URI
 *
 * @example
 * ```ts
 * const result = await convertVideo(videoUri, 'video/webm', {
 *   preset: 'balanced',
 *   onProgress: (p) => console.log(`${p}% complete`),
 * });
 * ```
 */
export async function convertVideo(
  uri: string,
  originalMimeType: string,
  options: VideoConversionOptions = {}
): Promise<VideoConversionResult> {
  const { preset = DEFAULT_PRESET, onProgress, onLoadingFFmpeg } = options;
  const config = CONVERSION_PRESETS[preset];
  const originalFormat = getFormatFromMimeType(originalMimeType);

  logDev(`Converting ${originalFormat} to MP4 (preset: ${preset})`);

  // Load FFmpeg (lazy)
  const ff = await loadFFmpeg(onLoadingFFmpeg);

  // Set up progress tracking
  const progressHandler = ({ progress }: FFmpegProgress) => {
    const percent = Math.round(progress * 100);
    onProgress?.(percent);
  };
  ff.on("progress", progressHandler);

  try {
    // Fetch input video and write to FFmpeg virtual filesystem
    const inputData = await fetchFile(uri);
    const inputFilename = `input.${originalFormat}`;
    await ff.writeFile(inputFilename, inputData);

    logDev(`Input file written: ${inputFilename} (${inputData.length} bytes)`);

    // Build FFmpeg command
    const ffmpegArgs = [
      "-i",
      inputFilename,
      // Video codec: H.264
      "-c:v",
      "libx264",
      // Audio codec: AAC
      "-c:a",
      "aac",
      // Preset (speed/quality tradeoff)
      "-preset",
      config.ffmpegPreset,
      // Constant Rate Factor (quality)
      "-crf",
      config.crf.toString(),
      // Enable fast start for web streaming (moov atom at beginning)
      "-movflags",
      "+faststart",
      // Pixel format for compatibility
      "-pix_fmt",
      "yuv420p",
      // Output file
      "output.mp4",
    ];

    logDev(`Running FFmpeg: ${ffmpegArgs.join(" ")}`);

    // Execute conversion
    await ff.exec(ffmpegArgs);

    // Read output file
    const outputData = await ff.readFile("output.mp4");
    // Create a new Uint8Array to ensure compatibility with Blob constructor
    const uint8Array =
      outputData instanceof Uint8Array
        ? new Uint8Array(outputData)
        : new TextEncoder().encode(outputData as string);
    const blob = new Blob([uint8Array], { type: TARGET_MIME_TYPE });
    const outputUri = URL.createObjectURL(blob);

    logDev(
      `Conversion complete: ${originalFormat} -> MP4 (${(blob.size / 1024 / 1024).toFixed(2)}MB)`
    );

    // Cleanup virtual filesystem
    await ff.deleteFile(inputFilename);
    await ff.deleteFile("output.mp4");

    return {
      uri: outputUri,
      blob,
      size: blob.size,
      mimeType: TARGET_MIME_TYPE,
      originalFormat,
      converted: true,
    };
  } finally {
    // Remove progress handler
    ff.off("progress", progressHandler);
  }
}

/**
 * Check if FFmpeg is already loaded
 */
export function isFFmpegLoaded(): boolean {
  return ffmpeg?.loaded ?? false;
}

/**
 * Preload FFmpeg.wasm without converting
 * Useful for preloading while user is selecting a video
 */
export async function preloadFFmpeg(): Promise<void> {
  await loadFFmpeg();
}
