import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/**
 * False during server rendering and the hydration pass, true once the tree
 * is live on the client (and always true on native, which never hydrates).
 *
 * Use it to defer DOM output that cannot be reproduced on the server. The one
 * case in the kit: `useId()`-based `id` / `aria-labelledby` pairs. Under Expo
 * Router's streamed SSR the client's hydration pass computes different tree
 * ids than the server did, so an id emitted on both sides logs "A tree hydrated
 * but some attributes … didn't match" and the link points at a stale id.
 * Adding the attributes in the first client render after hydration is an
 * ordinary update instead.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
