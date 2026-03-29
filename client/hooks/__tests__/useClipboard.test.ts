import { renderHook, act } from "@testing-library/react-native";
import { useClipboard } from "../useClipboard";

// Mock expo-clipboard
jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
  getStringAsync: jest.fn().mockResolvedValue("clipboard-content"),
}));

const Clipboard = require("expo-clipboard");

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useClipboard", () => {
  it("copy() sets copied to true then resets after duration", async () => {
    const { result } = renderHook(() => useClipboard());

    expect(result.current.copied).toBe(false);

    await act(async () => {
      await result.current.copy("hello");
    });
    expect(result.current.copied).toBe(true);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("hello");

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.copied).toBe(false);
  });

  it("respects custom copiedDuration", async () => {
    const { result } = renderHook(() =>
      useClipboard({ copiedDuration: 500 })
    );

    await act(async () => {
      await result.current.copy("test");
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current.copied).toBe(false);
  });

  it("paste() returns clipboard contents", async () => {
    const { result } = renderHook(() => useClipboard());

    let text = "";
    await act(async () => {
      text = await result.current.paste();
    });
    expect(text).toBe("clipboard-content");
    expect(Clipboard.getStringAsync).toHaveBeenCalled();
  });

  it("sets error when copy fails", async () => {
    Clipboard.setStringAsync.mockRejectedValueOnce(new Error("Denied"));

    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy("test");
    });
    expect(result.current.error).toBe("Denied");
    expect(result.current.copied).toBe(false);
  });

  it("clears error on next successful copy", async () => {
    Clipboard.setStringAsync.mockRejectedValueOnce(new Error("Denied"));

    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy("fail");
    });
    expect(result.current.error).toBe("Denied");

    await act(async () => {
      await result.current.copy("succeed");
    });
    expect(result.current.error).toBeNull();
    expect(result.current.copied).toBe(true);
  });

  it("sets error when paste fails", async () => {
    Clipboard.getStringAsync.mockRejectedValueOnce(new Error("Not allowed"));

    const { result } = renderHook(() => useClipboard());

    let text = "";
    await act(async () => {
      text = await result.current.paste();
    });
    expect(text).toBe("");
    expect(result.current.error).toBe("Not allowed");
  });
});
