import { createPickedAssetId } from "../assetId";

describe("createPickedAssetId", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns unique ids", () => {
    const ids = new Set(Array.from({ length: 200 }, () => createPickedAssetId()));

    expect(ids.size).toBe(200);
  });

  it("falls back to time, counter, and entropy when the host has no crypto (Hermes)", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    try {
      const first = createPickedAssetId();
      const second = createPickedAssetId();

      expect(first).toMatch(/^[0-9a-z]+-[0-9a-z]+-[0-9a-f]+$/);
      expect(second).not.toBe(first);
    } finally {
      if (original) Object.defineProperty(globalThis, "crypto", original);
      else delete (globalThis as { crypto?: unknown }).crypto;
    }
  });
});
