/**
 * Installs `Intl.PluralRules`, which Hermes does not implement and i18next needs
 * for plural forms beyond one/other.
 *
 * A `require` in a function, not `import "intl-pluralrules"`: Expo's tree shaker
 * removes that bare import from production bundles (the package declares no
 * `sideEffects`, and dev keeps it, so the difference only shows in a release).
 */
export function installPluralRules(): void {
  require("intl-pluralrules");
}
