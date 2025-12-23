/**
 * API client using fetch with typed responses and error handling.
 * Integrates well with React Query for data fetching.
 */

import Config from "@/client/config";
import { getApiProblem, type ApiProblem } from "./apiProblem";
import type { ApiResult, HttpMethod, RequestOptions } from "./types";

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
   * Core request method with error handling
   */
  async request<T>(
    method: HttpMethod,
    path: string,
    data?: unknown,
    options: RequestOptions = {}
  ): Promise<ApiResult<T>> {
    const url = `${this.baseUrl}${path}`;
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

      // Handle abort/timeout
      if (error instanceof Error && error.name === "AbortError") {
        return { kind: "timeout", temporary: true };
      }

      // Handle network errors
      if (error instanceof TypeError) {
        return { kind: "network-error", temporary: true };
      }

      return { kind: "unknown", temporary: true };
    }
  }

  // Convenience methods for common HTTP verbs

  async get<T>(path: string, options?: RequestOptions): Promise<ApiResult<T>> {
    return this.request<T>("GET", path, undefined, options);
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
