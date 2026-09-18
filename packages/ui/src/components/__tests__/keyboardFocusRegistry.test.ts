import {
  clearKeyboardFocusedInput,
  dismissKeyboardFocusedInput,
  hasKeyboardFocusedInput,
  setKeyboardFocusedInput,
  subscribeKeyboardFocus,
} from "../keyboardFocusRegistry";

describe("keyboardFocusRegistry dismissKeyboardFocusedInput", () => {
  const tokenA = {};
  const tokenB = {};

  afterEach(() => {
    clearKeyboardFocusedInput(tokenA);
    clearKeyboardFocusedInput(tokenB);
  });

  it("returns false when nothing is registered", () => {
    expect(hasKeyboardFocusedInput()).toBe(false);
    expect(dismissKeyboardFocusedInput()).toBe(false);
  });

  it("blurs the field and clears presence immediately, notifying subscribers", () => {
    const blur = jest.fn();
    const listener = jest.fn();
    const unsubscribe = subscribeKeyboardFocus(listener);

    setKeyboardFocusedInput(tokenA, blur);
    expect(hasKeyboardFocusedInput()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    // No later clearKeyboardFocusedInput: the native blur callback may never
    // arrive (submit handlers, isolated sheet window, iOS secure handoff).
    expect(dismissKeyboardFocusedInput()).toBe(true);
    expect(blur).toHaveBeenCalledTimes(1);
    expect(hasKeyboardFocusedInput()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    // A late native blur for the same token is a no-op.
    clearKeyboardFocusedInput(tokenA);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(dismissKeyboardFocusedInput()).toBe(false);
    unsubscribe();
  });

  it("keeps a registration made synchronously during blur", () => {
    const blurB = jest.fn();
    const blurA = jest.fn(() => setKeyboardFocusedInput(tokenB, blurB));
    const listener = jest.fn();
    const unsubscribe = subscribeKeyboardFocus(listener);

    setKeyboardFocusedInput(tokenA, blurA);
    expect(listener).toHaveBeenCalledTimes(1);

    expect(dismissKeyboardFocusedInput()).toBe(true);
    expect(blurA).toHaveBeenCalledTimes(1);
    expect(blurB).not.toHaveBeenCalled();
    // The token guard leaves B registered; the handoff keeps presence and is silent.
    expect(hasKeyboardFocusedInput()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    expect(dismissKeyboardFocusedInput()).toBe(true);
    expect(blurB).toHaveBeenCalledTimes(1);
    expect(hasKeyboardFocusedInput()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
