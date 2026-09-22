import { Platform } from "react-native";
import {
  MIN_EXPO_MODULES_CORE,
  bottomSheetHostDropsResize,
  bottomSheetHostWarning,
  readExpoModulesCoreVersion,
  resetBottomSheetHostWarningForTests,
  warnIfBottomSheetHostDropsResize,
  type ExpoModulesCoreVersion,
} from "../bottomSheetHostSupport";

type ExpoGlobal = { expo?: { expoModulesCoreVersion?: unknown } };

function core(version: string): ExpoModulesCoreVersion {
  const [major, minor, patch] = version.split(".").map(Number);
  return { version, major, minor, patch };
}

function installCore(version: string | undefined) {
  (globalThis as ExpoGlobal).expo =
    version === undefined ? undefined : { expoModulesCoreVersion: core(version) };
}

function setPlatform(os: string) {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
}

describe("bottomSheetHostDropsResize", () => {
  it("names the first core whose RNHostView size flush always lands", () => {
    expect(MIN_EXPO_MODULES_CORE).toEqual({ major: 57, minor: 0, patch: 4 });
  });

  it.each(["57.0.3", "56.0.26", "50.0.0"])("is true below the floor (%s)", (version) => {
    expect(bottomSheetHostDropsResize(core(version))).toBe(true);
  });

  it.each(["57.0.4", "57.0.18", "57.1.0", "58.0.0", "58.0.2"])(
    "is false at or above the floor (%s)",
    (version) => {
      expect(bottomSheetHostDropsResize(core(version))).toBe(false);
    }
  );

  it("does not report an unknown core as broken", () => {
    expect(bottomSheetHostDropsResize(undefined)).toBe(false);
  });
});

describe("readExpoModulesCoreVersion", () => {
  const originalExpo = (globalThis as ExpoGlobal).expo;

  afterEach(() => {
    (globalThis as ExpoGlobal).expo = originalExpo;
  });

  it("reads the native core version the CoreModule publishes on globalThis.expo", () => {
    installCore("57.0.3");
    expect(readExpoModulesCoreVersion()).toEqual(core("57.0.3"));
  });

  it("is undefined without expo-modules-core or with a malformed record", () => {
    installCore(undefined);
    expect(readExpoModulesCoreVersion()).toBeUndefined();

    (globalThis as ExpoGlobal).expo = { expoModulesCoreVersion: { version: "57.0.3" } };
    expect(readExpoModulesCoreVersion()).toBeUndefined();
  });
});

describe("warnIfBottomSheetHostDropsResize", () => {
  const originalExpo = (globalThis as ExpoGlobal).expo;
  const originalPlatform = Platform.OS;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    resetBottomSheetHostWarningForTests();
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    (globalThis as ExpoGlobal).expo = originalExpo;
    setPlatform(originalPlatform);
    resetBottomSheetHostWarningForTests();
  });

  it("warns once on Android when the native core predates the fix", () => {
    setPlatform("android");
    installCore("57.0.3");

    warnIfBottomSheetHostDropsResize();
    warnIfBottomSheetHostDropsResize();

    expect(warn).toHaveBeenCalledTimes(1);
    const message = warn.mock.calls[0][0] as string;
    expect(message).toBe(bottomSheetHostWarning(core("57.0.3")));
    expect(message).toContain("expo-modules-core 57.0.3");
    expect(message).toContain(">= 57.0.4");
    expect(message).toContain("expo/expo#47778");
    expect(message).toContain("rebuild the app");
  });

  it("stays silent on Android once the core carries the fix", () => {
    setPlatform("android");
    for (const version of ["57.0.4", "58.0.2"]) {
      resetBottomSheetHostWarningForTests();
      installCore(version);
      warnIfBottomSheetHostDropsResize();
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it("stays silent on iOS and web, whose sheets do not depend on the host size state", () => {
    installCore("57.0.3");
    for (const os of ["ios", "web"]) {
      resetBottomSheetHostWarningForTests();
      setPlatform(os);
      warnIfBottomSheetHostDropsResize();
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it("stays silent when no native core is loaded", () => {
    setPlatform("android");
    installCore(undefined);
    warnIfBottomSheetHostDropsResize();
    expect(warn).not.toHaveBeenCalled();
  });
});
