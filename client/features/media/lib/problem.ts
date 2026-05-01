/**
 * Typed problem mapping for media API responses.
 *
 * Mirrors the existing `BillingProblem` pattern in `client/features/billing`
 * — hooks throw a `MediaError` carrying a structured `MediaProblem` so UI
 * code can branch on `kind` (`disabled` for the unconfigured-template
 * case, `bad-request` for client validation errors, `unknown` for
 * everything else) without reading HTTP status codes.
 */

export type MediaProblem =
  | { kind: "disabled"; missing?: string[] }
  | { kind: "bad-request"; message: string }
  | { kind: "unauthorized" }
  | { kind: "unknown"; status: number; message: string };

export class MediaError extends Error {
  readonly problem: MediaProblem;

  constructor(problem: MediaProblem) {
    super(messageFor(problem));
    this.name = "MediaError";
    this.problem = problem;
  }
}

function messageFor(problem: MediaProblem): string {
  switch (problem.kind) {
  case "disabled":
    return "Media storage is not configured.";
  case "bad-request":
    return problem.message;
  case "unauthorized":
    return "Sign in to access media.";
  case "unknown":
    return problem.message;
  }
}

/**
 * Convert a non-OK Response into a typed MediaError.
 *
 * Reads the response body once, defensively. Used by every media hook
 * after a `!response.ok` check.
 */
export async function toMediaError(response: Response): Promise<MediaError> {
  const body = await response.json().catch(() => ({} as Record<string, unknown>));

  if (response.status === 503 && body && body.code === "media-disabled") {
    const missing = Array.isArray((body as { missing?: unknown }).missing)
      ? ((body as { missing: unknown[] }).missing.filter(
        (m): m is string => typeof m === "string",
      ))
      : undefined;
    return new MediaError({ kind: "disabled", missing });
  }

  if (response.status === 401) {
    return new MediaError({ kind: "unauthorized" });
  }

  if (response.status === 400) {
    return new MediaError({
      kind: "bad-request",
      message: typeof body.message === "string" ? body.message : "Invalid request",
    });
  }

  return new MediaError({
    kind: "unknown",
    status: response.status,
    message:
      typeof body.message === "string"
        ? body.message
        : `Request failed (${response.status})`,
  });
}

/**
 * Predicate — narrows an unknown error into a MediaError. Useful in
 * React Query `onError` callbacks and UI branches.
 */
export function isMediaError(error: unknown): error is MediaError {
  return error instanceof MediaError;
}

/**
 * React Query `retry` callback — never retry a disabled or bad-request
 * problem; the caller can't fix either by waiting.
 */
export function shouldRetryMediaError(failureCount: number, error: unknown): boolean {
  if (isMediaError(error)) {
    if (error.problem.kind === "disabled") return false;
    if (error.problem.kind === "bad-request") return false;
    if (error.problem.kind === "unauthorized") return false;
  }
  return failureCount < 2;
}
