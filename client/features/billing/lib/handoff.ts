/**
 * Shared vocabulary for the hosted-checkout browser handoff. Lives apart from
 * the hook so the platform-split implementations (`hooks/browserHandoff.ts`,
 * `hooks/browserHandoff.native.ts`) and the hook can all import it without a
 * cycle.
 */

export type BillingReturnStatus = "success" | "cancel" | "portal" | "dismissed";

export interface BrowserHandoff {
  /** Open the hosted URL. Resolves with the return status (or `"dismissed"` if the browser closed without a return). */
  openHosted(
    url: string,
    options: { status: "success" | "portal" },
  ): Promise<BillingReturnStatus>;
}

/**
 * Extract the `status` query parameter from a return URL. Deliberately
 * minimal — anything we don't recognize falls back to the caller's
 * default so the webhook (not the URL) stays the source of truth.
 */
export function parseReturnUrl(url: string): BillingReturnStatus | null {
  const match = url.match(/[?&]status=([^&#]+)/);
  if (!match) return null;
  const value = decodeURIComponent(match[1]);
  if (value === "success" || value === "cancel" || value === "portal") {
    return value;
  }
  return null;
}
