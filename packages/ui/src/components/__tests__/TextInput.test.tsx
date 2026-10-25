/**
 * TextInput component tests
 */

import React from "react";
import { AccessibilityInfo } from "react-native";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { TextInput } from "../TextInput";

// Mock useTheme hook
jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: "#FFFFFF",
        foreground: "#0F172A",
        card: "#F8FAFC",
        cardForeground: "#0F172A",
        popover: "#FFFFFF",
        popoverForeground: "#0F172A",
        primary: "#14B8A6",
        primaryForeground: "#FFFFFF",
        secondary: "#6366F1",
        secondaryForeground: "#FFFFFF",
        muted: "#F1F5F9",
        mutedForeground: "#64748B",
        destructive: "#EF4444",
        destructiveForeground: "#FFFFFF",
        success: "#22C55E",
        warning: "#F59E0B",
        border: "#E2E8F0",
        input: "#E2E8F0",
        ring: "#A1A1AA",
        overlay: "rgba(0, 0, 0, 0.5)",
      },
    },
    scheme: "light",
    getShadowStyle: () => ({}),
    getFocusRingStyle: () => ({}),
    getContrastingColor: (bg: string, light: string, dark: string) => {
      return bg === "#FFFFFF" || bg === "transparent" ? dark : light;
    },
  }),
}));

describe("TextInput", () => {
  describe("Rendering", () => {
    it("renders with placeholder", async () => {
      await render(<TextInput placeholder="Enter text" />);

      expect(screen.getByPlaceholderText("Enter text")).toBeTruthy();
    });

    it("renders with label", async () => {
      await render(<TextInput label="Username" placeholder="Enter username" />);

      // The native field carries the label, so the visible text is hidden from
      // assistive tech (see "Accessibility").
      expect(screen.getByText("Username", { includeHiddenElements: true })).toBeTruthy();
    });

    it("renders with value", async () => {
      await render(<TextInput value="Test value" />);

      expect(screen.getByDisplayValue("Test value")).toBeTruthy();
    });
  });

  describe("Interactions", () => {
    it("calls onChangeText when text changes", async () => {
      const onChangeText = jest.fn();

      await render(
        <TextInput
          placeholder="Type here"
          onChangeText={onChangeText}
        />
      );

      await fireEvent.changeText(screen.getByPlaceholderText("Type here"), "Hello");

      expect(onChangeText).toHaveBeenCalledWith("Hello");
    });

    it("calls onFocus when focused", async () => {
      const onFocus = jest.fn();

      await render(<TextInput placeholder="Focus me" onFocus={onFocus} />);

      await fireEvent(screen.getByPlaceholderText("Focus me"), "focus");

      expect(onFocus).toHaveBeenCalled();
    });

    it("calls onBlur when blurred", async () => {
      const onBlur = jest.fn();

      await render(<TextInput placeholder="Blur me" onBlur={onBlur} />);

      await fireEvent(screen.getByPlaceholderText("Blur me"), "blur");

      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe("Secure Text Entry", () => {
    it("hides text when secureTextEntry is true", async () => {
      await render(
        <TextInput
          placeholder="Password"
          secureTextEntry
          value="secret"
        />
      );

      const input = screen.getByPlaceholderText("Password");
      expect(input.props.secureTextEntry).toBe(true);
    });

    it("marks the eye icon decorative — the button already says Show/Hide password", async () => {
      await render(
        <TextInput
          placeholder="Password"
          secureTextEntry
          showSecureEntryToggle
          value=""
          onChangeText={() => {}}
        />
      );

      expect(screen.getByLabelText("Show password")).toBeTruthy();
      // Hidden from the accessibility tree: invisible to the default queries…
      expect(screen.queryByTestId("icon-eye")).toBeNull();
      // …and present with the hiding props when hidden elements are included.
      const eye = screen.getByTestId("icon-eye", { includeHiddenElements: true });
      expect(eye.props["aria-hidden"]).toBe(true);
      expect(eye.props.accessible).toBe(false);
    });

    it("toggles visibility via the secure entry toggle", async () => {
      await render(
        <TextInput
          placeholder="Password"
          secureTextEntry
          showSecureEntryToggle
          value="secret"
        />
      );

      expect(screen.getByPlaceholderText("Password").props.secureTextEntry).toBe(true);

      // Tap the eye button -> reveals the text. On iOS the secure and plain
      // flavours are different views, so re-query after each toggle.
      await fireEvent.press(screen.getByLabelText("Show password"));
      expect(screen.getByPlaceholderText("Password").props.secureTextEntry).toBe(false);

      // Tap again -> hides it. Text persists across the toggle.
      await fireEvent.press(screen.getByLabelText("Hide password"));
      const input = screen.getByPlaceholderText("Password");
      expect(input.props.secureTextEntry).toBe(true);
      expect(input.props.value).toBe("secret");
    });

    it("hands focus to the replacement view before unmounting the focused one (iOS)", async () => {
      await render(
        <TextInput
          placeholder="Password"
          secureTextEntry
          showSecureEntryToggle
          value="secret"
        />
      );

      const secureField = screen.getByPlaceholderText("Password");
      await fireEvent(secureField, "focus");

      // While focused, the toggle mounts the plain view alongside the secure one
      // instead of replacing it, so first responder can hand over.
      await fireEvent.press(screen.getByLabelText("Show password"));
      const fields = screen.getAllByPlaceholderText("Password");
      expect(fields).toHaveLength(2);
      const plainField = fields.find((field) => field.props.secureTextEntry === false);
      expect(plainField).toBeDefined();
      expect(plainField?.props.autoFocus).toBe(true);

      // Once the plain view reports focus, the secure one goes away.
      await fireEvent(plainField!, "focus");
      const remaining = screen.getAllByPlaceholderText("Password");
      expect(remaining).toHaveLength(1);
      expect(remaining[0].props.secureTextEntry).toBe(false);
    });

    it("restores text iOS wipes on the first keystroke after hiding the password", async () => {
      const onChangeText = jest.fn();
      await render(
        <TextInput
          placeholder="Password"
          secureTextEntry
          showSecureEntryToggle
          defaultValue="secret"
          onChangeText={onChangeText}
        />
      );

      // Show (handoff to the plain view), then hide (handoff back to a fresh
      // SecureField).
      await fireEvent(screen.getByPlaceholderText("Password"), "focus");
      await fireEvent.press(screen.getByLabelText("Show password"));
      await fireEvent(
        screen.getAllByPlaceholderText("Password").find((f) => f.props.secureTextEntry === false)!,
        "focus"
      );
      await fireEvent.press(screen.getByLabelText("Hide password"));
      const secureField = screen
        .getAllByPlaceholderText("Password")
        .find((f) => f.props.secureTextEntry === true)!;
      await fireEvent(secureField, "focus");

      // UIKit replaces the whole text with the keystroke; the field puts it back.
      await fireEvent.changeText(secureField, "x");
      expect(onChangeText).toHaveBeenLastCalledWith("secretx");

      // Only the first change after the handoff is eligible.
      await fireEvent.changeText(secureField, "y");
      expect(onChangeText).toHaveBeenLastCalledWith("y");
    });

    it("treats an empty first change after hiding as a backspace on the wiped text", async () => {
      const onChangeText = jest.fn();
      await render(
        <TextInput
          placeholder="Password"
          secureTextEntry
          showSecureEntryToggle
          defaultValue="abc"
          onChangeText={onChangeText}
        />
      );
      await fireEvent(screen.getByPlaceholderText("Password"), "focus");
      await fireEvent.press(screen.getByLabelText("Show password"));
      await fireEvent(
        screen.getAllByPlaceholderText("Password").find((f) => f.props.secureTextEntry === false)!,
        "focus"
      );
      await fireEvent.press(screen.getByLabelText("Hide password"));
      const secureField = screen
        .getAllByPlaceholderText("Password")
        .find((f) => f.props.secureTextEntry === true)!;
      await fireEvent(secureField, "focus");

      // iOS wiped "abc", then the delete key hit nothing.
      await fireEvent.changeText(secureField, "");
      expect(onChangeText).toHaveBeenLastCalledWith("ab");
    });

    it("applies a toggle tapped mid-handoff once the handoff settles", async () => {
      jest.useFakeTimers();
      try {
        await render(
          <TextInput placeholder="Password" secureTextEntry showSecureEntryToggle value="secret" />
        );
        await fireEvent(screen.getByPlaceholderText("Password"), "focus");
        await fireEvent.press(screen.getByLabelText("Show password"));
        // Second tap lands before the plain view has taken focus: deferred.
        await fireEvent.press(screen.getByLabelText("Hide password"));
        expect(screen.getAllByPlaceholderText("Password")).toHaveLength(2);

        const plainField = screen
          .getAllByPlaceholderText("Password")
          .find((f) => f.props.secureTextEntry === false)!;
        await fireEvent(plainField, "focus");
        await act(async () => {
          jest.runOnlyPendingTimers();
        });

        // The queued hide started its own handoff back to a SecureField.
        const fields = screen.getAllByPlaceholderText("Password");
        expect(fields).toHaveLength(2);
        expect(fields.find((f) => f.props.secureTextEntry === true)?.props.autoFocus).toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });

    it("cancels out an even number of taps queued during one handoff", async () => {
      jest.useFakeTimers();
      try {
        await render(
          <TextInput placeholder="Password" secureTextEntry showSecureEntryToggle value="secret" />
        );
        await fireEvent(screen.getByPlaceholderText("Password"), "focus");
        await fireEvent.press(screen.getByLabelText("Show password"));
        await fireEvent.press(screen.getByLabelText("Hide password"));
        await fireEvent.press(screen.getByLabelText("Hide password"));

        const plainField = screen
          .getAllByPlaceholderText("Password")
          .find((f) => f.props.secureTextEntry === false)!;
        await fireEvent(plainField, "focus");
        await act(async () => {
          jest.runOnlyPendingTimers();
        });

        const fields = screen.getAllByPlaceholderText("Password");
        expect(fields).toHaveLength(1);
        expect(fields[0].props.secureTextEntry).toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });

    it("undoes the toggle instead of dropping focus when the replacement never focuses", async () => {
      jest.useFakeTimers();
      try {
        const onBlur = jest.fn();
        await render(
          <TextInput
            placeholder="Password"
            secureTextEntry
            showSecureEntryToggle
            value="secret"
            onBlur={onBlur}
          />
        );
        const secureField = screen.getByPlaceholderText("Password");
        await fireEvent(secureField, "focus");
        await fireEvent.press(screen.getByLabelText("Show password"));
        expect(screen.getAllByPlaceholderText("Password")).toHaveLength(2);

        // No focus event from the plain view: the fallback fires.
        await act(async () => {
          jest.advanceTimersByTime(700);
        });

        const fields = screen.getAllByPlaceholderText("Password");
        expect(fields).toHaveLength(1);
        expect(fields[0].props.secureTextEntry).toBe(true);
        expect(screen.getByLabelText("Show password")).toBeTruthy();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("Disabled State", () => {
    it("is not editable when editable is false", async () => {
      await render(
        <TextInput placeholder="Disabled" editable={false} />
      );

      const input = screen.getByPlaceholderText("Disabled");
      expect(input.props.editable).toBe(false);
    });
  });

  // Jest resolves `nativeTextField.ios.tsx` (jest-expo's default platform), which
  // turns the field's accessibility props into SwiftUI modifiers; the setup mocks
  // record them as `{ name, value }` and forward `modifiers` to an RN TextInput.
  describe("Accessibility (iOS native field)", () => {
    const labelModifier = (value: string) => ({ name: "accessibilityLabel", value });
    const hintModifier = (value: string) => ({ name: "accessibilityHint", value });
    const announce = () => jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("names the field from label and describes it with helperText", async () => {
      await render(<TextInput label="Password" helperText="At least 8 characters" placeholder="Password" />);

      expect(screen.getByPlaceholderText("Password").props.modifiers).toEqual([
        labelModifier("Password"),
        hintModifier("At least 8 characters"),
      ]);
    });

    it("keeps errorText out of the hint, since it is its own element", async () => {
      await render(<TextInput label="Email" errorText="Email is required" placeholder="Email address" />);

      expect(screen.getByPlaceholderText("Email address").props.modifiers).toEqual([labelModifier("Email")]);
    });

    it("shows errorText over helperText, and neither is in the hint then", async () => {
      await render(
        <TextInput label="Email" helperText="We never share it" errorText="Email is required" placeholder="Email address" />
      );

      expect(screen.getByPlaceholderText("Email address").props.modifiers).toEqual([labelModifier("Email")]);
      expect(screen.getByText("Email is required")).toBeTruthy();
      expect(screen.queryByText("We never share it", { includeHiddenElements: true })).toBeNull();
    });

    it("lets a consumer's accessibilityLabel and accessibilityHint win", async () => {
      await render(
        <TextInput
          label="Email"
          helperText="We never share it"
          accessibilityLabel="Work email"
          accessibilityHint="Enter the address you use at work"
          placeholder="Email address"
        />
      );

      expect(screen.getByPlaceholderText("Email address").props.modifiers).toEqual([
        labelModifier("Work email"),
        hintModifier("Enter the address you use at work"),
      ]);
    });

    it("adds no accessibility modifiers without label, helperText, errorText or required", async () => {
      await render(<TextInput placeholder="Search" />);

      expect(screen.getByPlaceholderText("Search").props.modifiers).toEqual([]);
    });

    it("names a secure field too", async () => {
      await render(<TextInput label="Password" secureTextEntry placeholder="Password" />);

      const field = screen.getByPlaceholderText("Password");
      expect(field.props.secureTextEntry).toBe(true);
      expect(field.props.modifiers).toEqual([labelModifier("Password")]);
    });

    it("hides the visible label from assistive tech so it is not read twice", async () => {
      await render(<TextInput label="Email" errorText="Email is required" placeholder="Email address" />);

      expect(screen.queryByText("Email")).toBeNull();
      const label = screen.getByText("Email", { includeHiddenElements: true });
      expect(label).toBeTruthy();
      expect(label.parent?.props.accessibilityElementsHidden).toBe(true);
      expect(label.parent?.props.importantForAccessibility).toBe("no-hide-descendants");
    });

    describe("helperText", () => {
      it("is hidden from assistive tech, since the field's hint carries it", async () => {
        await render(<TextInput label="Password" helperText="At least 8 characters" placeholder="Password" />);

        expect(screen.queryByText("At least 8 characters")).toBeNull();
        const helper = screen.getByText("At least 8 characters", { includeHiddenElements: true });
        expect(helper.parent?.props.accessibilityElementsHidden).toBe(true);
        expect(helper.parent?.props.importantForAccessibility).toBe("no-hide-descendants");
      });

      it("stays readable when a consumer's own accessibilityHint replaces it", async () => {
        await render(
          <TextInput
            label="Email"
            helperText="We never share it"
            accessibilityHint="Enter the address you use at work"
            placeholder="Email address"
          />
        );

        expect(screen.getByText("We never share it")).toBeTruthy();
      });

      it("treats a null accessibilityHint like an omitted one", async () => {
        await render(
          <TextInput
            label="Email"
            helperText="We never share it"
            accessibilityHint={null as unknown as string}
            placeholder="Email address"
          />
        );

        expect(screen.queryByText("We never share it")).toBeNull();
        expect(screen.getByPlaceholderText("Email address").props.modifiers).toEqual([
          labelModifier("Email"),
          hintModifier("We never share it"),
        ]);
      });
    });

    describe("errorText", () => {
      it("stays in the accessibility tree as its own element, never hidden", async () => {
        await render(<TextInput label="Email" errorText="Email is required" placeholder="Email address" />);

        const error = screen.getByText("Email is required");
        expect(error.props.accessibilityElementsHidden).toBeFalsy();
        expect(error.parent?.props.accessibilityElementsHidden).toBeFalsy();
        expect(error.parent?.props.importantForAccessibility).not.toBe("no-hide-descendants");
      });

      it("is announced when it appears", async () => {
        const spy = announce();
        const { rerender } = await render(<TextInput label="Email" placeholder="Email address" />);
        expect(spy).not.toHaveBeenCalled();

        await rerender(<TextInput label="Email" errorText="Email is required" placeholder="Email address" />);

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith("Email is required");
      });

      it("is announced again when the message changes, and not when it clears", async () => {
        const spy = announce();
        const { rerender } = await render(
          <TextInput label="Email" errorText="Email is required" placeholder="Email address" />
        );
        // Showing on mount is the baseline, read when the user reaches it.
        expect(spy).not.toHaveBeenCalled();

        await rerender(<TextInput label="Email" errorText="Enter a valid email" placeholder="Email address" />);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenLastCalledWith("Enter a valid email");

        await rerender(<TextInput label="Email" placeholder="Email address" />);
        expect(spy).toHaveBeenCalledTimes(1);
      });

      it("is not re-announced by unrelated re-renders", async () => {
        const spy = announce();
        const { rerender } = await render(<TextInput label="Email" placeholder="Email address" />);
        await rerender(<TextInput label="Email" errorText="Email is required" placeholder="Email address" />);
        await rerender(
          <TextInput label="Email" errorText="Email is required" placeholder="Email address" value="a" />
        );

        expect(spy).toHaveBeenCalledTimes(1);
      });

      it("does not announce helperText", async () => {
        const spy = announce();
        const { rerender } = await render(<TextInput label="Email" placeholder="Email address" />);
        await rerender(<TextInput label="Email" helperText="We never share it" placeholder="Email address" />);

        expect(spy).not.toHaveBeenCalled();
      });
    });

    describe("required", () => {
      it("appends ', required' to the helper text in the hint", async () => {
        await render(
          <TextInput label="Password" helperText="At least 8 characters" required placeholder="Password" />
        );

        expect(screen.getByPlaceholderText("Password").props.modifiers).toEqual([
          labelModifier("Password"),
          hintModifier("At least 8 characters, required"),
        ]);
      });

      it("announces required on its own when there is no helper text", async () => {
        await render(<TextInput label="Email" required placeholder="Email address" />);

        expect(screen.getByPlaceholderText("Email address").props.modifiers).toEqual([
          labelModifier("Email"),
          hintModifier("required"),
        ]);
      });

      it("keeps required in the hint while an error shows, with the error as its own element", async () => {
        await render(<TextInput label="Email" required errorText="Enter an email" placeholder="Email address" />);

        expect(screen.getByPlaceholderText("Email address").props.modifiers).toEqual([
          labelModifier("Email"),
          hintModifier("required"),
        ]);
        expect(screen.getByText("Enter an email")).toBeTruthy();
      });

      it("says requiredHint in place of the English default", async () => {
        await render(
          <TextInput
            label="Correo"
            helperText="Al menos 8 caracteres"
            required
            requiredHint="obligatorio"
            placeholder="Correo"
          />
        );

        expect(screen.getByPlaceholderText("Correo").props.modifiers).toEqual([
          labelModifier("Correo"),
          hintModifier("Al menos 8 caracteres, obligatorio"),
        ]);
      });

      it("does not forward requiredHint to the native field", async () => {
        await render(<TextInput label="Email" required requiredHint="obligatorio" placeholder="Email address" />);

        expect(screen.getByPlaceholderText("Email address").props).not.toHaveProperty("requiredHint");
      });

      it("ignores requiredHint when the field is not required", async () => {
        await render(<TextInput label="Email" requiredHint="obligatorio" placeholder="Email address" />);

        expect(screen.getByPlaceholderText("Email address").props.modifiers).toEqual([labelModifier("Email")]);
      });

      it("keeps the field's name plain, so label selectors still match", async () => {
        await render(<TextInput label="Email" required placeholder="Email address" />);

        expect(screen.getByPlaceholderText("Email address").props.modifiers[0]).toEqual(labelModifier("Email"));
      });

      it("still hides the visible ' *' with the label rather than reading it", async () => {
        await render(<TextInput label="Email" required placeholder="Email address" />);

        // The label and its " *" share one hidden container: nothing reads the star.
        const label = screen.getByText(/Email/, { includeHiddenElements: true });
        expect(label.parent?.props.accessibilityElementsHidden).toBe(true);
        expect(screen.queryByText(/\*/)).toBeNull();
        expect(screen.getByText(/\*/, { includeHiddenElements: true })).toBeTruthy();
      });

      it("leaves a consumer's own accessibilityHint untouched", async () => {
        await render(
          <TextInput label="Email" required accessibilityHint="Enter the address you use at work" placeholder="Email address" />
        );

        expect(screen.getByPlaceholderText("Email address").props.modifiers).toEqual([
          labelModifier("Email"),
          hintModifier("Enter the address you use at work"),
        ]);
      });

      it("adds nothing to the hint when the field is not required", async () => {
        await render(<TextInput label="Email" helperText="We never share it" placeholder="Email address" />);

        expect(screen.getByPlaceholderText("Email address").props.modifiers).toEqual([
          labelModifier("Email"),
          hintModifier("We never share it"),
        ]);
      });
    });
  });
});
