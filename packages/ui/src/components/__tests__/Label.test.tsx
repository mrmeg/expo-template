/**
 * Label association tests.
 *
 * The pairing contract has two *different* ids and they must not collide:
 *
 * - `nativeID` identifies the label element itself. On web react-native-web
 *   maps it onto the wrapper's `id`, which is what an input's `aria-labelledby`
 *   points at; on native it's the `nativeID` an input's
 *   `accessibilityLabelledBy` references.
 * - `htmlFor` is the *input's* id. Only `@rn-primitives/label`'s web build
 *   consumes it — it switches the Radix label from `asChild` to a real
 *   `<label for=…>` element — and the primitive declares it on `TextProps`,
 *   not `RootProps`, so that's the slot it has to be forwarded to.
 *
 * The bug these tests pin: the previously documented pattern put the *same*
 * `nativeID` on the Label and its TextInput, which renders two elements with
 * one id on web and produces no label/input association at all.
 *
 * `@rn-primitives/label` is mocked so the assertions read the props Label hands
 * to the primitive. Under Jest, module resolution follows the jest-expo preset
 * rather than the runtime `Platform.OS`, so the real import here would be the
 * *native* build — which spreads unknown props straight onto RN `Text` and so
 * would "pass" whether or not the value ever reached a web `<label for>`.
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";

import { Label } from "../Label";

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      dark: false,
      colors: { text: "#111111", destructive: "#dc2626" },
    },
  }),
}));

/** Props handed to `LabelPrimitive.Root` / `.Text` on the latest render. */
const mockPrimitiveProps: {
  root: Record<string, unknown>;
  text: Record<string, unknown>;
} = { root: {}, text: {} };

type MockPrimitiveProps = {
  children?: React.ReactNode;
  nativeID?: string;
  htmlFor?: string;
};

jest.mock("@rn-primitives/label", () => {
  const ReactModule = require("react");
  const { Text: RNText, View } = require("react-native");
  return {
    Root: ({ children, ...props }: MockPrimitiveProps) => {
      mockPrimitiveProps.root = props;
      return ReactModule.createElement(View, { nativeID: props.nativeID }, children);
    },
    Text: ({ children, ...props }: MockPrimitiveProps) => {
      mockPrimitiveProps.text = props;
      return ReactModule.createElement(RNText, { nativeID: props.nativeID }, children);
    },
  };
});

/**
 * Every `nativeID`/`id` on a host element in the rendered tree. `screen.root`
 * is already the host tree in RNTL 14, so every visited node is an element the
 * platform renders — exactly the set that could collide on an id.
 */
function collectElementIds(node: TestInstance | null): string[] {
  const ids: string[] = [];
  const walk = (instance: TestInstance | string) => {
    if (typeof instance === "string") return;
    const props = instance.props as { nativeID?: string; id?: string };
    if (props.nativeID) ids.push(props.nativeID);
    if (props.id) ids.push(props.id);
    for (const child of instance.children) walk(child);
  };
  if (node) walk(node);
  return ids;
}

beforeEach(() => {
  mockPrimitiveProps.root = {};
  mockPrimitiveProps.text = {};
});

describe("Label association props", () => {
  it("forwards htmlFor to the primitive's Text, where the web build reads it", async () => {
    await render(
      <Label nativeID="email-label" htmlFor="email-input">
        Email
      </Label>,
    );

    expect(mockPrimitiveProps.text.htmlFor).toBe("email-input");
  });

  it("keeps nativeID as the label's own id, distinct from htmlFor", async () => {
    await render(
      <Label nativeID="email-label" htmlFor="email-input">
        Email
      </Label>,
    );

    expect(mockPrimitiveProps.root.nativeID).toBe("email-label");
    // htmlFor is not part of the primitive's RootProps; putting it on the
    // Pressable would leak an invalid attribute and still not associate.
    expect(mockPrimitiveProps.root.htmlFor).toBeUndefined();
    // The label's own id must not be duplicated onto the inner Text, or the web
    // build emits both the wrapper and the <label> carrying the same id.
    expect(mockPrimitiveProps.text.nativeID).toBeUndefined();
  });

  it("passes no htmlFor when the label is not paired with an input", async () => {
    await render(<Label nativeID="standalone">Standalone</Label>);

    expect(mockPrimitiveProps.text.htmlFor).toBeUndefined();
  });

  it("renders each id exactly once in the tree", async () => {
    await render(
      <Label nativeID="email-label" htmlFor="email-input">
        Email
      </Label>,
    );

    const ids = collectElementIds(screen.root);
    expect(ids).toEqual(["email-label"]);
  });

  it("still renders the text and the required marker alongside the new prop", async () => {
    await render(
      <Label nativeID="password-label" htmlFor="password-input" required>
        Password
      </Label>,
    );

    expect(screen.getByText(/^Password \*$/)).toBeTruthy();
  });
});
