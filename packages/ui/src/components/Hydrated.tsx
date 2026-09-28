import type { ReactNode } from "react";
import { useHydrated } from "../hooks/useHydrated";

export interface HydratedProps {
  /** What the server HTML and the hydration pass show in place of the children. @default null */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Hydrated
 *
 * Renders `fallback` on the server and through the hydration pass, then its
 * children in the first client render — the gate for markup the server cannot
 * reproduce. Under Expo Router's SSR the server renders the app inside
 * `+html.tsx` while the client hydrates `#root`, so every `useId()` differs
 * between the two trees; the kit defers its own ids, but a Radix-backed
 * component (`Tabs`, `Accordion`, `Collapsible`, `Select`, `DropdownMenu`,
 * `Popover`) emits ids on both sides and logs a hydration mismatch when it is
 * part of a server-rendered route. Wrap that subtree, not the page: the rest of
 * the screen keeps its server HTML. Give it a fallback that holds the layout
 * (a placeholder the same height) so nothing shifts when the children mount.
 *
 * Do not use it for content that must be in the server HTML (a FAQ's questions,
 * a product's description); accept the development-only log there instead. On
 * native there is no hydration pass, so children render immediately.
 *
 * ```tsx
 * <Hydrated fallback={<View style={{ height: 240 }} />}>
 *   <Tabs defaultValue="day">…</Tabs>
 * </Hydrated>
 * ```
 */
export function Hydrated({ fallback = null, children }: HydratedProps) {
  const hydrated = useHydrated();
  return <>{hydrated ? children : fallback}</>;
}
