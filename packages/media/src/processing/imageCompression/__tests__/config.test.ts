/**
 * Preset values are a published contract (`@mrmeg/expo-media` consumers pick a
 * preset by name and get a ladder), so they are pinned literally here: a change
 * to a rung or a budget has to be a deliberate edit to this file, not a silent
 * shift in upload sizes.
 *
 * The normalization cases cover the invariant that replaced the old
 * `minQuality` field: a partial override can never produce a config the ladder
 * cannot run.
 */

import {
  DEFAULT_PRESET,
  IMAGE_PRESETS,
  MIN_QUALITY,
  resolveCompressionConfig,
} from "../config";

const KB = 1024;

describe("IMAGE_PRESETS", () => {
  it("pins the avatar preset", () => {
    expect(IMAGE_PRESETS.avatar).toEqual({
      rungs: [512],
      quality: 0.8,
      byteBudget: 200 * KB,
      passthroughBytes: 0,
      format: null,
    });
  });

  it("pins the thumbnail preset", () => {
    expect(IMAGE_PRESETS.thumbnail).toEqual({
      rungs: [256],
      quality: 0.7,
      byteBudget: 100 * KB,
      passthroughBytes: 0,
      format: null,
    });
  });

  it("pins the product preset", () => {
    expect(IMAGE_PRESETS.product).toEqual({
      rungs: [1024, 768],
      quality: 0.85,
      byteBudget: 500 * KB,
      passthroughBytes: 0,
      format: null,
    });
  });

  it("pins the gallery preset", () => {
    expect(IMAGE_PRESETS.gallery).toEqual({
      rungs: [2048, 1600, 1024],
      quality: 0.8,
      byteBudget: 1000 * KB,
      passthroughBytes: 300 * KB,
      format: null,
    });
  });

  it("pins the highQuality preset", () => {
    expect(IMAGE_PRESETS.highQuality).toEqual({
      rungs: [4096, 3072, 2048],
      quality: 0.8,
      byteBudget: 3000 * KB,
      passthroughBytes: 300 * KB,
      format: null,
    });
  });

  it("keeps `none` as the explicit no-ladder preset", () => {
    expect(IMAGE_PRESETS.none).toBeNull();
  });

  it("lists rungs in descending order for every ladder preset", () => {
    for (const [name, preset] of Object.entries(IMAGE_PRESETS)) {
      if (!preset) continue;
      const descending = [...preset.rungs].sort((a, b) => b - a);
      expect(preset.rungs).toEqual(descending);
      expect(new Set(preset.rungs).size).toBe(preset.rungs.length);
      expect(preset.quality).toBeGreaterThanOrEqual(MIN_QUALITY);
      expect(preset.quality).toBeLessThanOrEqual(1);
      expect(preset.byteBudget).toBeGreaterThan(0);
      expect(name).toBeTruthy();
    }
  });

  it("leaves the output format to the upload policy by default", () => {
    for (const preset of Object.values(IMAGE_PRESETS)) {
      if (!preset) continue;
      expect(preset.format).toBeNull();
    }
  });
});

describe("resolveCompressionConfig", () => {
  it("resolves a preset name to a copy of that preset", () => {
    const config = resolveCompressionConfig("gallery");
    expect(config).toEqual(IMAGE_PRESETS.gallery);
    // The caller must not be able to mutate the shared preset through its rungs.
    config!.rungs = [1];
    expect(IMAGE_PRESETS.gallery.rungs).toEqual([2048, 1600, 1024]);
  });

  it.each([null, undefined, "none" as const])("resolves %p to no ladder", (input) => {
    expect(resolveCompressionConfig(input)).toBeNull();
  });

  it("resolves an unknown preset name to no ladder rather than guessing", () => {
    expect(
      resolveCompressionConfig("enormous" as unknown as "gallery"),
    ).toBeNull();
  });

  it("fills a partial custom config from the default preset", () => {
    const defaults = IMAGE_PRESETS[DEFAULT_PRESET];
    expect(resolveCompressionConfig({ quality: 0.6 })).toEqual({
      ...defaults,
      rungs: [...defaults.rungs],
      quality: 0.6,
    });
  });

  it("sorts, dedupes, and rounds custom rungs", () => {
    expect(resolveCompressionConfig({ rungs: [800, 1600.4, 800, 1200] })?.rungs).toEqual([
      1600, 1200, 800,
    ]);
  });

  it("drops non-positive and non-finite rungs", () => {
    expect(resolveCompressionConfig({ rungs: [1024, 0, -5, Number.NaN] })?.rungs).toEqual([
      1024,
    ]);
  });

  it("falls back to the default rungs when every rung is unusable", () => {
    expect(resolveCompressionConfig({ rungs: [0, -1] })?.rungs).toEqual([
      ...IMAGE_PRESETS[DEFAULT_PRESET].rungs,
    ]);
  });

  it("clamps quality into the encodable range", () => {
    expect(resolveCompressionConfig({ quality: 5 })?.quality).toBe(1);
    expect(resolveCompressionConfig({ quality: 0.01 })?.quality).toBe(MIN_QUALITY);
    expect(resolveCompressionConfig({ quality: Number.NaN })?.quality).toBe(
      IMAGE_PRESETS[DEFAULT_PRESET].quality,
    );
  });

  it("keeps byte fields non-negative integers", () => {
    const config = resolveCompressionConfig({
      byteBudget: -100,
      passthroughBytes: 1234.6,
    });
    expect(config?.byteBudget).toBe(0);
    expect(config?.passthroughBytes).toBe(1235);
  });

  it("accepts only the two encodable output formats", () => {
    expect(resolveCompressionConfig({ format: "png" })?.format).toBe("png");
    expect(resolveCompressionConfig({ format: "jpeg" })?.format).toBe("jpeg");
    expect(resolveCompressionConfig({ format: null })?.format).toBeNull();
    expect(
      resolveCompressionConfig({ format: "webp" as unknown as "jpeg" })?.format,
    ).toBeNull();
  });

  it("produces a runnable ladder from a quality-only override", () => {
    // The old shape let `{quality: 0.5}` sit below a preset's `minQuality`, so
    // the size loop never ran. There is no such coupling now.
    const config = resolveCompressionConfig({ quality: 0.5 });
    expect(config?.rungs.length).toBeGreaterThan(0);
    expect(config?.quality).toBe(0.5);
    expect(config?.byteBudget).toBeGreaterThan(0);
  });
});
