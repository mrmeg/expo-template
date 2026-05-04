/**
 * Types for client-side video conversion using FFmpeg.wasm
 */

export interface VideoConversionResult {
  /** URI to the converted video (blob URL on web) */
  uri: string;
  /** Blob of converted video (web only) */
  blob?: Blob;
  /** Size of converted video in bytes */
  size: number;
  /** Duration in seconds (if available) */
  duration?: number;
  /** MIME type of output (video/mp4) */
  mimeType: string;
  /** Original format before conversion */
  originalFormat: string;
  /** Whether conversion was performed */
  converted: boolean;
}

export interface VideoConversionOptions {
  /** Quality preset affecting speed/quality tradeoff */
  preset?: VideoConversionPreset;
  /** Progress callback (0-100) */
  onProgress?: (progress: number) => void;
  /** Callback when FFmpeg is loading (first use only) */
  onLoadingFFmpeg?: () => void;
}

export type VideoConversionPreset = "fast" | "balanced" | "quality";

export interface VideoConversionConfig {
  /** FFmpeg preset flag */
  ffmpegPreset: string;
  /** Constant Rate Factor (lower = better quality, larger file) */
  crf: number;
  /** Description for UI */
  description: string;
}
