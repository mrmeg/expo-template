export type TranslateFn = (key: string, options?: object) => string | undefined;

let translate: TranslateFn | null = null;

export function configureExpoUiI18n(fn: TranslateFn | null) {
  translate = fn;
}

export function translateText(key?: string, fallbackText?: string, options?: object) {
  if (!key) return fallbackText;
  if (!translate) return fallbackText ?? key;

  return translate(key, options) ?? fallbackText ?? key;
}
