/**
 * Zustand store for image compression settings.
 * Provides app-wide defaults and optional user preferences.
 */

import { create } from "zustand";
import {
  type CompressionConfig,
  type ImagePreset,
  IMAGE_PRESETS,
  DEFAULT_PRESET,
  resolveCompressionConfig,
} from "@/client/lib/imageCompression";

interface CompressionState {
  /** Default preset used when no compression option is specified */
  defaultPreset: ImagePreset;

  /** User preference overrides (merged with preset) */
  userOverrides: Partial<CompressionConfig> | null;

  /** Whether compression is enabled globally */
  enabled: boolean;
}

interface CompressionActions {
  /** Set the default preset */
  setDefaultPreset: (preset: ImagePreset) => void;

  /** Set user preference overrides */
  setUserOverrides: (overrides: Partial<CompressionConfig> | null) => void;

  /** Enable or disable compression globally */
  setEnabled: (enabled: boolean) => void;

  /** Reset to defaults */
  reset: () => void;

  /** Get resolved config (preset + user overrides) */
  getConfig: (
    options?: ImagePreset | Partial<CompressionConfig> | null
  ) => CompressionConfig | null;
}

type CompressionStore = CompressionState & CompressionActions;

const initialState: CompressionState = {
  defaultPreset: DEFAULT_PRESET,
  userOverrides: null,
  enabled: true,
};

export const useCompressionStore = create<CompressionStore>()((set, get) => ({
  ...initialState,

  setDefaultPreset: (preset) => set({ defaultPreset: preset }),

  setUserOverrides: (overrides) => set({ userOverrides: overrides }),

  setEnabled: (enabled) => set({ enabled }),

  reset: () => set(initialState),

  getConfig: (options) => {
    const state = get();

    // If compression is disabled globally, return null
    if (!state.enabled) {
      return null;
    }

    // If explicit 'none' or null passed, skip compression
    if (options === "none" || options === null) {
      return null;
    }

    // Resolve base config from options or default preset
    const baseConfig = resolveCompressionConfig(
      options ?? state.defaultPreset
    );

    if (!baseConfig) {
      return null;
    }

    // Apply user overrides if present
    if (state.userOverrides) {
      return {
        ...baseConfig,
        ...state.userOverrides,
        // Ensure minQuality doesn't exceed quality
        minQuality: Math.min(
          state.userOverrides.minQuality ?? baseConfig.minQuality,
          state.userOverrides.quality ?? baseConfig.quality
        ),
      };
    }

    return baseConfig;
  },
}));

/**
 * Convenience hook for getting resolved compression config.
 * Use this in components that need to know the current settings.
 */
export function useCompressionConfig(
  options?: ImagePreset | Partial<CompressionConfig> | null
) {
  const getConfig = useCompressionStore((state) => state.getConfig);
  return getConfig(options);
}

/** Human-readable labels for presets */
const PRESET_LABELS: Record<ImagePreset, { label: string; description: string }> = {
  avatar: { label: "Avatar", description: "Profile pictures" },
  thumbnail: { label: "Thumbnail", description: "Small previews" },
  product: { label: "Product", description: "Product images" },
  gallery: { label: "Gallery", description: "High-quality photos" },
  highQuality: { label: "High Quality", description: "Maximum detail" },
  none: { label: "Original", description: "No compression" },
};

/**
 * Get available presets for UI selection.
 * Derives descriptions from actual preset values.
 */
export function getPresetOptions(): Array<{
  key: ImagePreset;
  label: string;
  description: string;
}> {
  return (Object.keys(IMAGE_PRESETS) as ImagePreset[]).map((key) => {
    const preset = IMAGE_PRESETS[key];
    const labels = PRESET_LABELS[key];

    if (!preset) {
      return { key, ...labels };
    }

    const sizeInfo = preset.maxSizeKB
      ? preset.maxSizeKB >= 1000
        ? `~${preset.maxSizeKB / 1000}MB`
        : `~${preset.maxSizeKB}KB`
      : "";
    const dimInfo = preset.maxDimension ? `${preset.maxDimension}px` : "";
    const specs = [dimInfo, sizeInfo].filter(Boolean).join(", ");

    return {
      key,
      label: labels.label,
      description: specs ? `${specs} - ${labels.description}` : labels.description,
    };
  });
}
