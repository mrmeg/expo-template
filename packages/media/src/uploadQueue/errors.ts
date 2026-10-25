import { isMediaError } from "../errors";
import { isMediaProcessingError } from "../processing/errors";

/** Which half of an item's life a failure came from. */
export type UploadQueueStage = "resolving" | "processing" | "uploading";

const FALLBACKS: Record<UploadQueueStage, string> = {
  resolving: "This file could not be prepared.",
  processing: "This file could not be processed.",
  uploading: "Upload failed. Try again.",
};

/**
 * A short message safe to show against one file. Typed errors get specific text;
 * anything else gets a generic line for its stage, since a raw `fetch` or native
 * error message is not written for users. The raw error stays on the item.
 */
export function describeUploadQueueError(error: unknown, stage: UploadQueueStage): string {
  if (isMediaProcessingError(error)) {
    switch (error.code) {
    case "unsupported-format":
      return error.message || "This file type cannot be uploaded.";
    case "heic-conversion-failed":
      return "This photo could not be converted.";
    case "decode-failed":
      return "This image could not be read.";
    case "encode-failed":
      return "This image could not be optimized.";
    case "stat-failed":
      return "This file could not be read.";
    }
  }

  if (isMediaError(error)) {
    const { problem } = error;
    switch (problem.kind) {
    case "disabled":
      return "Media storage is not configured.";
    case "unauthorized":
      return "Sign in to upload.";
    case "forbidden":
      return problem.message || "You can't upload this file.";
    case "bad-request":
      if (problem.code === "oversized-file") return "This file is too large.";
      if (problem.code === "invalid-content-type") return "This file type is not accepted.";
      return problem.message || FALLBACKS[stage];
    case "unknown":
      return FALLBACKS[stage];
    }
  }

  return FALLBACKS[stage];
}
