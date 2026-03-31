/**
 * API client using fetch with typed responses and error handling.
 * Integrates well with React Query for data fetching.
 */

import Config from "@/client/config";
import { getApiProblem, type ApiProblem } from "./apiProblem";
import type { ApiResult, HttpMethod, RequestOptions } from "./types";
import { calculateBackoff, sleep } from "./retry";

class Api {
  private baseUrl: string;
  private defaultTimeout: number;
  private authToken: string | null = null;

  constructor() {
    this.baseUrl = Config.apiUrl;
    this.defaultTimeout = Config.apiTimeout;
  }

  /**
   * Set the auth token for authenticated requests.
   * Call this after login/token refresh.
   */
  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  /**
   * Get current auth token (useful for checking auth state)
   */
  getAuthToken(): string | null {
    return this.authToken;
  }

  /**
   * Update base URL (useful for switching environments)
   */
  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  /**
   * Build headers for the request
   */
  private buildHeaders(customHeaders?: Record<string, string>): Headers {
    const headers = new Headers({
      "Content-Type": "application/json",
      Accept: "application/json",
      ...customHeaders,
    });

    if (this.authToken) {
      headers.set("Authorization", `Bearer ${this.authToken}`);
    }

    return headers;
  }

  /**
   * Create an AbortController with timeout
   */
  private createAbortController(timeout: number): {
    controller: AbortController;
    timeoutId: ReturnType<typeof setTimeout>;
  } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    return { controller, timeoutId };
  }

  /**
   * Execute a single request attempt (no retry).
   */
  private async attemptRequest<T>(
    method: HttpMethod,
    url: string,
    data: unknown | undefined,
    options: RequestOptions
  ): Promise<ApiResult<T>> {
    const timeout = options.timeout ?? this.defaultTimeout;
    const { controller, timeoutId } = this.createAbortController(timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: this.buildHeaders(options.headers),
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
        credentials: options.credentials,
      });

      clearTimeout(timeoutId);

      // Check for HTTP errors
      const problem = getApiProblem(response.status);
      if (problem) {
        return problem;
      }

      // Handle empty responses (204 No Content)
      if (response.status === 204) {
        return { kind: "ok", data: null as T };
      }

      // Parse JSON response
      try {
        const json = await response.json();
        return { kind: "ok", data: json as T };
      } catch {
        return { kind: "bad-data" };
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        return { kind: "timeout", temporary: true };
      }

      if (error instanceof TypeError) {
        return { kind: "network-error", temporary: true };
      }

      return { kind: "unknown", temporary: true };
    }
  }

  /**
   * Core request method with error handling and optional retry.
   */
  async request<T>(
    method: HttpMethod,
    path: string,
    data?: unknown,
    options: RequestOptions = {}
  ): Promise<ApiResult<T>> {
    const url = `${this.baseUrl}${path}`;
    const maxRetries = options.retry ?? 0;
    const baseDelay = options.retryDelay ?? 1000;

    let result = await this.attemptRequest<T>(method, url, data, options);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Only retry temporary failures
      if (result.kind === "ok" || !("temporary" in result) || !result.temporary) {
        break;
      }

      await sleep(calculateBackoff(attempt, baseDelay));
      result = await this.attemptRequest<T>(method, url, data, options);
    }

    return result;
  }

  // Convenience methods for common HTTP verbs

  async get<T>(path: string, options?: RequestOptions): Promise<ApiResult<T>> {
    return this.request<T>("GET", path, undefined, { retry: 2, ...options });
  }

  async post<T>(
    path: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<ApiResult<T>> {
    return this.request<T>("POST", path, data, options);
  }

  async put<T>(
    path: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<ApiResult<T>> {
    return this.request<T>("PUT", path, data, options);
  }

  async patch<T>(
    path: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<ApiResult<T>> {
    return this.request<T>("PATCH", path, data, options);
  }

  async delete<T>(
    path: string,
    options?: RequestOptions
  ): Promise<ApiResult<T>> {
    return this.request<T>("DELETE", path, undefined, options);
  }
}

// Export singleton instance
export const api = new Api();

// Export class for testing/custom instances
export { Api };

// Re-export types
export * from "./apiProblem";
export * from "./types";
