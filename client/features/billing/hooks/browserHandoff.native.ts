/**
 * Native browser handoff: `expo-web-browser`'s `openAuthSessionAsync` with a
 * deep-link redirect built from the active app scheme
 * (`<scheme>://billing/return`) so the system browser resolves back into the
 * app cleanly. The scheme comes from `client/lib/identity`, which mirrors
 * `app.config.ts`. See `browserHandoff.ts` for why this is a platform file.
 */

import * as WebBrowser from "expo-web-browser";

import { buildAppDeepLink } from "@/client/lib/identity";
import { parseReturnUrl, type BrowserHandoff } from "../lib/handoff";

export function defaultBrowser(): BrowserHandoff {
  return {
    async openHosted(url, { status }) {
      const result = await WebBrowser.openAuthSessionAsync(url, nativeReturnUrl());
      if (result.type === "success" && "url" in result) {
        const parsed = parseReturnUrl(result.url);
        return parsed ?? status;
      }
      return "dismissed";
    },
  };
}

function nativeReturnUrl(): string {
  return buildAppDeepLink("/billing/return");
}
