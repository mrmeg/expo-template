/**
 * TextInput on web: the field is named from `label` and described by the
 * helper/error text through `aria-describedby`. `./forceWebPlatform` must be the
 * first import so `Platform.OS` is "web" before the component graph loads.
 */
import "./forceWebPlatform";
import "@/test/mockTheme";

import React from "react";
import { render, screen } from "@testing-library/react-native";
import { TextInput } from "../TextInput";

// The error icon is irrelevant here, and react-native-svg warns about the web
// build's `var(--c-*)` stroke colors under Jest.
jest.mock("../Icon", () => ({ ...jest.requireActual("../Icon"), Icon: () => null }));

const mockHydrated = jest.fn(() => true);
jest.mock("../../hooks/useHydrated", () => ({ useHydrated: () => mockHydrated() }));

describe("TextInput on web", () => {
  beforeEach(() => {
    mockHydrated.mockReturnValue(true);
  });

  it("names the input from label", async () => {
    await render(<TextInput label="Email" placeholder="Email address" />);

    expect(screen.getByPlaceholderText("Email address").props.accessibilityLabel).toBe("Email");
  });

  it("lets a consumer's accessibilityLabel win over label", async () => {
    await render(<TextInput label="Email" accessibilityLabel="Work email" placeholder="Email address" />);

    expect(screen.getByPlaceholderText("Email address").props.accessibilityLabel).toBe("Work email");
  });

  it("passes no accessibilityHint (react-native-web would drop it)", async () => {
    await render(
      <TextInput label="Email" helperText="We never share it" errorText="Email is required" placeholder="Email address" />
    );

    expect(screen.getByPlaceholderText("Email address").props).not.toHaveProperty("accessibilityHint");
  });

  it("links the error text to the input with aria-describedby once hydrated", async () => {
    await render(<TextInput label="Email" errorText="Email is required" placeholder="Email address" />);

    const input = screen.getByPlaceholderText("Email address");
    const error = screen.getByText("Email is required");
    expect(error.props.nativeID).toBeTruthy();
    expect(input.props["aria-describedby"]).toBe(error.props.nativeID);
  });

  it("describes the input with helperText when there is no errorText", async () => {
    await render(<TextInput label="Password" helperText="At least 8 characters" placeholder="Password" />);

    const helper = screen.getByText("At least 8 characters");
    expect(helper.props.nativeID).toBeTruthy();
    expect(screen.getByPlaceholderText("Password").props["aria-describedby"]).toBe(helper.props.nativeID);
  });

  it("builds the description id on the consumer's nativeID", async () => {
    await render(
      <TextInput nativeID="signup-email" label="Email" errorText="Email is required" placeholder="Email address" />
    );

    const input = screen.getByPlaceholderText("Email address");
    expect(screen.getByText("Email is required").props.nativeID).toBe("signup-email-desc");
    expect(input.props["aria-describedby"]).toBe("signup-email-desc");
    expect(input.props.nativeID).toBe("signup-email");
  });

  it("keeps a consumer's own aria-describedby alongside the description", async () => {
    await render(
      <TextInput
        nativeID="signup-email"
        aria-describedby="form-hint"
        errorText="Email is required"
        placeholder="Email address"
      />
    );

    expect(screen.getByPlaceholderText("Email address").props["aria-describedby"]).toBe(
      "form-hint signup-email-desc"
    );
  });

  it("emits neither id before hydration, where useId values differ from the server's", async () => {
    mockHydrated.mockReturnValue(false);
    await render(<TextInput label="Email" errorText="Email is required" placeholder="Email address" />);

    expect(screen.getByText("Email is required").props.nativeID).toBeUndefined();
    expect(screen.getByPlaceholderText("Email address").props["aria-describedby"]).toBeUndefined();
    // The name does not depend on an id, so it is present from the server render on.
    expect(screen.getByPlaceholderText("Email address").props.accessibilityLabel).toBe("Email");
  });

  it("keeps the described-by element in the accessibility tree", async () => {
    await render(<TextInput label="Email" errorText="Email is required" required placeholder="Email address" />);

    // `aria-describedby` needs a referenceable element, so nothing hides it on web
    // (the native path hides its copy because the field's hint carries the text).
    const error = screen.getByText("Email is required");
    expect(error.props.nativeID).toBeTruthy();
    expect(error.parent?.props.accessibilityElementsHidden).toBeFalsy();
    expect(error.parent?.props.importantForAccessibility).not.toBe("no-hide-descendants");
    expect(error.props["aria-hidden"]).toBeFalsy();
    expect(error.props.accessibilityElementsHidden).toBeFalsy();
    expect(error.props.importantForAccessibility).not.toBe("no-hide-descendants");
  });

  it("states required with aria-required and leaves the name and description plain", async () => {
    await render(<TextInput label="Email" helperText="We never share it" required placeholder="Email address" />);

    const input = screen.getByPlaceholderText("Email address");
    expect(input.props["aria-required"]).toBe(true);
    expect(input.props.accessibilityLabel).toBe("Email");
    expect(input.props).not.toHaveProperty("accessibilityHint");
    expect(screen.getByText("We never share it")).toBeTruthy();
  });

  it("emits no description id without helper or error text", async () => {
    await render(<TextInput label="Email" placeholder="Email address" />);

    expect(screen.getByPlaceholderText("Email address").props["aria-describedby"]).toBeUndefined();
  });
});
