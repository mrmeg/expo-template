/**
 * Keyboard ownership guardrails (source-level).
 *
 * The native root no longer wraps the app in an animated KeyboardAvoidingView:
 * that resized every screen, header and tab bar on each keyboard frame. The
 * contract that replaces it:
 *   - `RootLayout` passes `keyboardAvoiding={false}` to `UIProvider` (the
 *     package default stays on for other consumers);
 *   - each tab screen that renders a text input owns keyboard handling, through
 *     `KeyboardAwareScrollView` (client/features/keyboard/platform) or the UI
 *     package's `DismissKeyboard`, which brings its own avoiding view;
 *   - the auth screen, which the profile tab shows while signed out, keeps its
 *     `DismissKeyboard` for the same reason.
 *
 * Dropping any of these is a silent regression: the field still focuses, it
 * just sits under the keyboard.
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..", "..", "..", "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const TEXT_INPUT_USE = /<(?:TextInput|FormTextInput|AuthTextField|InputOTP)\b/;
const KEYBOARD_OWNER = /<(?:KeyboardAwareScrollView|DismissKeyboard)\b/;

describe("keyboard ownership", () => {
  it("keeps the root free of keyboard avoidance", () => {
    expect(read("client/features/app/RootLayout.tsx")).toMatch(
      /<UIProvider\s+keyboardAvoiding=\{false\}>/,
    );
  });

  it("gives every tab screen with a text input its own keyboard handling", () => {
    const tabsDir = join(root, "app", "(main)", "(tabs)");
    const screens = readdirSync(tabsDir).filter(
      (name) => /\.tsx$/.test(name) && !name.startsWith("_layout"),
    );
    const withInputs = screens.filter((name) =>
      TEXT_INPUT_USE.test(readFileSync(join(tabsDir, name), "utf8")),
    );

    // The Explore search field is the one today; the list must not go empty
    // silently (e.g. after a rename), or this check would stop checking.
    expect(withInputs).toContain("index.tsx");
    for (const name of withInputs) {
      const source = readFileSync(join(tabsDir, name), "utf8");
      expect({ name, ownsKeyboard: KEYBOARD_OWNER.test(source) }).toEqual({
        name,
        ownsKeyboard: true,
      });
    }
  });

  it("keeps the auth screen's DismissKeyboard", () => {
    expect(read("client/features/auth/components/AuthScreen.tsx")).toMatch(
      /<DismissKeyboard\s+style=\{styles\.content\}>/,
    );
  });
});
