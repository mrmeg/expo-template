import { createContext } from "react";

/**
 * Default viewport used during SSR and the initial client render. Desktop is
 * chosen because:
 *   1. Most web traffic for app dashboards / marketing pages skews desktop.
 *   2. Desktop visitors see no layout reflow on hydration (SSR layout matches
 *      their actual viewport's breakpoint).
 *   3. Mobile visitors get one frame of desktop-styled content before
 *      `useDimensions`'s post-mount effect snaps to real dimensions — better
 *      than the inverse (every desktop visitor sees mobile-tiny then snap).
 *
 * Projects that skew mobile can override with their own Provider higher in
 * the tree, or per-page via a loader that detects from cookie / User-Agent.
 */
export const SSR_VIEWPORT_DEFAULT_WIDTH = 1280;
export const SSR_VIEWPORT_DEFAULT_HEIGHT = 800;

/**
 * Per-request SSR viewport width. Consumed by `useDimensions` to seed the
 * initial responsive render so it matches what the user sees.
 *
 * Set the provider near the top of your tree (typically in a route component
 * whose loader detects the viewport from a cookie or User-Agent):
 *
 * ```tsx
 * import { SsrViewportContext } from "@mrmeg/expo-ui/state";
 * import { detectSsrViewportWidth } from "@/server/lib/ssrViewport";
 *
 * export const loader: LoaderFunction<{ ssrViewportWidth?: number }> = (request) => ({
 *   ssrViewportWidth: detectSsrViewportWidth(request),
 * });
 *
 * export default function Page() {
 *   const { ssrViewportWidth } = useLoaderData<typeof loader>();
 *   return (
 *     <SsrViewportContext.Provider value={ssrViewportWidth ?? SSR_VIEWPORT_DEFAULT_WIDTH}>
 *       ...
 *     </SsrViewportContext.Provider>
 *   );
 * }
 * ```
 */
export const SsrViewportContext = createContext<number>(SSR_VIEWPORT_DEFAULT_WIDTH);
