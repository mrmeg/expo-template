/**
 * Web twin of `pluralRules.native.ts`: every browser has `Intl.PluralRules`, so
 * the polyfill stays out of the web bundle.
 */
export function installPluralRules(): void {}
