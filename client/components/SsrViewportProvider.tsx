import React from "react";
import { useLoaderData } from "expo-router";
import { SsrViewportContext, SSR_VIEWPORT_DEFAULT_WIDTH } from "@mrmeg/expo-ui/state";

import type { WithSsrViewport } from "@/server/lib/ssrViewport";

/**
 * Reads the wrapped loader's data and provides the detected viewport width
 * to `SsrViewportContext`. Pair with `withSsrViewport(loader)` from
 * `@/server/lib/ssrViewport` so the loader returns `{ ssrViewportWidth }`.
 *
 * `useDimensions` inside the Provider uses this width as its initial state,
 * eliminating the post-hydration layout reflow.
 *
 * Falls back to `SSR_VIEWPORT_DEFAULT_WIDTH` (desktop) if a route forgot the
 * `withSsrViewport` wrapper — defensive runtime guard so the tree doesn't
 * crash on a missing field.
 */
export function SsrViewportProvider({ children }: { children: React.ReactNode }) {
  const data = useLoaderData<() => Promise<WithSsrViewport<unknown>>>();
  const width =
    data &&
    typeof data === "object" &&
    typeof (data as { ssrViewportWidth?: unknown }).ssrViewportWidth === "number"
      ? (data as { ssrViewportWidth: number }).ssrViewportWidth
      : SSR_VIEWPORT_DEFAULT_WIDTH;
  return <SsrViewportContext.Provider value={width}>{children}</SsrViewportContext.Provider>;
}
