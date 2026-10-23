import {
  MIN_EXPO_UI_57,
  MIN_EXPO_UI_58,
  androidSemanticsHasContentDescription,
  parseExpoUiVersion,
  readExpoUiVersion,
} from "../nativeFieldLabelSupport";

describe("androidSemanticsHasContentDescription", () => {
  it("names the first release of each line that accepts contentDescription", () => {
    expect(MIN_EXPO_UI_57).toEqual({ major: 57, minor: 0, patch: 21 });
    expect(MIN_EXPO_UI_58).toEqual({ major: 58, minor: 0, patch: 8 });
  });

  it.each(["50.0.0", "56.0.21", "56.0.26", "57.0.0", "57.0.4", "57.0.20", "58.0.0", "58.0.7"])(
    "is false below the floor (%s)",
    (version) => {
      expect(androidSemanticsHasContentDescription(version)).toBe(false);
    }
  );

  it.each(["57.0.21", "57.0.23", "57.1.0", "58.0.8", "58.0.16", "58.1.0", "59.0.0", "60.2.1"])(
    "is true at or above the floor (%s)",
    (version) => {
      expect(androidSemanticsHasContentDescription(version)).toBe(true);
    }
  );

  it("reads a pre-release or build suffix as its release", () => {
    expect(androidSemanticsHasContentDescription("58.0.8-canary.1")).toBe(true);
    expect(androidSemanticsHasContentDescription("57.0.20-rc.1")).toBe(false);
  });

  it.each([undefined, null, 58, "", "latest", "58", "58.0", "v58.0.8", "a.b.c"])(
    "is false for an unknown or unparseable version (%p)",
    (version) => {
      expect(androidSemanticsHasContentDescription(version)).toBe(false);
    }
  );
});

describe("parseExpoUiVersion", () => {
  it("parses major, minor and patch", () => {
    expect(parseExpoUiVersion("57.0.21")).toEqual({ major: 57, minor: 0, patch: 21 });
  });
});

describe("readExpoUiVersion", () => {
  it("reads the installed peer's version", () => {
    const installed = (require("@expo/ui/package.json") as { version: string }).version;
    expect(readExpoUiVersion()).toBe(installed);
    expect(parseExpoUiVersion(installed)).toBeDefined();
  });
});
