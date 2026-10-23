import { act, renderHook } from "@testing-library/react-native";
import { mediaFrameStyle, parseAspectRatio, useMediaAspectRatio } from "../mediaFrame";

describe("parseAspectRatio", () => {
  it("returns a positive finite number as is", () => {
    expect(parseAspectRatio(1.5)).toBe(1.5);
    expect(parseAspectRatio(0.5625)).toBe(0.5625);
  });

  it("parses a w:h string", () => {
    expect(parseAspectRatio("16:9")).toBeCloseTo(16 / 9);
    expect(parseAspectRatio("9:16")).toBeCloseTo(9 / 16);
    expect(parseAspectRatio(" 4 : 3 ")).toBeCloseTo(4 / 3);
    expect(parseAspectRatio("1.5:1")).toBeCloseTo(1.5);
  });

  it("parses a { width, height } pair", () => {
    expect(parseAspectRatio({ width: 1080, height: 1920 })).toBeCloseTo(0.5625);
  });

  it.each<[string, unknown]>([
    ["zero", 0],
    ["negative", -1],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["empty string", ""],
    ["a word", "wide"],
    ["a bare number string", "1.5"],
    ["a missing side", "16:"],
    ["a zero side", "0:9"],
    ["a zero denominator", "16:0"],
    ["a negative side", "-16:9"],
    ["three parts", "16:9:1"],
    ["a zero width", { width: 0, height: 10 }],
    ["a zero height", { width: 10, height: 0 }],
    ["a NaN side", { width: Number.NaN, height: 10 }],
    ["a missing side object", { width: 10 }],
    ["null", null],
    ["undefined", undefined],
  ])("returns undefined for %s", (_name, input) => {
    expect(parseAspectRatio(input)).toBeUndefined();
  });
});

describe("mediaFrameStyle", () => {
  it("fills the positioned parent", () => {
    expect(mediaFrameStyle({ fill: true })).toEqual({ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("fill wins over every other option", () => {
    expect(mediaFrameStyle({ fill: true, aspectRatio: "16:9", maxHeight: 100, maxWidth: 100 })).toEqual(
      mediaFrameStyle({ fill: true }),
    );
  });

  it("sizes by ratio at full width, centered", () => {
    expect(mediaFrameStyle({ aspectRatio: "16:9" })).toEqual({
      width: "100%",
      aspectRatio: 16 / 9,
      alignSelf: "center",
    });
  });

  it("caps the width at maxHeight * ratio so a portrait clip stays under maxHeight", () => {
    const style = mediaFrameStyle({ aspectRatio: "9:16", maxHeight: 640 });
    expect(style.maxWidth).toBeCloseTo(360);
    // The frame is maxWidth wide at 9:16, so it is exactly maxHeight tall.
    expect((style.maxWidth as number) / (style.aspectRatio as number)).toBeCloseTo(640);
  });

  it("uses the smaller of maxWidth and maxHeight * ratio", () => {
    expect(mediaFrameStyle({ aspectRatio: 2, maxHeight: 100, maxWidth: 150 }).maxWidth).toBe(150);
    expect(mediaFrameStyle({ aspectRatio: 2, maxHeight: 100, maxWidth: 500 }).maxWidth).toBe(200);
  });

  it("applies maxWidth alone", () => {
    expect(mediaFrameStyle({ aspectRatio: 1, maxWidth: 320 }).maxWidth).toBe(320);
  });

  it("sets no max when neither is given", () => {
    expect(mediaFrameStyle({ aspectRatio: 1 })).not.toHaveProperty("maxWidth");
  });

  it("ignores a max that is not positive and finite", () => {
    const style = mediaFrameStyle({ aspectRatio: 1, maxWidth: 0, maxHeight: Number.NaN });
    expect(style).not.toHaveProperty("maxWidth");
  });

  it("accepts every ratio form", () => {
    expect(mediaFrameStyle({ aspectRatio: { width: 4, height: 2 } }).aspectRatio).toBe(2);
    expect(mediaFrameStyle({ aspectRatio: 2 }).aspectRatio).toBe(2);
  });

  it("leaves sizing to the caller without a usable ratio, keeping only the maxes", () => {
    expect(mediaFrameStyle({})).toEqual({});
    expect(mediaFrameStyle({ aspectRatio: "nope" as `${number}:${number}` })).toEqual({});
    expect(mediaFrameStyle({ maxWidth: 300, maxHeight: 200 })).toEqual({ maxWidth: 300, maxHeight: 200 });
  });

  it("takes no argument", () => {
    expect(mediaFrameStyle()).toEqual({});
  });
});

describe("useMediaAspectRatio", () => {
  it("an explicit ratio wins and ignores natural-size reports", async () => {
    const { result } = await renderHook(() => useMediaAspectRatio("4:3", 16 / 9));
    expect(result.current.ratio).toBeCloseTo(4 / 3);

    await act(async () => result.current.reportNaturalSize(1080, 1920));
    expect(result.current.ratio).toBeCloseTo(4 / 3);
  });

  it("accepts a number and a { width, height } pair", async () => {
    const numeric = await renderHook(() => useMediaAspectRatio(2, 1));
    expect(numeric.result.current.ratio).toBe(2);

    const pair = await renderHook(() => useMediaAspectRatio({ width: 3, height: 1 }, 1));
    expect(pair.result.current.ratio).toBe(3);
  });

  it("draws a malformed explicit ratio at the fallback", async () => {
    const { result } = await renderHook(() => useMediaAspectRatio("wide" as `${number}:${number}`, 1.25));
    expect(result.current.ratio).toBe(1.25);
  });

  it("undefined leaves sizing to the caller", async () => {
    const { result } = await renderHook(() => useMediaAspectRatio(undefined, 16 / 9));
    expect(result.current.ratio).toBeUndefined();

    await act(async () => result.current.reportNaturalSize(100, 100));
    expect(result.current.ratio).toBeUndefined();
  });

  it('"auto" starts at the fallback and switches to the natural size once', async () => {
    const { result } = await renderHook(() => useMediaAspectRatio("auto", 16 / 9));
    expect(result.current.ratio).toBeCloseTo(16 / 9);

    await act(async () => result.current.reportNaturalSize(1080, 1920));
    expect(result.current.ratio).toBeCloseTo(9 / 16);

    // A later report (a second source, a rotation) does not move the frame again.
    await act(async () => result.current.reportNaturalSize(1920, 1080));
    expect(result.current.ratio).toBeCloseTo(9 / 16);
  });

  it('"auto" ignores zero, negative and non-finite sizes', async () => {
    const { result } = await renderHook(() => useMediaAspectRatio("auto", 1.5));

    await act(async () => {
      result.current.reportNaturalSize(0, 100);
      result.current.reportNaturalSize(100, 0);
      result.current.reportNaturalSize(Number.NaN, 100);
      result.current.reportNaturalSize(100, Number.NaN);
      result.current.reportNaturalSize(-10, 100);
      result.current.reportNaturalSize(Number.POSITIVE_INFINITY, 100);
    });
    expect(result.current.ratio).toBe(1.5);

    // The first usable report still counts after the ignored ones.
    await act(async () => result.current.reportNaturalSize(200, 100));
    expect(result.current.ratio).toBe(2);
  });

  it("keeps reportNaturalSize stable across renders", async () => {
    const { result, rerender } = await renderHook(() => useMediaAspectRatio("auto", 1));
    const first = result.current.reportNaturalSize;

    await rerender(undefined);
    expect(result.current.reportNaturalSize).toBe(first);
  });
});
