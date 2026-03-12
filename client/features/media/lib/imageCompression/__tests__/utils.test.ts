/**
 * Tests for image compression utility functions.
 */

import {
  calculateDimensions,
  getMimeType,
  reduceQuality,
  shouldContinueCompression,
  formatFileSize,
} from "../utils";

describe("calculateDimensions", () => {
  it("returns original dimensions when no maxDimension is set", () => {
    const result = calculateDimensions(4000, 3000, null);
    expect(result).toEqual({ targetWidth: 4000, targetHeight: 3000 });
  });

  it("returns original dimensions when image is smaller than maxDimension", () => {
    const result = calculateDimensions(800, 600, 2048);
    expect(result).toEqual({ targetWidth: 800, targetHeight: 600 });
  });

  it("scales down landscape images correctly", () => {
    const result = calculateDimensions(4000, 3000, 2048);
    expect(result).toEqual({ targetWidth: 2048, targetHeight: 1536 });
  });

  it("scales down portrait images correctly", () => {
    const result = calculateDimensions(3000, 4000, 2048);
    expect(result).toEqual({ targetWidth: 1536, targetHeight: 2048 });
  });

  it("scales down square images correctly", () => {
    const result = calculateDimensions(4000, 4000, 1024);
    expect(result).toEqual({ targetWidth: 1024, targetHeight: 1024 });
  });

  it("handles edge case where width equals maxDimension", () => {
    const result = calculateDimensions(2048, 1536, 2048);
    expect(result).toEqual({ targetWidth: 2048, targetHeight: 1536 });
  });

  it("handles edge case where height equals maxDimension", () => {
    const result = calculateDimensions(1536, 2048, 2048);
    expect(result).toEqual({ targetWidth: 1536, targetHeight: 2048 });
  });

  it("maintains aspect ratio for extreme ratios", () => {
    // Panorama: 10000 x 2000
    const result = calculateDimensions(10000, 2000, 2048);
    expect(result.targetWidth).toBe(2048);
    expect(result.targetHeight).toBe(410); // Math.round(2048 / 5)
    expect(result.targetWidth / result.targetHeight).toBeCloseTo(10000 / 2000, 1);
  });
});

describe("getMimeType", () => {
  it("returns image/jpeg for jpeg format", () => {
    expect(getMimeType("jpeg")).toBe("image/jpeg");
  });

  it("returns image/png for png format", () => {
    expect(getMimeType("png")).toBe("image/png");
  });

  it("returns image/webp for webp format", () => {
    expect(getMimeType("webp")).toBe("image/webp");
  });

  it("returns image/jpeg for null format (default)", () => {
    expect(getMimeType(null)).toBe("image/jpeg");
  });
});

describe("reduceQuality", () => {
  it("reduces quality by 0.05", () => {
    expect(reduceQuality(0.85)).toBe(0.8);
    expect(reduceQuality(0.8)).toBe(0.75);
    expect(reduceQuality(0.75)).toBe(0.7);
  });

  it("handles floating point precision correctly", () => {
    // 0.9 - 0.05 = 0.85 (not 0.8500000000000001)
    expect(reduceQuality(0.9)).toBe(0.85);
    expect(reduceQuality(0.65)).toBe(0.6);
  });

  it("can go below 0 (caller should check minQuality)", () => {
    expect(reduceQuality(0.03)).toBe(-0.02);
  });
});

describe("shouldContinueCompression", () => {
  it("returns false when maxSizeKB is null", () => {
    expect(shouldContinueCompression(1000000, null, 0.8, 0.5)).toBe(false);
  });

  it("returns false when file size is under target", () => {
    expect(shouldContinueCompression(400 * 1024, 500, 0.8, 0.5)).toBe(false);
  });

  it("returns false when quality has reached minimum", () => {
    expect(shouldContinueCompression(600 * 1024, 500, 0.5, 0.5)).toBe(false);
  });

  it("returns true when file is over target and quality can be reduced", () => {
    expect(shouldContinueCompression(600 * 1024, 500, 0.8, 0.5)).toBe(true);
  });

  it("handles exact boundary conditions", () => {
    // File size exactly equals max
    expect(shouldContinueCompression(500 * 1024, 500, 0.8, 0.5)).toBe(false);

    // Quality just above minimum
    expect(shouldContinueCompression(600 * 1024, 500, 0.51, 0.5)).toBe(true);
  });
});

describe("formatFileSize", () => {
  it("formats bytes to KB for small files", () => {
    expect(formatFileSize(50 * 1024)).toBe("50KB");
    expect(formatFileSize(500 * 1024)).toBe("500KB");
  });

  it("formats bytes to MB for large files", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.00MB");
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.50MB");
  });

  it("rounds KB to whole numbers", () => {
    expect(formatFileSize(50.7 * 1024)).toBe("51KB");
  });

  it("formats MB to 2 decimal places", () => {
    expect(formatFileSize(1.234 * 1024 * 1024)).toBe("1.23MB");
  });

  it("handles zero bytes", () => {
    expect(formatFileSize(0)).toBe("0KB");
  });

  it("handles very small files", () => {
    expect(formatFileSize(100)).toBe("0KB");
  });
});
