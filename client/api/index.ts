import { fetchAuthSession } from "aws-amplify/auth";

async function getAuthData() {
  try {
    const session = await fetchAuthSession();
    return {
      token: session.tokens?.accessToken?.toString()
    };
  } catch {
    return { token: undefined };
  }
}

interface ApiOptions extends RequestInit {
  body?: any;
  token?: string;
  signal?: AbortSignal;
}

export async function authenticatedFetch(
  url: string,
  options: ApiOptions = {}
): Promise<Response> {
  try {
    // Prepare headers
    const headers = new Headers(options.headers || {});

    if (options.token) {
      headers.set("Authorization", `Bearer ${options.token}`);
    }
    headers.set("Content-Type", "application/json");

    // Prepare the request options
    const requestOptions: RequestInit = {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    };

    // Make the request
    const response = await fetch(url, requestOptions);

    // Handle unauthorized responses
    if (response.status === 401) {
      throw new Error("Unauthorized");
    }

    return response;
  } catch (error) {
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
