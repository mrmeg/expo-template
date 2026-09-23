/**
 * Fetch helper for the app's own API routes.
 *
 * The bearer token comes from the getter registered in `./authToken`, never
 * from an auth import: the auth feature registers it at startup
 * (`registerApiTokenGetter()`, called from the root layout) the way the server
 * registers its verifier with `setTokenVerifier()`. With no getter — auth
 * disabled — requests go out without an `Authorization` header.
 */
import { getAuthToken } from "./authToken";

export { setAuthTokenGetter, type AuthTokenGetter } from "./authToken";

export async function getAuthData(): Promise<{ token: string | undefined }> {
  return { token: await getAuthToken() };
}

interface ApiOptions extends RequestInit {
  body?: any;
  token?: string;
  signal?: AbortSignal;
  /** Request timeout in ms (default: 30000). Ignored when signal is provided. */
  timeout?: number;
}

export async function authenticatedFetch(
  url: string,
  options: ApiOptions = {}
): Promise<Response> {
  // Timeout handling — hoisted for cleanup in catch block
  const timeoutMs = options.timeout ?? 30000;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let signal = options.signal;

  try {
    // Prepare headers
    const headers = new Headers(options.headers || {});

    if (options.token) {
      headers.set("Authorization", `Bearer ${options.token}`);
    }
    headers.set("Content-Type", "application/json");

    if (!signal) {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      signal = controller.signal;
    }

    // Prepare the request options
    const requestOptions: RequestInit = {
      ...options,
      headers,
      signal,
      body: options.body ? JSON.stringify(options.body) : undefined,
    };

    // Make the request
    const response = await fetch(url, requestOptions);
    if (timeoutId) clearTimeout(timeoutId);

    // Return error responses (including 401) as-is: callers map status
    // codes onto their own typed problem unions (BillingProblem,
    // MediaError) and need the response body to do it.
    return response;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    // Don't log abort errors - they're expected when requests are cancelled
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    console.error("API request failed:", error);
    throw error;
  }
}

// Helper methods for common HTTP methods
export const api = {
  get: async (url: string, options?: Omit<ApiOptions, "method" | "token">) => {
    const { token } = await getAuthData();
    return authenticatedFetch(url, { ...options, method: "GET", token });
  },

  post: async (url: string, body?: any, options?: Omit<ApiOptions, "method" | "body" | "token">) => {
    const { token } = await getAuthData();
    return authenticatedFetch(url, { ...options, method: "POST", body, token });
  },

  put: async (url: string, body?: any, options?: Omit<ApiOptions, "method" | "body" | "token">) => {
    const { token } = await getAuthData();
    return authenticatedFetch(url, { ...options, method: "PUT", body, token });
  },

  patch: async (url: string, body?: any, options?: Omit<ApiOptions, "method" | "body" | "token">) => {
    const { token } = await getAuthData();
    return authenticatedFetch(url, { ...options, method: "PATCH", body, token });
  },

  delete: async (url: string, body?: any, options?: Omit<ApiOptions, "method" | "body" | "token">) => {
    const { token } = await getAuthData();
    return authenticatedFetch(url, { ...options, method: "DELETE", body, token });
  },
};
