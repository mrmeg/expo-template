import {
  calculateDimensions,
  formatFileSize,
  getMimeType,
  reduceQuality,
  shouldContinueCompression,
  shouldUseProcessedFile,
  shouldUseCompressedImage,
} from "../utils";

describe("image compression utilities", () => {
  describe("calculateDimensions", () => {
    it("returns original dimensions when no maxDimension is set", () => {
      expect(calculateDimensions(4000, 3000, null)).toEqual({
        targetWidth: 4000,
        targetHeight: 3000,
      });
    });

    it("returns original dimensions when image is smaller than maxDimension", () => {
      expect(calculateDimensions(800, 600, 2048)).toEqual({
        targetWidth: 800,
        targetHeight: 600,
      });
    });

    it("scales down landscape images correctly", () => {
      expect(calculateDimensions(4000, 3000, 2048)).toEqual({
        targetWidth: 2048,
        targetHeight: 1536,
      });
    });

    it("scales down portrait images correctly", () => {
      expect(calculateDimensions(3000, 4000, 2048)).toEqual({
        targetWidth: 1536,
        targetHeight: 2048,
      });
    });

    it("scales down square images correctly", () => {
      expect(calculateDimensions(4000, 4000, 1024)).toEqual({
        targetWidth: 1024,
        targetHeight: 1024,
      });
    });

    it("handles edge case where width equals maxDimension", () => {
      expect(calculateDimensions(2048, 1536, 2048)).toEqual({
        targetWidth: 2048,
        targetHeight: 1536,
      });
    });

    it("handles edge case where height equals maxDimension", () => {
      expect(calculateDimensions(1536, 2048, 2048)).toEqual({
        targetWidth: 1536,
        targetHeight: 2048,
      });
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
    it("stops when no max size is configured", () => {
      expect(shouldContinueCompression(2_000, null, 0.8, 0.6)).toBe(false);
      expect(shouldContinueCompression(1_000_000, null, 0.8, 0.5)).toBe(false);
    });

    it("stops when the file is already under the target size", () => {
      expect(shouldContinueCompression(400 * 1024, 500, 0.8, 0.5)).toBe(false);
    });

    it("stops when quality reaches the configured floor", () => {
      expect(shouldContinueCompression(2_000, 1, 0.6, 0.6)).toBe(false);
      expect(shouldContinueCompression(600 * 1024, 500, 0.5, 0.5)).toBe(false);
    });

    it("continues while over the target and above the quality floor", () => {
      expect(shouldContinueCompression(2_000, 1, 0.8, 0.6)).toBe(true);
      expect(shouldContinueCompression(600 * 1024, 500, 0.8, 0.5)).toBe(true);
    });

    it("handles exact boundary conditions", () => {
      // File size exactly equals max
      expect(shouldContinueCompression(500 * 1024, 500, 0.8, 0.5)).toBe(false);

      // Quality just above minimum
      expect(shouldContinueCompression(600 * 1024, 500, 0.51, 0.5)).toBe(true);
    });
  });

  describe("shouldUseProcessedFile", () => {
    it("uses processed output when source size is unknown", () => {
      expect(shouldUseProcessedFile(0, 10_000)).toBe(true);
    });

    it("uses processed output only when it is smaller than the source", () => {
      expect(shouldUseProcessedFile(10_000, 9_999)).toBe(true);
      expect(shouldUseProcessedFile(10_000, 10_000)).toBe(false);
      expect(shouldUseProcessedFile(10_000, 12_000)).toBe(false);
    });
  });

  describe("shouldUseCompressedImage", () => {
    it("delegates to the generic processed-file guard", () => {
      expect(shouldUseCompressedImage(10_000, 9_999)).toBe(true);
      expect(shouldUseCompressedImage(10_000, 10_000)).toBe(false);
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
});
