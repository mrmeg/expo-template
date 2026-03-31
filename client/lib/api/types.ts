/**
 * API response and request types.
 */

import type { ApiProblem } from "./apiProblem";

/**
 * Success response with data
 */
export type ApiOk<T> = {
  kind: "ok";
  data: T;
};

/**
 * Generic API result - either success with data or a problem
 */
export type ApiResult<T> = ApiOk<T> | ApiProblem;

/**
 * Request options for API calls
 */
export interface RequestOptions {
  /** Request headers */
  headers?: Record<string, string>;
  /** Request timeout in ms (default: from config) */
  timeout?: number;
  /** Whether to include credentials (cookies) */
  credentials?: RequestCredentials;
  /** Number of retries for temporary failures (default: 2 for GET, 0 for mutations) */
  retry?: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  retryDelay?: number;
}

/**
 * HTTP methods supported by the API client
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Common API response envelope (adjust to match your API)
 */
export interface ApiResponse<T> {
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
