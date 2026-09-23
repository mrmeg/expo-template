/**
 * Dialog / AlertDialog presentation tests
 *
 * iOS presents dialog content through a transparent React Native `Modal`,
 * rendered inline where the dialog sits in the tree, instead of through the
 * portal host inside react-native-screens' `FullWindowOverlay`. The overlay put its
 * container straight under the `UIWindow`, where `expo-modules-core`'s SwiftUI
 * hosting view finds no parent view controller and drops the SwiftUI view, so
 * every `@expo/ui`-hosted control inside a dialog (`TextInput`, `Slider`,
 * `SegmentedControl`) rendered as an empty box and could not take focus. The
 * `Modal` presents a real view controller from the screen, native stack modal
 * or sheet that contains the dialog (a portal-hosted `Modal` would present from
 * the root controller and fail while a native stack modal is up), and because
 * it sits outside `UIProvider`'s root keyboard avoidance the dialog owns
 * keyboard avoidance inside it. Android and web keep the portal-host tree (no
 * `Modal`); Android also owns keyboard avoidance there, because the portal host
 * sits outside the root avoidance and keyboard-controller observes the main
 * window's IME, while web has no software keyboard and no avoidance owner.
 *
 * Jest has no native tree, so these tests lock the React structure: which
 * presenter each platform renders, that a field inside `DialogContent` is
 * reachable and reports focus, and that the platform close request reaches the
 * root's `onOpenChange`.
 */

import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { KeyboardController } from "react-native-keyboard-controller";
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
import { markTextInputTouchStart } from "../keyboardDismiss";
import {
  clearKeyboardFocusedInput,
  hasKeyboardFocusedInput,
  setKeyboardFocusedInput,
} from "../keyboardFocusRegistry";

const keyboardControllerMock = jest.requireMock("react-native-keyboard-controller");

type TouchEvent = { nativeEvent: Record<string, number | string> };
type Boundary = { props: Record<string, (event?: TouchEvent) => unknown> };

let nextTimestamp = 5000;

/** Same shape as BottomSheet.test.tsx: a single-finger touch at (50, 60). */
function touch(overrides: TouchEvent["nativeEvent"] = {}): TouchEvent {
  nextTimestamp += 16;
  return {
    nativeEvent: { identifier: "0", timestamp: nextTimestamp, pageX: 50, pageY: 60, ...overrides },
  };
}

/**
 * Host views carrying the package tap-away boundary (`useKeyboardDismissResponder`):
 * the plain touch handlers without Pressability's responder-grant handlers.
 * Callers render inside one wrapping `View` so `root` spans the dialog and the
 * sibling `PortalHost` that Android and web render dialog content into.
 */
function findBoundaries(root: { queryAll: (predicate: (node: any) => boolean) => any[] }) {
  return root.queryAll(
    (node) =>
      typeof node.props.onStartShouldSetResponder === "function" &&
      typeof node.props.onTouchEnd === "function" &&
      node.props.onResponderGrant === undefined
  ) as unknown as Boundary[];
}

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

/**
 * Host views rendered by the keyboard-controller `KeyboardAvoidingView` mock,
 * which passes `behavior` / `keyboardVerticalOffset` straight through to a
 * `View` (the package `KeyboardAvoidingView` renders it on native).
 */
function keyboardAvoidingHostViews() {
  const root = screen.root;
  if (!root) return [];
  return [root, ...root.queryAll(() => true)].filter(
    (node) => node.type === "View" && typeof node.props.behavior === "string"
  );
}

/** Reports whether the package's keyboard-avoidance owner wraps this subtree. */
function AvoidanceProbe() {
  const avoided = useKeyboardAvoidance();
  return <Text>{`avoided:${avoided}`}</Text>;
}

/**
 * Both helpers render inside one host `View` so `screen.root` spans the dialog
 * and the `PortalHost` (RNTL's `root` is the first host node only).
 */
async function renderDialog(onOpenChange = jest.fn(), onFocus = jest.fn()) {
  await render(
    <View>
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent testID="dialog-content">
          <DialogTitle>Start trip</DialogTitle>
          <TextInput label="Starting odometer" placeholder="0" onFocus={onFocus} />
          <AvoidanceProbe />
        </DialogContent>
      </Dialog>
      <PortalHost />
    </View>
  );
  return { onOpenChange, onFocus };
}

async function renderAlertDialog(onOpenChange = jest.fn()) {
  await render(
    <View>
      <AlertDialog open onOpenChange={onOpenChange}>
        <AlertDialogContent testID="alert-content">
          <AlertDialogTitle>Delete project?</AlertDialogTitle>
          <AvoidanceProbe />
        </AlertDialogContent>
      </AlertDialog>
      <PortalHost />
    </View>
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

  it("presents inline without a PortalHost mounted", async () => {
    await render(
      <Dialog open onOpenChange={jest.fn()}>
        <DialogContent testID="dialog-content">
          <DialogTitle>Inline</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    expect(screen.getByTestId("rn-modal")).toBeTruthy();
    expect(screen.getByText("Inline")).toBeTruthy();
  });

  it("renders nothing while closed", async () => {
    await render(
      <Dialog open={false} onOpenChange={jest.fn()}>
        <DialogContent testID="dialog-content">
          <DialogTitle>Closed</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    expect(screen.queryByTestId("rn-modal")).toBeNull();
    expect(screen.queryByText("Closed")).toBeNull();
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

describe.each([
  ["android", true],
  ["web", false],
] as const)("%s", (os, avoided) => {
  beforeEach(() => {
    Platform.OS = os;
  });

  it(`renders DialogContent inline in the portal host with no Modal (avoidance owner: ${avoided})`, async () => {
    await renderDialog();

    expect(screen.queryByTestId("rn-modal")).toBeNull();
    expect(screen.getByTestId("dialog-content")).toBeTruthy();
    expect(screen.getByText("Start trip")).toBeTruthy();
    expect(screen.getByText(`avoided:${avoided}`)).toBeTruthy();
  });

  it("renders only into a portal host", async () => {
    await render(
      <Dialog open onOpenChange={jest.fn()}>
        <DialogContent testID="dialog-content">
          <DialogTitle>Portal only</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    expect(screen.queryByTestId("rn-modal")).toBeNull();
    expect(screen.queryByText("Portal only")).toBeNull();
  });

  it(`renders AlertDialogContent inline with no Modal (avoidance owner: ${avoided})`, async () => {
    await renderAlertDialog();

    expect(screen.queryByTestId("rn-modal")).toBeNull();
    expect(screen.getByText("Delete project?")).toBeTruthy();
    expect(screen.getByText(`avoided:${avoided}`)).toBeTruthy();
  });
});

describe("Android keyboard avoidance", () => {
  beforeEach(() => {
    Platform.OS = "android";
  });

  it("wraps the centered container in the package KeyboardAvoidingView inside the portal host", async () => {
    await renderDialog();

    const avoidingViews = keyboardAvoidingHostViews();
    expect(avoidingViews).toHaveLength(1);
    expect(avoidingViews[0].props).toMatchObject({ behavior: "padding", keyboardVerticalOffset: 0 });
    expect(avoidingViews[0].queryAll((node) => node.props.testID === "dialog-content")).toHaveLength(1);
    expect(screen.queryByTestId("rn-modal")).toBeNull();
    expect(screen.getByText("avoided:true")).toBeTruthy();
  });

  it("wraps AlertDialogContent the same way", async () => {
    await renderAlertDialog();

    const avoidingViews = keyboardAvoidingHostViews();
    expect(avoidingViews).toHaveLength(1);
    expect(avoidingViews[0].props).toMatchObject({ behavior: "padding", keyboardVerticalOffset: 0 });
    expect(avoidingViews[0].queryAll((node) => node.props.testID === "alert-content")).toHaveLength(1);
    expect(screen.queryByTestId("rn-modal")).toBeNull();
    expect(screen.getByText("avoided:true")).toBeTruthy();
  });

  it("keeps a TextInput inside DialogContent reachable and focusable", async () => {
    const { onFocus } = await renderDialog();

    const input = screen.getByPlaceholderText("0");
    fireEvent(input, "focus");
    expect(onFocus).toHaveBeenCalled();
  });
});

describe("keyboard dismiss boundary", () => {
  const token = {};

  beforeEach(() => {
    keyboardControllerMock.__setKeyboardState({ isVisible: true, target: 12 });
  });

  afterEach(() => {
    clearKeyboardFocusedInput(token);
    keyboardControllerMock.__setKeyboardState({ isVisible: false, target: -1 });
  });

  async function setup(kind: "dialog" | "alert" = "dialog") {
    const blur = jest.fn();
    setKeyboardFocusedInput(token, blur);
    const onPress = jest.fn();
    const control = (
      <Pressable testID="control" onPress={onPress}>
        <Text>Save</Text>
      </Pressable>
    );
    const result = await render(
      <View>
        {kind === "dialog" ? (
          <Dialog open onOpenChange={jest.fn()}>
            <DialogContent testID="dialog-content">
              <DialogTitle>Start trip</DialogTitle>
              {control}
            </DialogContent>
          </Dialog>
        ) : (
          <AlertDialog open onOpenChange={jest.fn()}>
            <AlertDialogContent testID="alert-content">
              <AlertDialogTitle>Delete project?</AlertDialogTitle>
              {control}
            </AlertDialogContent>
          </AlertDialog>
        )}
        <PortalHost />
      </View>
    );
    const boundaries = findBoundaries(result.root!);
    expect(boundaries).toHaveLength(1);
    return { blur, onPress, boundary: boundaries[0] };
  }

  it("mounts one boundary on the Dialog card and keeps the primitive's claim on it", async () => {
    const { boundary } = await setup();

    // `@rn-primitives/dialog`'s native Content claims every touch that reaches
    // it (so the overlay Pressable's closeOnPress never fires for a tap inside
    // the card), which ends the bubble negotiation before any ancestor is
    // asked: a boundary on the centered container never armed (Pixel 6a,
    // dead-space taps left the keyboard up). The boundary is the card itself
    // and still answers true.
    expect(boundary.props.testID).toBe("dialog-content");
    expect(boundary.props.role).toBe("dialog");
    expect(boundary.props.onStartShouldSetResponder(touch())).toBe(true);
    expect(screen.queryByLabelText("Dismiss keyboard")).toBeNull();
  });

  it("dismisses an unclaimed dead-space tap on release and drops focus presence", async () => {
    const { boundary, blur } = await setup();
    const start = touch();

    expect(boundary.props.onStartShouldSetResponder(start)).toBe(true);
    boundary.props.onTouchStart(start);
    expect(blur).not.toHaveBeenCalled();
    expect(hasKeyboardFocusedInput()).toBe(true);

    boundary.props.onTouchEnd(touch());

    expect(blur).toHaveBeenCalledTimes(1);
    expect(hasKeyboardFocusedInput()).toBe(false);
    expect(KeyboardController.dismiss).not.toHaveBeenCalled();
  });

  it("does not dismiss a tap that travels 12 units before release", async () => {
    const { boundary, blur } = await setup();
    const start = touch();

    boundary.props.onStartShouldSetResponder(start);
    boundary.props.onTouchStart(start);
    boundary.props.onTouchMove(touch({ pageY: 72 }));
    boundary.props.onTouchEnd(touch({ pageY: 72 }));

    expect(blur).not.toHaveBeenCalled();
    expect(hasKeyboardFocusedInput()).toBe(true);
  });

  it("does not dismiss a touch a control claimed, so the control fires on the first tap", async () => {
    const { boundary, blur, onPress } = await setup();
    // A claiming child (the Pressable) ends the bubble negotiation before the
    // boundary is asked; only the plain touch events still bubble up to it.
    const start = touch();
    boundary.props.onTouchStart(start);
    await fireEvent.press(screen.getByTestId("control"));
    boundary.props.onTouchEnd(touch());

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(blur).not.toHaveBeenCalled();
    expect(hasKeyboardFocusedInput()).toBe(true);
  });

  it("leaves a tap that began on a package TextInput surface alone", async () => {
    const { boundary, blur } = await setup();
    const start = touch();

    // The field's surface tags the touch before the boundary is asked.
    markTextInputTouchStart(start as never);
    expect(boundary.props.onStartShouldSetResponder(start)).toBe(true);
    boundary.props.onTouchStart(start);
    boundary.props.onTouchEnd(touch());

    expect(blur).not.toHaveBeenCalled();
    expect(hasKeyboardFocusedInput()).toBe(true);
  });

  it("arms from focus-registry presence alone when keyboard-controller reports no keyboard", async () => {
    keyboardControllerMock.__setKeyboardState({ isVisible: false, target: -1 });
    const { boundary, blur } = await setup();
    const start = touch();

    boundary.props.onStartShouldSetResponder(start);
    boundary.props.onTouchStart(start);
    boundary.props.onTouchEnd(touch());

    expect(blur).toHaveBeenCalledTimes(1);
  });

  it("mounts the same boundary on AlertDialogContent's centered container, never claiming", async () => {
    const { boundary, blur } = await setup("alert");
    const start = touch();

    // The alert primitive's Content claims nothing, so the container boundary
    // is asked for every unclaimed tap inside and around the card.
    expect(boundary.props.testID).toBeUndefined();
    expect(boundary.props.onStartShouldSetResponder(start)).toBe(false);
    boundary.props.onTouchStart(start);
    boundary.props.onTouchEnd(touch());

    expect(blur).toHaveBeenCalledTimes(1);
  });

  it("mounts the boundary on Android too", async () => {
    Platform.OS = "android";
    const { boundary, blur } = await setup();
    const start = touch();

    boundary.props.onStartShouldSetResponder(start);
    boundary.props.onTouchStart(start);
    boundary.props.onTouchEnd(touch());

    expect(blur).toHaveBeenCalledTimes(1);
  });

  it("mounts no boundary on web, which has no software keyboard", async () => {
    Platform.OS = "web";
    setKeyboardFocusedInput(token, jest.fn());
    const result = await render(
      <View>
        <Dialog open onOpenChange={jest.fn()}>
          <DialogContent testID="dialog-content">
            <DialogTitle>Start trip</DialogTitle>
          </DialogContent>
        </Dialog>
        <PortalHost />
      </View>
    );

    expect(screen.getByText("Start trip")).toBeTruthy();
    expect(findBoundaries(result.root!)).toHaveLength(0);
  });
});
