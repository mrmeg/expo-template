import { QueryClient } from "@tanstack/react-query";

// Called once per root mount, never at module scope: the server renders every
// request with the same module instance, so a shared client would serve one
// request's cached data to the next. One client per mount is one per request on
// the server and one per app launch everywhere else.
export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 10, // 10 minutes
        retry: (failureCount, error) => {
          // Don't retry 4xx errors (client errors)
          if (error && typeof error === "object" && "status" in error) {
            const status = (error as { status: number }).status;
            if (status >= 400 && status < 500) return false;
          }
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  // A finite gcTime starts a timer that keeps its query, and through it this
  // request's whole cache, in memory until it fires. Forcing Infinity here also
  // covers per-query gcTime values, which would otherwise win. It starts no
  // timer, so the cache is freed with the request. Do not apply this to a shared
  // client: there, those timers are the only thing evicting entries.
  if (typeof window === "undefined") {
    const withDefaults = client.defaultQueryOptions.bind(client);
    client.defaultQueryOptions = ((options: Parameters<typeof withDefaults>[0]) => ({
      ...withDefaults(options),
      gcTime: Infinity,
    })) as typeof client.defaultQueryOptions;
  }

  return client;
}
