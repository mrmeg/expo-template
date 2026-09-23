/**
 * useDimensions on web.
 *
 * Every consumer shares one window store: one `resize` listener while any
 * consumer is mounted, one snapshot, and an update only when the width or
 * height changes. The server render and the browser's hydration pass stay
 * seeded from `SsrViewportContext` (or the desktop default), and the
 * `mrmeg-vw` cookie the server reads is written once per page view and then
 * only after resizing settles.
 *
 * jest-expo has no DOM, so this file installs a minimal window/document.
 */
// Must be the first import: useDimensions picks its platform at module load.
import "../../components/__tests__/forceWebPlatform";
import React from "react";
import { renderToString } from "react-dom/server";
import { act, render } from "@testing-library/react-native";
import { useDimensions, DEFAULT_VIEWPORT_HEIGHT, DEFAULT_VIEWPORT_WIDTH } from "../useDimensions";
import { SsrViewportContext } from "../../state/SsrViewportContext";

type Dimensions = ReturnType<typeof useDimensions>;

const resizeListeners = new Set<() => void>();
const addEventListener = jest.fn((type: string, listener: () => void) => {
  if (type === "resize") resizeListeners.add(listener);
});
const removeEventListener = jest.fn((type: string, listener: () => void) => {
  if (type === "resize") resizeListeners.delete(listener);
});
const cookieWrites: string[] = [];
const globals = globalThis as Record<string, unknown>;
const saved = {
  window: globals.window,
  document: globals.document,
};

function setViewport(width: number, height: number) {
  (globals.window as { innerWidth: number; innerHeight: number }).innerWidth = width;
  (globals.window as { innerWidth: number; innerHeight: number }).innerHeight = height;
}

async function resizeTo(width: number, height: number) {
  setViewport(width, height);
  await act(() => {
    for (const listener of [...resizeListeners]) listener();
  });
}

beforeAll(() => {
  globals.window = { innerWidth: 1024, innerHeight: 768, addEventListener, removeEventListener };
  const document = {};
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => cookieWrites[cookieWrites.length - 1] ?? "",
    set: (value: string) => {
      cookieWrites.push(value);
    },
  });
  globals.document = document;
});

afterAll(() => {
  globals.window = saved.window;
  globals.document = saved.document;
});

beforeEach(() => {
  addEventListener.mockClear();
  removeEventListener.mockClear();
  cookieWrites.length = 0;
  setViewport(1024, 768);
});

function Probe({ onRender }: { onRender: (value: Dimensions) => void }) {
  onRender(useDimensions());
  return null;
}

describe("useDimensions (web)", () => {
  it("seeds the server render from SsrViewportContext, else the desktop default", () => {
    const seen: Dimensions[] = [];
    const record = (value: Dimensions) => {
      seen.push(value);
    };

    renderToString(
      <SsrViewportContext.Provider value={390}>
        <Probe onRender={record} />
      </SsrViewportContext.Provider>
    );
    renderToString(<Probe onRender={record} />);

    expect(seen[0]).toEqual({
      width: 390,
      height: DEFAULT_VIEWPORT_HEIGHT,
      orientation: "portrait",
      isSmallScreen: true,
      isMediumScreen: false,
      isLargeScreen: false,
    });
    expect(seen[1]).toEqual(expect.objectContaining({
      width: DEFAULT_VIEWPORT_WIDTH,
      height: DEFAULT_VIEWPORT_HEIGHT,
      isLargeScreen: true,
    }));
    // The server has no window to subscribe to.
    expect(addEventListener).not.toHaveBeenCalled();
  });

  it("shares one resize listener across consumers and drops it with the last one", async () => {
    const { unmount } = await render(
      <>
        <Probe onRender={() => {}} />
        <Probe onRender={() => {}} />
        <Probe onRender={() => {}} />
      </>
    );

    expect(addEventListener.mock.calls.filter(([type]) => type === "resize")).toHaveLength(1);
    expect(resizeListeners.size).toBe(1);

    await unmount();

    expect(removeEventListener.mock.calls.filter(([type]) => type === "resize")).toHaveLength(1);
    expect(resizeListeners.size).toBe(0);
  });

  it("reads the live viewport and follows resize with the same flags as before", async () => {
    let latest: Dimensions | undefined;
    await render(<Probe onRender={(value) => { latest = value; }} />);

    expect(latest).toEqual({
      width: 1024,
      height: 768,
      orientation: "landscape",
      isSmallScreen: false,
      isMediumScreen: false,
      isLargeScreen: true,
    });

    await resizeTo(500, 900);

    expect(latest).toEqual({
      width: 500,
      height: 900,
      orientation: "portrait",
      isSmallScreen: true,
      isMediumScreen: false,
      isLargeScreen: false,
    });
  });

  it("does not re-render consumers when a resize leaves the dimensions unchanged", async () => {
    let renders = 0;
    let first: Dimensions | undefined;
    let latest: Dimensions | undefined;
    await render(
      <Probe
        onRender={(value) => {
          renders += 1;
          first ??= value;
          latest = value;
        }}
      />
    );
    const settled = renders;

    await resizeTo(1024, 768);
    await resizeTo(1024, 768);

    expect(renders).toBe(settled);
    expect(latest).toBe(first);

    await resizeTo(1024, 700);

    expect(renders).toBe(settled + 1);
    expect(latest?.height).toBe(700);
  });

  it("writes the viewport cookie once per page view, then only after resizing settles", async () => {
    jest.useFakeTimers();
    try {
      const { unmount } = await render(
        <>
          <Probe onRender={() => {}} />
          <Probe onRender={() => {}} />
        </>
      );

      // One write for the page view, not one per consumer.
      expect(cookieWrites).toEqual([
        "mrmeg-vw=1020; path=/; max-age=31536000; SameSite=Lax",
      ]);

      await resizeTo(800, 768);
      await resizeTo(810, 768);
      await resizeTo(1200, 768);
      await act(async () => {
        jest.advanceTimersByTime(249);
      });
      expect(cookieWrites).toHaveLength(1);

      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      expect(cookieWrites).toEqual([
        "mrmeg-vw=1020; path=/; max-age=31536000; SameSite=Lax",
        "mrmeg-vw=1200; path=/; max-age=31536000; SameSite=Lax",
      ]);

      // A width that rounds to the stored value writes nothing.
      await resizeTo(1203, 768);
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(cookieWrites).toHaveLength(2);

      // A pending write is flushed when the last consumer unmounts.
      await resizeTo(640, 768);
      await unmount();
      expect(cookieWrites[cookieWrites.length - 1]).toBe(
        "mrmeg-vw=640; path=/; max-age=31536000; SameSite=Lax"
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
