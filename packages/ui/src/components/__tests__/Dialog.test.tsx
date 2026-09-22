/**
 * Dialog / AlertDialog presentation tests
 *
 * iOS presents dialog content through a transparent React Native `Modal`
 * instead of react-native-screens' `FullWindowOverlay`. The overlay put its
 * container straight under the `UIWindow`, where `expo-modules-core`'s SwiftUI
 * hosting view finds no parent view controller and drops the SwiftUI view, so
 * every `@expo/ui`-hosted control inside a dialog (`TextInput`, `Slider`,
 * `SegmentedControl`) rendered as an empty box and could not take focus. The
 * `Modal` presents a real view controller (still above native stack modals) and,
 * because it sits outside `UIProvider`'s root keyboard avoidance, the dialog
 * owns keyboard avoidance inside it. Android and web keep the inline portal
 * tree — no `Modal`, no avoidance owner — exactly as before.
 *
 * Jest has no native tree, so these tests lock the React structure: which
 * presenter each platform renders, that a field inside `DialogContent` is
 * reachable and reports focus, and that the platform close request reaches the
 * root's `onOpenChange`.
 */

import React from "react";
import { Platform, Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { PortalHost } from "@rn-primitives/portal";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  Dialog,
  DialogContent,
  DialogTitle,
} from "../Dialog";
import { TextInput } from "../TextInput";
import { useKeyboardAvoidance } from "../KeyboardAvoidingView";

// RNTL 14 has no by-type query, so the native Modal is replaced by a tagged
// View that keeps its props: the tests read them off `rn-modal` and fire
// `requestClose` at it. `react-native`'s `Modal` getter requires this path.
jest.mock("react-native/Libraries/Modal/Modal", () => {
  const React = require("react");
  const { View } = require("react-native");
  function MockModal({ children, ...props }: { children?: React.ReactNode }) {
    return React.createElement(View, { testID: "rn-modal", ...props }, children);
  }
  return { __esModule: true, default: MockModal };
});

jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: "#FFFFFF",
        foreground: "#0F172A",
        card: "#F8FAFC",
        popover: "#FFFFFF",
        popoverForeground: "#0F172A",
        text: "#111111",
        textDim: "#64748B",
        primary: "#14B8A6",
        muted: "#F1F5F9",
        mutedForeground: "#64748B",
        destructive: "#EF4444",
        border: "#E2E8F0",
        input: "#E2E8F0",
        ring: "#A1A1AA",
        overlay: "rgba(0, 0, 0, 0.5)",
      },
    },
    scheme: "light",
    getShadowStyle: () => ({}),
    getFocusRingStyle: () => ({}),
    getContrastingColor: (_bg: string, fg: string) => fg,
  }),
}));

/** Reports whether the package's keyboard-avoidance owner wraps this subtree. */
function AvoidanceProbe() {
  const avoided = useKeyboardAvoidance();
  return <Text>{`avoided:${avoided}`}</Text>;
}

async function renderDialog(onOpenChange = jest.fn(), onFocus = jest.fn()) {
  await render(
    <>
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent testID="dialog-content">
          <DialogTitle>Start trip</DialogTitle>
          <TextInput label="Starting odometer" placeholder="0" onFocus={onFocus} />
          <AvoidanceProbe />
        </DialogContent>
      </Dialog>
      <PortalHost />
    </>
  );
  return { onOpenChange, onFocus };
}

async function renderAlertDialog(onOpenChange = jest.fn()) {
  await render(
    <>
      <AlertDialog open onOpenChange={onOpenChange}>
        <AlertDialogContent testID="alert-content">
          <AlertDialogTitle>Delete project?</AlertDialogTitle>
          <AvoidanceProbe />
        </AlertDialogContent>
      </AlertDialog>
      <PortalHost />
    </>
  );
  return { onOpenChange };
}

const originalOS = Platform.OS;

afterEach(() => {
  Platform.OS = originalOS;
});

describe("iOS", () => {
  beforeEach(() => {
    Platform.OS = "ios";
  });

  it("presents DialogContent through a transparent, unanimated overFullScreen Modal", async () => {
    await renderDialog();

    const modal = screen.getByTestId("rn-modal");
    expect(modal.props).toMatchObject({
      visible: true,
      transparent: true,
      animationType: "none",
      presentationStyle: "overFullScreen",
    });
    expect(modal.props.supportedOrientations).toEqual(
      expect.arrayContaining(["portrait", "landscape"])
    );
    expect(screen.getByTestId("dialog-content")).toBeTruthy();
    expect(screen.getByText("Start trip")).toBeTruthy();
  });

  it("owns keyboard avoidance inside the Modal", async () => {
    await renderDialog();
    expect(screen.getByText("avoided:true")).toBeTruthy();
  });

  it("keeps a TextInput inside DialogContent reachable and focusable", async () => {
    const { onFocus } = await renderDialog();

    const field = screen.getByPlaceholderText("0");
    await fireEvent(field, "focus");
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it("routes the Modal close request to the root onOpenChange", async () => {
    const { onOpenChange } = await renderDialog();

    await fireEvent(screen.getByTestId("rn-modal"), "requestClose");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("presents AlertDialogContent the same way", async () => {
    const { onOpenChange } = await renderAlertDialog();

    const modal = screen.getByTestId("rn-modal");
    expect(modal.props).toMatchObject({
      transparent: true,
      animationType: "none",
      presentationStyle: "overFullScreen",
    });
    expect(screen.getByText("Delete project?")).toBeTruthy();
    expect(screen.getByText("avoided:true")).toBeTruthy();

    await fireEvent(modal, "requestClose");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe.each(["android", "web"] as const)("%s", (os) => {
  beforeEach(() => {
    Platform.OS = os;
  });

  it("renders DialogContent inline in the portal host with no Modal and no avoidance owner", async () => {
    await renderDialog();

    expect(screen.queryByTestId("rn-modal")).toBeNull();
    expect(screen.getByTestId("dialog-content")).toBeTruthy();
    expect(screen.getByText("Start trip")).toBeTruthy();
    expect(screen.getByText("avoided:false")).toBeTruthy();
  });

  it("renders AlertDialogContent inline with no Modal", async () => {
    await renderAlertDialog();

    expect(screen.queryByTestId("rn-modal")).toBeNull();
    expect(screen.getByText("Delete project?")).toBeTruthy();
    expect(screen.getByText("avoided:false")).toBeTruthy();
  });
});
