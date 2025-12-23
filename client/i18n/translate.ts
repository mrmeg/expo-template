/**
 * Translation helper function for use outside of React components.
 */

import i18n from "i18next";
import type { TOptions } from "i18next";
import type { TxKeyPath } from ".";

/**
 * Translate a key to the current language.
 *
 * Usage:
 * ```ts
 * translate("common.ok") // "OK"
 * translate("home.greeting", { name: "John" }) // "Hello, John!"
 * ```
 */
export function translate(key: TxKeyPath, options?: TOptions): string {
  if (i18n.isInitialized) {
    return i18n.t(key, options);
  }
  // Return key as fallback if i18n not initialized
  return key;
}
