/**
 * The orientations a full-window `Modal` supports (`Dialog`, `MediaViewer`):
 * the app's own orientation mask instead of React Native's portrait-only
 * default. Internal: not in the `lib` barrel.
 */
export const SUPPORTED_ORIENTATIONS = [
  "portrait",
  "portrait-upside-down",
  "landscape",
  "landscape-left",
  "landscape-right",
] as const;
