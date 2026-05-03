export type TranslateFn = (key: string, options?: object) => string;

let translate: TranslateFn | null = null;

export function configureExpoUiI18n(fn: TranslateFn | null) {
  translate = fn;
}

export function translateText(key?: string, text?: string, options?: object) {
  if (text) return text;
  if (!key) return undefined;
  return translate ? translate(key, options) : key;
}
