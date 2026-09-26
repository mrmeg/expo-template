/**
 * Icon accessibility props on web. `./forceWebPlatform` must be the first
 * import (see that file). On web the SVG is a DOM element, so the RN-only
 * accessibility props (`accessible`, `importantForAccessibility`,
 * `accessibilityElementsHidden`) land in the DOM and React warns on every
 * page; the web branch must emit ARIA only.
 */
import "./forceWebPlatform";

import React from "react";
import { View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { Icon } from "../Icon";

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({ theme: { colors: { text: "#111827", accent: "#14B8A6" } } }),
}));

const RN_ONLY = ["accessible", "importantForAccessibility", "accessibilityElementsHidden", "accessibilityLabel"];

function propsOf(element: React.ReactElement, testID: string) {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!.root.findAllByProps({ testID }).filter((n) => n.type === View)[0].props;
}

describe("Icon on web", () => {
  it("hides a decorative icon with aria-hidden only", () => {
    const props = propsOf(<Icon name="mic-off" decorative />, "icon-mic-off");
    expect(props["aria-hidden"]).toBe(true);
    for (const key of RN_ONLY) expect(props).not.toHaveProperty(key);
    expect(props).not.toHaveProperty("role");
  });

  it("exposes a meaningful icon as an image with its label", () => {
    const props = propsOf(<Icon name="mic" accessibilityLabel="Microphone" />, "icon-mic");
    expect(props.role).toBe("img");
    expect(props["aria-label"]).toBe("Microphone");
    for (const key of RN_ONLY) expect(props).not.toHaveProperty(key);
    expect(props).not.toHaveProperty("aria-hidden");
  });

  it("omits aria-label when no label is given", () => {
    const props = propsOf(<Icon name="mic" />, "icon-mic");
    expect(props.role).toBe("img");
    expect(props).not.toHaveProperty("aria-label");
  });

  it("hands a component icon the same web props", () => {
    const Custom = jest.fn((props: any) => <View testID="custom-icon" {...props} />);
    const props = propsOf(<Icon component={Custom} decorative />, "custom-icon");
    expect(props["aria-hidden"]).toBe(true);
    for (const key of RN_ONLY) expect(props).not.toHaveProperty(key);
  });
});
