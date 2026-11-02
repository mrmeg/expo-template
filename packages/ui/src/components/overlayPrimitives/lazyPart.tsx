/**
 * Web wrappers that load the overlay engines on first render instead of with the
 * page. Server rendering waits for the chunk, so the HTML carries the real markup,
 * and hydration of that subtree waits for it in the browser.
 *
 * `use()` on one long-lived promise, not `React.lazy` per part: a lazy component
 * suspends on its first render even when its module is already loaded, which would
 * hide an open Select's trigger the moment its content first mounts.
 */
import * as React from "react";

type Engine = typeof import("./engine");

let enginePromise: Promise<Engine> | null = null;

function loadEngine(): Promise<Engine> {
  enginePromise ??= import("./engine");
  return enginePromise;
}

/** Reads one primitive from the engine, suspending until it has loaded. */
function usePrimitive<K extends keyof Engine>(primitive: K): Engine[K] {
  return React.use(loadEngine())[primitive];
}

/** A component that renders `primitive.part` once the engine is available. */
export function lazyPart<K extends keyof Engine, P extends keyof Engine[K]>(primitive: K, part: P): Engine[K][P] {
  const Lazy = React.forwardRef<unknown, Record<string, unknown>>(function LazyOverlayPart(props, ref) {
    const Part = usePrimitive(primitive)[part] as unknown as React.ElementType;
    return <Part ref={ref} {...props} />;
  });
  Lazy.displayName = `${String(primitive)}.${String(part)}`;
  return Lazy as unknown as Engine[K][P];
}

/** `lazyPart` for a primitive's outermost part: holds the Suspense boundary its tree loads under. */
export function lazyRoot<K extends keyof Engine, P extends keyof Engine[K]>(primitive: K, part: P): Engine[K][P] {
  const Part = lazyPart(primitive, part) as unknown as React.ElementType;
  const Root = React.forwardRef<unknown, Record<string, unknown>>(function LazyOverlayRoot(props, ref) {
    return (
      <React.Suspense fallback={null}>
        <Part ref={ref} {...props} />
      </React.Suspense>
    );
  });
  Root.displayName = `${String(primitive)}.${String(part)}`;
  return Root as unknown as Engine[K][P];
}

/** A hook from a primitive, for callers already inside its Root. */
export function lazyHook<K extends keyof Engine, P extends keyof Engine[K]>(primitive: K, hook: P): Engine[K][P] {
  const useLazyHook = (...args: unknown[]) => {
    const primitiveHook = usePrimitive(primitive)[hook] as unknown as (...hookArgs: unknown[]) => unknown;
    return primitiveHook(...args);
  };
  return useLazyHook as unknown as Engine[K][P];
}
