/**
 * `useBillingActions` — creates Stripe Checkout / Billing Portal sessions
 * and performs the browser handoff.
 *
 * Web opens `window.location.href` so the browser history contains the
 * return URL naturally. Native uses `expo-web-browser`'s
 * `openAuthSessionAsync` with a `myapp://billing/return` redirect so the
 * system browser resolves back into the app cleanly.
 *
 * The return URL is a UX hint, not proof of payment — the hook refetches
 * the billing summary query on return regardless of reported status.
 */

import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";

import {
  createCheckoutSession,
  createPortalSession,
  type BillingProblem,
} from "../api";
import { billingSummaryQueryKey } from "./useBillingSummary";
import { useAuthStore } from "@/client/features/auth/stores/authStore";
import type { BillingInterval } from "../types";

export type BillingActionError = BillingProblem;

export interface StartCheckoutInput {
  planId: string;
  interval: BillingInterval;
}

export type BillingReturnStatus = "success" | "cancel" | "portal" | "dismissed";

export interface BillingActionResult {
  status: BillingReturnStatus | "failed";
  problem?: BillingActionError;
}

export interface BrowserHandoff {
  /** Open the hosted URL. Resolves with the return status (or `"dismissed"` if the browser closed without a return). */
  openHosted(
    url: string,
    options: { status: "success" | "portal" },
  ): Promise<BillingReturnStatus>;
}

export interface UseBillingActionsOptions {
  /** Override the `/billing/return` path (mainly for tests). */
  returnPath?: string;
  /** Override the browser layer — used by unit tests to skip `expo-web-browser`. */
  browser?: BrowserHandoff;
}

export interface UseBillingActionsValue {
  startCheckout: (input: StartCheckoutInput) => Promise<BillingActionResult>;
  startPortal: () => Promise<BillingActionResult>;
  refreshSummary: () => Promise<void>;
  isCreatingCheckout: boolean;
  isCreatingPortal: boolean;
  lastError: BillingActionError | null;
}

const DEFAULT_RETURN_PATH = "/billing/return";

export function useBillingActions(
  options: UseBillingActionsOptions = {},
): UseBillingActionsValue {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.userId ?? null);
  const [isCreatingCheckout, setCreatingCheckout] = useState(false);
  const [isCreatingPortal, setCreatingPortal] = useState(false);
  const [lastError, setLastError] = useState<BillingActionError | null>(null);
  const lastRequestId = useRef(0);

  const returnPath = options.returnPath ?? DEFAULT_RETURN_PATH;
  const browser = options.browser ?? defaultBrowser();

  const refreshSummary = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: billingSummaryQueryKey(userId),
    });
  }, [queryClient, userId]);

  const startCheckout = useCallback(
    async ({ planId, interval }: StartCheckoutInput): Promise<BillingActionResult> => {
      lastRequestId.current += 1;
      setCreatingCheckout(true);
      setLastError(null);
      try {
        const result = await createCheckoutSession({
          planId,
          interval,
          returnPath,
        });
        if (result.kind !== "ok") {
          setLastError(result.problem);
          return { status: "failed", problem: result.problem };
        }
        const status = await browser.openHosted(result.data.url, {
          status: "success",
        });
        await refreshSummary();
        return { status };
      } finally {
        setCreatingCheckout(false);
      }
    },
    [browser, refreshSummary, returnPath],
  );

  const startPortal = useCallback(
    async (): Promise<BillingActionResult> => {
      lastRequestId.current += 1;
      setCreatingPortal(true);
      setLastError(null);
      try {
        const result = await createPortalSession({ returnPath });
        if (result.kind !== "ok") {
          setLastError(result.problem);
          return { status: "failed", problem: result.problem };
        }
        const status = await browser.openHosted(result.data.url, {
          status: "portal",
        });
        await refreshSummary();
        return { status };
      } finally {
        setCreatingPortal(false);
      }
    },
    [browser, refreshSummary, returnPath],
  );

  return {
    startCheckout,
    startPortal,
    refreshSummary,
    isCreatingCheckout,
    isCreatingPortal,
    lastError,
  };
}

function defaultBrowser(): BrowserHandoff {
  return {
    async openHosted(url, { status }) {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          window.location.href = url;
        }
        return status;
      }
      const result = await WebBrowser.openAuthSessionAsync(
        url,
        nativeReturnUrl(),
      );
      if (result.type === "success" && "url" in result) {
        const parsed = parseReturnUrl(result.url);
        return parsed ?? status;
      }
      return "dismissed";
    },
  };
}

function nativeReturnUrl(): string {
  return "myapp://billing/return";
}

/**
 * Extract the `status` query parameter from a return URL. Deliberately
 * minimal — anything we don't recognize falls back to the caller's
 * default so the webhook (not the URL) stays the source of truth.
 */
function parseReturnUrl(url: string): BillingReturnStatus | null {
  const match = url.match(/[?&]status=([^&#]+)/);
  if (!match) return null;
  const value = decodeURIComponent(match[1]);
  if (value === "success" || value === "cancel" || value === "portal") {
    return value;
  }
  return null;
}

export const __internal = { parseReturnUrl };
