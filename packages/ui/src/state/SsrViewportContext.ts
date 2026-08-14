import { createContext } from "react";

/**
 * Per-request SSR viewport width. Consumed by `useDimensions` to seed the
 * server render and the browser's FIRST render, so a server that detected a
 * phone lays the tree out at phone width and hydration matches byte-for-byte.
 *
 * `null` (the default, when no provider is mounted) means "no per-request
 * signal" and `useDimensions` falls back to `DEFAULT_VIEWPORT_WIDTH`. The
 * host app is expected to provide the same value on the server and on the
 * client's first render — both derived from signals both sides can read
 * (cookie / User-Agent), never from `window`.
 */
export const SsrViewportContext = createContext<number | null>(null);
