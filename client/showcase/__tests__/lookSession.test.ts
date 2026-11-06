/**
 * The detail pages hand the app from look to look. Focus and blur arrive in
 * either order and font loads settle later, so only the newest claim may apply
 * or restore.
 */

import { useThemeStore } from "@mrmeg/expo-ui/state";

import { getDemoLook } from "../lookReference";
import type { DemoLook } from "../looks";
import { claimLook } from "../looks/lookSession";

let mockPending: { resolve: () => void }[] = [];
let mockGate = false;

jest.mock("../looks/loadLookFonts", () => ({
  loadLookFonts: jest.fn(() => {
    if (!mockGate) return Promise.resolve();
    return new Promise<void>((resolve) => {
      mockPending.push({ resolve });
    });
  }),
}));

const look = (id: string): DemoLook => {
  const found = getDemoLook(id);
  if (!found) throw new Error(`no look ${id}`);
  return found;
};
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const accent = () => useThemeStore.getState().colorOverrides.light?.accent;

beforeEach(() => {
  mockGate = false;
  mockPending = [];
  useThemeStore.getState().setColors({});
  useThemeStore.getState().setShape({});
  useThemeStore.getState().setTreatments({});
});

describe("claimLook", () => {
  it("applies the look and restores Refined on release", async () => {
    const release = claimLook(look("strand"));
    await flush();
    expect(accent()).toBe("#0a6aa6");

    release();
    expect(useThemeStore.getState().colorOverrides).toEqual({});
    expect(useThemeStore.getState().shapeOverrides).toEqual({});
  });

  it("keeps the new look when the old page blurs after the new one focused", async () => {
    const releaseA = claimLook(look("strand"));
    await flush();
    const releaseB = claimLook(look("glass"));
    releaseA();
    await flush();

    expect(useThemeStore.getState().shapeOverrides.card).toEqual({ borderRadius: 24 });
    releaseB();
    expect(useThemeStore.getState().shapeOverrides).toEqual({});
  });

  it("applies the new look when the old page blurs before the new one focuses", async () => {
    claimLook(look("strand"))();
    expect(useThemeStore.getState().colorOverrides).toEqual({});
    claimLook(look("glass"));
    await flush();

    expect(useThemeStore.getState().shapeOverrides.card).toEqual({ borderRadius: 24 });
  });

  it("does not apply a look whose page was released while its fonts loaded", async () => {
    mockGate = true;
    const release = claimLook(look("classic"));
    release();
    mockPending.forEach((entry) => entry.resolve());
    await flush();

    expect(useThemeStore.getState().colorOverrides).toEqual({});
  });

  it("lets a superseded claim's late font load finish without overriding the newest look", async () => {
    mockGate = true;
    claimLook(look("classic"));
    claimLook(look("strand"));
    // The newest claim settles first, then the stale one lands.
    mockPending[1].resolve();
    await flush();
    mockPending[0].resolve();
    await flush();

    expect(accent()).toBe("#0a6aa6");
    expect(useThemeStore.getState().sansPreset).toBe("geist");
  });
});
