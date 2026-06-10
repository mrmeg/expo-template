import { renderHook, act } from "@testing-library/react-native";
import { useDebounce, useDebouncedCallback } from "../useDebounce";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useDebounce", () => {
  it("returns initial value immediately", async () => {
    const { result } = await renderHook(() => useDebounce("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("updates returned value after the delay", async () => {
    const { result, rerender } = await renderHook(
      ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 300 } }
    );

    await rerender({ value: "b", delay: 300 });
    expect(result.current).toBe("a");

    await act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe("b");
  });

  it("resets timer when value changes within the delay window", async () => {
    const { result, rerender } = await renderHook(
      ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 300 } }
    );

    await rerender({ value: "b", delay: 300 });
    await act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current).toBe("a");

    await rerender({ value: "c", delay: 300 });
    await act(() => {
      jest.advanceTimersByTime(200);
    });
    // Still "a" because timer was reset
    expect(result.current).toBe("a");

    await act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe("c");
  });

  it("cleans up timeout on unmount", async () => {
    const { result, rerender, unmount } = await renderHook(
      ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 300 } }
    );

    await rerender({ value: "b", delay: 300 });
    await unmount();

    // Should not throw or update after unmount
    await act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe("a");
  });
});

describe("useDebouncedCallback", () => {
  it("fires callback after delay", async () => {
    const callback = jest.fn();
    const { result } = await renderHook(() => useDebouncedCallback(callback, 300));

    await act(() => {
      result.current("arg1");
    });
    expect(callback).not.toHaveBeenCalled();

    await act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(callback).toHaveBeenCalledWith("arg1");
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does not fire before delay", async () => {
    const callback = jest.fn();
    const { result } = await renderHook(() => useDebouncedCallback(callback, 300));

    await act(() => {
      result.current("arg1");
    });

    await act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it("resets timer on rapid calls", async () => {
    const callback = jest.fn();
    const { result } = await renderHook(() => useDebouncedCallback(callback, 300));

    await act(() => {
      result.current("first");
    });
    await act(() => {
      jest.advanceTimersByTime(200);
    });
    await act(() => {
      result.current("second");
    });
    await act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("second");
  });

  it("fires immediately with leading option", async () => {
    const callback = jest.fn();
    const { result } = await renderHook(() =>
      useDebouncedCallback(callback, 300, { leading: true })
    );

    await act(() => {
      result.current("arg1");
    });
    expect(callback).toHaveBeenCalledWith("arg1");
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("suppresses subsequent calls within delay when leading", async () => {
    const callback = jest.fn();
    const { result } = await renderHook(() =>
      useDebouncedCallback(callback, 300, { leading: true })
    );

    await act(() => {
      result.current("first");
    });
    await act(() => {
      result.current("second");
    });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("first");

    await act(() => {
      jest.advanceTimersByTime(300);
    });
    // Leading mode does not fire trailing
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("cancel() prevents pending execution", async () => {
    const callback = jest.fn();
    const { result } = await renderHook(() => useDebouncedCallback(callback, 300));

    await act(() => {
      result.current("arg1");
    });
    await act(() => {
      result.current.cancel();
    });
    await act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("cleans up on unmount", async () => {
    const callback = jest.fn();
    const { result, unmount } = await renderHook(() =>
      useDebouncedCallback(callback, 300)
    );

    await act(() => {
      result.current("arg1");
    });
    await unmount();

    await act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(callback).not.toHaveBeenCalled();
  });
});
