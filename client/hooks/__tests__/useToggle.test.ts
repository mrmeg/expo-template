import { renderHook, act } from "@testing-library/react-native";
import { useToggle } from "../useToggle";

describe("useToggle", () => {
  it("defaults to false", () => {
    const { result } = renderHook(() => useToggle());
    expect(result.current[0]).toBe(false);
  });

  it("respects custom initial value", () => {
    const { result } = renderHook(() => useToggle(true));
    expect(result.current[0]).toBe(true);
  });

  it("toggle() flips the value", () => {
    const { result } = renderHook(() => useToggle(false));

    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(true);
  });

  it("toggle() called twice returns to original", () => {
    const { result } = renderHook(() => useToggle(false));

    act(() => {
      result.current[1]();
    });
    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(false);
  });

  it("setValue() sets to explicit value", () => {
    const { result } = renderHook(() => useToggle(false));

    act(() => {
      result.current[2](true);
    });
    expect(result.current[0]).toBe(true);

    act(() => {
      result.current[2](true);
    });
    expect(result.current[0]).toBe(true);
  });

  it("toggle and setValue are referentially stable", () => {
    const { result, rerender } = renderHook(() => useToggle(false));

    const toggle1 = result.current[1];
    const setValue1 = result.current[2];

    act(() => {
      result.current[1]();
    });
    rerender({});

    expect(result.current[1]).toBe(toggle1);
    expect(result.current[2]).toBe(setValue1);
  });
});
