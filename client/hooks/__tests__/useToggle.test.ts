import { renderHook, act } from "@testing-library/react-native";
import { useToggle } from "../useToggle";

describe("useToggle", () => {
  it("defaults to false", async () => {
    const { result } = await renderHook(() => useToggle());
    expect(result.current[0]).toBe(false);
  });

  it("respects custom initial value", async () => {
    const { result } = await renderHook(() => useToggle(true));
    expect(result.current[0]).toBe(true);
  });

  it("toggle() flips the value", async () => {
    const { result } = await renderHook(() => useToggle(false));

    await act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(true);
  });

  it("toggle() called twice returns to original", async () => {
    const { result } = await renderHook(() => useToggle(false));

    await act(() => {
      result.current[1]();
    });
    await act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(false);
  });

  it("setValue() sets to explicit value", async () => {
    const { result } = await renderHook(() => useToggle(false));

    await act(() => {
      result.current[2](true);
    });
    expect(result.current[0]).toBe(true);

    await act(() => {
      result.current[2](true);
    });
    expect(result.current[0]).toBe(true);
  });

  it("toggle and setValue are referentially stable", async () => {
    const { result, rerender } = await renderHook(() => useToggle(false));

    const toggle1 = result.current[1];
    const setValue1 = result.current[2];

    await act(() => {
      result.current[1]();
    });
    await rerender({});

    expect(result.current[1]).toBe(toggle1);
    expect(result.current[2]).toBe(setValue1);
  });
});
