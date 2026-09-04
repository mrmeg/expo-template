/**
 * The store is the one place a user preference can reach the ladder, so a
 * partial override has to come out as a config the ladder can actually run. The
 * previous shape let a lone `{quality}` override sit below the preset's
 * `minQuality`, which silently disabled the loop that was supposed to hit the
 * size target; merging through `resolveCompressionConfig` is what replaced it.
 */

import { IMAGE_PRESETS, MIN_QUALITY } from "@mrmeg/expo-media/processing/image-compression/config";

import { getPresetOptions, useCompressionStore } from "../stores/compressionStore";

const store = () => useCompressionStore.getState();

beforeEach(() => {
  store().reset();
});

describe("getConfig", () => {
  it("resolves the default preset when nothing is requested", () => {
    expect(store().getConfig()).toEqual(IMAGE_PRESETS.gallery);
  });

  it("resolves a requested preset by name", () => {
    expect(store().getConfig("avatar")).toEqual(IMAGE_PRESETS.avatar);
  });

  it("returns no ladder when compression is disabled globally", () => {
    store().setEnabled(false);
    expect(store().getConfig("gallery")).toBeNull();
  });

  it("returns no ladder for an explicit opt-out", () => {
    expect(store().getConfig(null)).toBeNull();
    expect(store().getConfig("none")).toBeNull();
  });

  it("honours the configured default preset", () => {
    store().setDefaultPreset("thumbnail");
    expect(store().getConfig()).toEqual(IMAGE_PRESETS.thumbnail);
  });

  it("merges a user override onto the resolved preset", () => {
    store().setUserOverrides({ quality: 0.6 });

    expect(store().getConfig("gallery")).toEqual({
      ...IMAGE_PRESETS.gallery,
      rungs: [...IMAGE_PRESETS.gallery.rungs],
      quality: 0.6,
    });
  });

  it("clamps an out-of-range quality override instead of trusting it", () => {
    store().setUserOverrides({ quality: 0.05 });
    expect(store().getConfig("gallery")?.quality).toBe(MIN_QUALITY);

    store().setUserOverrides({ quality: 4 });
    expect(store().getConfig("gallery")?.quality).toBe(1);
  });

  it("normalizes an override that lists rungs out of order", () => {
    store().setUserOverrides({ rungs: [1024, 2048, 1024] });
    expect(store().getConfig("gallery")?.rungs).toEqual([2048, 1024]);
  });

  it("falls back to the preset's rungs when an override has none usable", () => {
    store().setUserOverrides({ rungs: [] });
    expect(store().getConfig("gallery")?.rungs).toEqual([
      ...IMAGE_PRESETS.gallery.rungs,
    ]);
  });

  it("keeps byte overrides non-negative", () => {
    store().setUserOverrides({ byteBudget: -1, passthroughBytes: -1 });

    expect(store().getConfig("gallery")).toMatchObject({
      byteBudget: 0,
      passthroughBytes: 0,
    });
  });

  it("always yields a runnable ladder for any single-field override", () => {
    const overrides = [
      { quality: 0.01 },
      { quality: 9 },
      { rungs: [0] },
      { byteBudget: 0 },
      { passthroughBytes: Number.NaN },
      { format: "png" as const },
    ];

    for (const override of overrides) {
      store().setUserOverrides(override);
      const config = store().getConfig("gallery");

      expect(config).not.toBeNull();
      expect(config?.rungs.length).toBeGreaterThan(0);
      expect(config?.quality).toBeGreaterThanOrEqual(MIN_QUALITY);
      expect(config?.quality).toBeLessThanOrEqual(1);
      expect(config?.byteBudget).toBeGreaterThanOrEqual(0);
    }
  });

  it("clears overrides on reset", () => {
    store().setUserOverrides({ quality: 0.5 });
    store().reset();
    expect(store().getConfig("gallery")).toEqual(IMAGE_PRESETS.gallery);
  });
});

describe("getPresetOptions", () => {
  it("describes every preset, including the no-compression option", () => {
    const options = getPresetOptions();

    expect(options.map((option) => option.key)).toEqual(Object.keys(IMAGE_PRESETS));
  });

  it("labels a preset with its largest rung and its byte budget", () => {
    const gallery = getPresetOptions().find((option) => option.key === "gallery");

    // 2048px is the first rung; 1000 KB is the budget.
    expect(gallery?.description).toContain("2048px");
    expect(gallery?.description).toMatch(/MB|KB/);
  });

  it("leaves the no-compression option without size specs", () => {
    const none = getPresetOptions().find((option) => option.key === "none");

    expect(none?.description).toBe("No compression");
  });
});
