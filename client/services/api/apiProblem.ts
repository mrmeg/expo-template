/**
 * API error types for consistent error handling.
 * These represent various failure modes when making API requests.
 */

export type ApiProblem =
  | { kind: "timeout"; temporary: true }
  | { kind: "cannot-connect"; temporary: true }
  | { kind: "server"; status: number }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "not-found" }
  | { kind: "rejected"; status: number }
  | { kind: "unknown"; temporary: true }
  | { kind: "bad-data" }
  | { kind: "network-error"; temporary: true };

/**
 * Maps HTTP status codes to problem types.
 */
export function getApiProblem(status: number): ApiProblem | null {
  switch (status) {
  case 200:
  case 201:
  case 204:
    return null; // Success - no problem
  case 401:
    return { kind: "unauthorized" };
  case 403:
    return { kind: "forbidden" };
  case 404:
    return { kind: "not-found" };
  case 408:
    return { kind: "timeout", temporary: true };
  case 500:
  case 502:
  case 503:
  case 504:
    return { kind: "server", status };
  default:
    if (status >= 400 && status < 500) {
      return { kind: "rejected", status };
    }
    return { kind: "unknown", temporary: true };
  }
}

/**
 * Human-readable error messages for API problems.
 */
export function getApiProblemMessage(problem: ApiProblem): string {
  switch (problem.kind) {
  case "timeout":
    return "Request timed out. Please try again.";
  case "cannot-connect":
    return "Unable to connect to the server.";
  case "network-error":
    return "Network error. Please check your connection.";
  case "server":
    return "Server error. Please try again later.";
  case "unauthorized":
    return "You need to log in to continue.";
  case "forbidden":
    return "You don't have permission to do that.";
  case "not-found":
    return "The requested resource was not found.";
  case "rejected":
    return "The request was rejected.";
  case "bad-data":
    return "Received invalid data from the server.";
  case "unknown":
  default:
    return "An unexpected error occurred.";
  }
}
