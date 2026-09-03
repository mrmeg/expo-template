import { calculateDimensions, formatFileSize, longEdgeOf } from "../utils";

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

  describe("longEdgeOf", () => {
    it("returns the longer edge either way round", () => {
      expect(longEdgeOf(4000, 3000)).toBe(4000);
      expect(longEdgeOf(3000, 4000)).toBe(4000);
      expect(longEdgeOf(1024, 1024)).toBe(1024);
    });

    it("treats missing dimensions as zero rather than negative", () => {
      expect(longEdgeOf(0, 0)).toBe(0);
      expect(longEdgeOf(-10, 0)).toBe(0);
      expect(longEdgeOf(-10, 800)).toBe(800);
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
