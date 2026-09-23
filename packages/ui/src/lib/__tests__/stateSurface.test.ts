import { Platform } from "react-native";
import { stateSurfaceProps } from "../stateSurface";

describe("stateSurfaceProps", () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("pins collapsable={false} on Android", () => {
    Platform.OS = "android";
    expect(stateSurfaceProps()).toEqual({ collapsable: false });
  });

  it("adds nothing on iOS", () => {
    Platform.OS = "ios";
    expect(stateSurfaceProps()).toEqual({});
  });

  it("adds nothing on web", () => {
    Platform.OS = "web";
    expect(stateSurfaceProps()).toEqual({});
  });

  it("reads the platform at call time", () => {
    Platform.OS = "ios";
    expect(stateSurfaceProps()).toEqual({});
    Platform.OS = "android";
    expect(stateSurfaceProps()).toEqual({ collapsable: false });
  });
});
