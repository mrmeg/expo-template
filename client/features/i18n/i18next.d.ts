import "i18next";

// Translation resources are not typed into i18next, so every key is a plain
// string and i18next cannot know a message's variables. Its v27 default,
// `strictInterpolationChecks: true`, then only rejects an `options` argument
// that may be `undefined`, so keep the v26 behaviour.
declare module "i18next" {
  interface CustomTypeOptions {
    strictInterpolationChecks: false;
  }
}
