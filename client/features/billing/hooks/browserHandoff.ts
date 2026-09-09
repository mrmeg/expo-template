/**
 * Web browser handoff: navigate the tab to the hosted Stripe page so the
 * browser history contains the `/billing/return` URL naturally.
 *
 * A platform file rather than a `Platform.OS` branch on purpose: the native
 * sibling (`browserHandoff.native.ts`) is the only importer of
 * `expo-web-browser`, so the web bundle never carries it for billing. The Clerk
 * chunk still uses it, but with a single consumer it stays inside that lazy
 * chunk instead of being hoisted into `__common`.
 */

import type { BrowserHandoff } from "../lib/handoff";

export function defaultBrowser(): BrowserHandoff {
  return {
    async openHosted(url, { status }) {
      if (typeof window !== "undefined") {
        window.location.href = url;
      }
      return status;
    },
  };
}
