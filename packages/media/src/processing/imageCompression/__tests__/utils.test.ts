import {
  shouldContinueCompression,
  shouldUseProcessedFile,
  shouldUseCompressedImage,
} from "../utils";

describe("image compression utilities", () => {
  describe("shouldContinueCompression", () => {
    it("stops when no max size is configured", () => {
      expect(shouldContinueCompression(2_000, null, 0.8, 0.6)).toBe(false);
    });

    it("stops when quality reaches the configured floor", () => {
      expect(shouldContinueCompression(2_000, 1, 0.6, 0.6)).toBe(false);
    });

    it("continues while over the target and above the quality floor", () => {
      expect(shouldContinueCompression(2_000, 1, 0.8, 0.6)).toBe(true);
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
});
