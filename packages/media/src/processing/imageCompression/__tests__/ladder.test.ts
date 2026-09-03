/**
 * The ladder replaced a quality-decay loop that could not promise termination or
 * a size. What has to hold now: it descends, it stops at the first rung inside
 * the budget, it reports `overBudget` rather than lying when even the smallest
 * rung misses, it re-encodes from the *source* every time, and it never leaves a
 * losing attempt behind.
 *
 * The encoder is injected, so these run identically on both platforms.
 */

import { runDimensionLadder, resolveLadderRungs } from "../ladder";
import type { EncodeImageOptions, ImageSource } from "../types";

const SOURCE: ImageSource = { uri: "file:///photo.jpg" };

interface FakeEncoder {
  encode: (options: EncodeImageOptions) => Promise<{
    uri: string;
    width: number;
    height: number;
    contentType: string;
    size: number;
  }>;
  dispose: jest.Mock<void, [{ uri: string }]>;
  calls: EncodeImageOptions[];
}

/**
 * Encoder whose output size is `sizeForRung(rung)`. Records every call so the
 * test can assert what the ladder asked for and in which order.
 */
function fakeEncoder(sizeForRung: (rung: number) => number): FakeEncoder {
  const calls: EncodeImageOptions[] = [];
  return {
    calls,
    dispose: jest.fn(),
    encode: async (options) => {
      calls.push(options);
      return {
        uri: `file:///out-${options.longEdge}.jpg`,
        width: options.longEdge,
        height: Math.round(options.longEdge * 0.75),
        contentType: "image/jpeg",
        size: sizeForRung(options.longEdge),
      };
    },
  };
}

describe("resolveLadderRungs", () => {
  it("keeps descending order", () => {
    expect(resolveLadderRungs([1024, 2048, 1600], 4000)).toEqual([2048, 1600, 1024]);
  });

  it("clamps rungs above the source so the ladder never upscales", () => {
    expect(resolveLadderRungs([4096, 3072, 2048], 2500)).toEqual([2500, 2048]);
  });

  it("collapses rungs that clamp onto the same cap", () => {
    expect(resolveLadderRungs([4096, 3072, 2048], 1000)).toEqual([1000]);
  });

  it("drops unusable rungs", () => {
    expect(resolveLadderRungs([2048, 0, -1, Number.NaN], 4000)).toEqual([2048]);
  });

  it("falls back to the source long edge when no rung is usable", () => {
    expect(resolveLadderRungs([], 3000)).toEqual([3000]);
    expect(resolveLadderRungs([0], 3000)).toEqual([3000]);
  });

  it("returns nothing when neither rungs nor source dimensions are known", () => {
    expect(resolveLadderRungs([], 0)).toEqual([]);
  });

  it("does not clamp when the source long edge is unknown", () => {
    expect(resolveLadderRungs([2048, 1024], 0)).toEqual([2048, 1024]);
  });
});

describe("runDimensionLadder", () => {
  it("stops at the first rung inside the budget", async () => {
    const encoder = fakeEncoder(() => 100_000);

    const result = await runDimensionLadder({
      source: SOURCE,
      width: 4000,
      height: 3000,
      rungs: [2048, 1600, 1024],
      quality: 0.8,
      byteBudget: 500_000,
      format: "jpeg",
      encode: encoder.encode,
      dispose: encoder.dispose,
    });

    expect(encoder.calls).toHaveLength(1);
    expect(result.rung).toBe(2048);
    expect(result.attempts).toBe(1);
    expect(result.overBudget).toBe(false);
    expect(encoder.dispose).not.toHaveBeenCalled();
  });

  it("descends until a rung fits and reports the attempt count", async () => {
    // Only the 1024 rung comes in under 500 KB.
    const encoder = fakeEncoder((rung) => (rung > 1024 ? 900_000 : 400_000));

    const result = await runDimensionLadder({
      source: SOURCE,
      width: 4000,
      height: 3000,
      rungs: [2048, 1600, 1024],
      quality: 0.8,
      byteBudget: 500_000,
      format: "jpeg",
      encode: encoder.encode,
      dispose: encoder.dispose,
    });

    expect(encoder.calls.map((call) => call.longEdge)).toEqual([2048, 1600, 1024]);
    expect(result.rung).toBe(1024);
    expect(result.attempts).toBe(3);
    expect(result.overBudget).toBe(false);
    expect(result.size).toBe(400_000);
  });

  it("re-encodes from the source on every rung, never from the previous output", async () => {
    const encoder = fakeEncoder((rung) => (rung > 1024 ? 900_000 : 400_000));

    await runDimensionLadder({
      source: SOURCE,
      width: 4000,
      height: 3000,
      rungs: [2048, 1600, 1024],
      quality: 0.8,
      byteBudget: 500_000,
      format: "jpeg",
      encode: encoder.encode,
      dispose: encoder.dispose,
    });

    for (const call of encoder.calls) {
      expect(call.source).toBe(SOURCE);
      // Source dimensions are constant too — generation loss would show up here
      // as a shrinking input.
      expect(call.width).toBe(4000);
      expect(call.height).toBe(3000);
      expect(call.quality).toBe(0.8);
    }
  });

  it("holds quality fixed rather than decaying it", async () => {
    const encoder = fakeEncoder(() => 900_000);

    await runDimensionLadder({
      source: SOURCE,
      width: 4000,
      height: 3000,
      rungs: [2048, 1600, 1024],
      quality: 0.8,
      byteBudget: 500_000,
      format: "jpeg",
      encode: encoder.encode,
      dispose: encoder.dispose,
    });

    expect(encoder.calls.map((call) => call.quality)).toEqual([0.8, 0.8, 0.8]);
  });

  it("returns the smallest rung flagged overBudget when nothing fits", async () => {
    const encoder = fakeEncoder(() => 900_000);

    const result = await runDimensionLadder({
      source: SOURCE,
      width: 4000,
      height: 3000,
      rungs: [2048, 1600, 1024],
      quality: 0.8,
      byteBudget: 500_000,
      format: "jpeg",
      encode: encoder.encode,
      dispose: encoder.dispose,
    });

    expect(encoder.calls).toHaveLength(3);
    expect(result.rung).toBe(1024);
    expect(result.attempts).toBe(3);
    expect(result.overBudget).toBe(true);
  });

  it("releases each losing attempt as soon as it loses", async () => {
    const encoder = fakeEncoder((rung) => (rung > 1024 ? 900_000 : 400_000));

    const result = await runDimensionLadder({
      source: SOURCE,
      width: 4000,
      height: 3000,
      rungs: [2048, 1600, 1024],
      quality: 0.8,
      byteBudget: 500_000,
      format: "jpeg",
      encode: encoder.encode,
      dispose: encoder.dispose,
    });

    // Two losers disposed, the winner kept.
    expect(encoder.dispose.mock.calls.map(([image]) => image.uri)).toEqual([
      "file:///out-2048.jpg",
      "file:///out-1600.jpg",
    ]);
    expect(encoder.dispose).not.toHaveBeenCalledWith(
      expect.objectContaining({ uri: result.uri }),
    );
  });

  it("never disposes the returned attempt, even when it is over budget", async () => {
    const encoder = fakeEncoder(() => 900_000);

    const result = await runDimensionLadder({
      source: SOURCE,
      width: 4000,
      height: 3000,
      rungs: [2048, 1024],
      quality: 0.8,
      byteBudget: 500_000,
      format: "jpeg",
      encode: encoder.encode,
      dispose: encoder.dispose,
    });

    expect(encoder.dispose).toHaveBeenCalledTimes(1);
    expect(encoder.dispose).toHaveBeenCalledWith(
      expect.objectContaining({ uri: "file:///out-2048.jpg" }),
    );
    expect(result.uri).toBe("file:///out-1024.jpg");
  });

  it("treats a zero budget as no budget and takes the first rung", async () => {
    const encoder = fakeEncoder(() => 9_000_000);

    const result = await runDimensionLadder({
      source: SOURCE,
      width: 4000,
      height: 3000,
      rungs: [2048, 1024],
      quality: 0.8,
      byteBudget: 0,
      format: "jpeg",
      encode: encoder.encode,
      dispose: encoder.dispose,
    });

    expect(encoder.calls).toHaveLength(1);
    expect(result.rung).toBe(2048);
    expect(result.overBudget).toBe(false);
  });

  it("clamps the first rung to the source rather than upscaling", async () => {
    const encoder = fakeEncoder(() => 100_000);

    const result = await runDimensionLadder({
      source: SOURCE,
      width: 800,
      height: 600,
      rungs: [2048, 1600, 1024],
      quality: 0.8,
      byteBudget: 500_000,
      format: "jpeg",
      encode: encoder.encode,
      dispose: encoder.dispose,
    });

    expect(encoder.calls.map((call) => call.longEdge)).toEqual([800]);
    expect(result.rung).toBe(800);
  });

  it("propagates an encoder failure instead of returning an unmeasured file", async () => {
    // This is the stat-failure path on native: `File.size` throwing has to fail
    // the asset, because a `0` would make every size comparison downstream wrong.
    const failure = new Error("Could not read the size of file:///out-2048.jpg");
    const dispose = jest.fn();

    await expect(
      runDimensionLadder({
        source: SOURCE,
        width: 4000,
        height: 3000,
        rungs: [2048, 1024],
        quality: 0.8,
        byteBudget: 500_000,
        format: "jpeg",
        encode: async () => {
          throw failure;
        },
        dispose,
      }),
    ).rejects.toThrow(failure);
  });

  it("still releases earlier attempts when a later rung throws", async () => {
    const dispose = jest.fn();
    let call = 0;

    await expect(
      runDimensionLadder({
        source: SOURCE,
        width: 4000,
        height: 3000,
        rungs: [2048, 1024],
        quality: 0.8,
        byteBudget: 500_000,
        format: "jpeg",
        encode: async (options) => {
          call += 1;
          if (call === 2) throw new Error("stat failed");
          return {
            uri: `file:///out-${options.longEdge}.jpg`,
            width: options.longEdge,
            height: options.longEdge,
            contentType: "image/jpeg",
            size: 900_000,
          };
        },
        dispose,
      }),
    ).rejects.toThrow("stat failed");

    // The 2048 attempt was already written when 1024 failed; nothing downstream
    // will ever see it, so the ladder is the only place that can release it.
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledWith(
      expect.objectContaining({ uri: "file:///out-2048.jpg" }),
    );
  });

  it("throws when there is no usable rung at all", async () => {
    const encoder = fakeEncoder(() => 100);

    await expect(
      runDimensionLadder({
        source: SOURCE,
        width: 0,
        height: 0,
        rungs: [],
        quality: 0.8,
        byteBudget: 500_000,
        format: "jpeg",
        encode: encoder.encode,
        dispose: encoder.dispose,
      }),
    ).rejects.toThrow(/at least one usable rung/);
  });

  it("passes the requested format through to the encoder", async () => {
    const encoder = fakeEncoder(() => 100_000);

    await runDimensionLadder({
      source: SOURCE,
      width: 1200,
      height: 900,
      rungs: [1024],
      quality: 0.9,
      byteBudget: 500_000,
      format: "png",
      encode: encoder.encode,
      dispose: encoder.dispose,
    });

    expect(encoder.calls[0].format).toBe("png");
  });
});
