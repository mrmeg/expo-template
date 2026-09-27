import type { Ref, RefCallback } from "react";

/**
 * One ref callback that feeds every ref given — object refs (`.current`) and
 * callback refs alike, `null`/`undefined` skipped. For a component that needs
 * the host node itself (e.g. to set a DOM attribute) while its consumer, or an
 * `asChild` slot, also passes a `ref`.
 */
export function composeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") {
        ref(node);
      } else {
        (ref as { current: T | null }).current = node;
      }
    }
  };
}
