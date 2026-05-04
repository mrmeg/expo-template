export type MediaProblem =
  | { kind: "disabled"; missing?: string[]; details?: string[] }
  | { kind: "bad-request"; code?: string; message: string }
  | { kind: "unauthorized" }
  | { kind: "forbidden"; message: string }
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
  case "forbidden":
    return problem.message;
  case "unknown":
    return problem.message;
  }
}

export async function toMediaError(response: Response): Promise<MediaError> {
  const body = await response.json().catch(() => ({} as Record<string, unknown>));
  const code = typeof body.code === "string" ? body.code : undefined;
  const message =
    typeof body.message === "string"
      ? body.message
      : `Request failed (${response.status})`;

  if (response.status === 503 && code === "media-disabled") {
    return new MediaError({
      kind: "disabled",
      missing: Array.isArray(body.missing)
        ? body.missing.filter((item): item is string => typeof item === "string")
        : undefined,
      details: Array.isArray(body.details)
        ? body.details.filter((item): item is string => typeof item === "string")
        : undefined,
    });
  }

  if (response.status === 401) return new MediaError({ kind: "unauthorized" });
  if (response.status === 403) return new MediaError({ kind: "forbidden", message });
  if (response.status >= 400 && response.status < 500) {
    return new MediaError({
      kind: "bad-request",
      ...(code ? { code } : {}),
      message,
    });
  }

  return new MediaError({ kind: "unknown", status: response.status, message });
}

export function isMediaError(error: unknown): error is MediaError {
  return error instanceof MediaError;
}

export function shouldRetryMediaError(
  failureCount: number,
  error: unknown,
): boolean {
  if (isMediaError(error)) {
    if (
      error.problem.kind === "disabled" ||
      error.problem.kind === "bad-request" ||
      error.problem.kind === "unauthorized" ||
      error.problem.kind === "forbidden"
    ) {
      return false;
    }
  }

  return failureCount < 2;
}
