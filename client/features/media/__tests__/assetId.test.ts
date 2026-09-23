/**
 * `createAssetId` is platform-split so `expo-crypto` stays out of the web
 * bundle: the web build calls `globalThis.crypto.randomUUID()` (which is all
 * `expo-crypto`'s web build does), native keeps `expo-crypto`.
 */
import { readFileSync } from "fs";
import { join } from "path";

const mockRandomUUID = jest.fn(() => "native-uuid");

jest.mock("expo-crypto", () => ({
  randomUUID: () => mockRandomUUID(),
}));

describe("createAssetId", () => {
  it("uses Web Crypto on web without importing expo-crypto", () => {
    const source = readFileSync(join(__dirname, "..", "assetId.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["']expo-crypto["']|require\(\s*["']expo-crypto["']/);

    const randomUUID = jest
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValue("00000000-0000-4000-8000-000000000000");
    // The explicit file: under Jest's native platform `../assetId` is the
    // `.native.ts` twin.
    const { createAssetId } = require("../assetId.ts") as typeof import("../assetId");

    expect(createAssetId()).toBe("00000000-0000-4000-8000-000000000000");
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(mockRandomUUID).not.toHaveBeenCalled();
  });

  it("uses expo-crypto on native", () => {
    const { createAssetId } = require("../assetId.native") as typeof import("../assetId.native");

    expect(createAssetId()).toBe("native-uuid");
    expect(mockRandomUUID).toHaveBeenCalledTimes(1);
  });

  it("is what the media library hook imports", () => {
    const hook = readFileSync(join(__dirname, "..", "hooks", "useMediaLibrary.ts"), "utf8");
    expect(hook).toMatch(/import \{ createAssetId \} from "\.\.\/assetId";/);
    expect(hook).not.toMatch(/expo-crypto/);
  });
});
