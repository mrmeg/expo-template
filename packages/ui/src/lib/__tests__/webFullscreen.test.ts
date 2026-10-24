/**
 * The browser Fullscreen API helpers behind `Video`'s custom fullscreen. The
 * Jest environment has no DOM, so `document` is a stub installed per test.
 */
import {
  enterElementFullscreen,
  exitElementFullscreen,
  getFullscreenElement,
  subscribeFullscreenChange,
  supportsElementFullscreen,
} from "../webFullscreen";

const globalWithDocument = globalThis as unknown as { document?: unknown };
const original = globalWithDocument.document;

function installDocument(overrides: Record<string, unknown> = {}) {
  const listeners = new Map<string, Set<() => void>>();
  const doc = {
    fullscreenElement: null as unknown,
    exitFullscreen: jest.fn(async () => {}),
    addEventListener: jest.fn((type: string, listener: () => void) => {
      listeners.set(type, (listeners.get(type) ?? new Set()).add(listener));
    }),
    removeEventListener: jest.fn((type: string, listener: () => void) => {
      listeners.get(type)?.delete(listener);
    }),
    fire: (type: string) => [...(listeners.get(type) ?? [])].forEach((listener) => listener()),
    ...overrides,
  };
  globalWithDocument.document = doc;
  return doc;
}

afterEach(() => {
  globalWithDocument.document = original;
});

describe("without a DOM (server rendering)", () => {
  beforeEach(() => {
    globalWithDocument.document = undefined;
  });

  it("does nothing and throws nothing", async () => {
    expect(getFullscreenElement()).toBeNull();
    expect(await enterElementFullscreen({ requestFullscreen: jest.fn() })).toBe(true);
    await expect(exitElementFullscreen()).resolves.toBeUndefined();
    expect(() => subscribeFullscreenChange(() => {})()).not.toThrow();
  });
});

describe("supportsElementFullscreen", () => {
  it("is true for an element with the standard or the webkit method", () => {
    expect(supportsElementFullscreen({ requestFullscreen: () => {} })).toBe(true);
    expect(supportsElementFullscreen({ webkitRequestFullscreen: () => {} })).toBe(true);
  });

  it("is false for anything else, such as iPhone Safari's elements", () => {
    expect(supportsElementFullscreen({})).toBe(false);
    expect(supportsElementFullscreen(null)).toBe(false);
    expect(supportsElementFullscreen(undefined)).toBe(false);
  });
});

describe("enterElementFullscreen", () => {
  it("requests fullscreen with the browser chrome hidden, and resolves true", async () => {
    const node = { requestFullscreen: jest.fn(async () => {}) };

    await expect(enterElementFullscreen(node)).resolves.toBe(true);

    expect(node.requestFullscreen).toHaveBeenCalledWith({ navigationUI: "hide" });
  });

  it("falls back to the webkit method", async () => {
    const node = { webkitRequestFullscreen: jest.fn(async () => {}) };

    await expect(enterElementFullscreen(node)).resolves.toBe(true);

    expect(node.webkitRequestFullscreen).toHaveBeenCalledTimes(1);
  });

  it("resolves false when the element cannot, so the caller can fall back", async () => {
    await expect(enterElementFullscreen({})).resolves.toBe(false);
    await expect(enterElementFullscreen(null)).resolves.toBe(false);
  });

  it("resolves false, rather than rejecting, when the browser refuses", async () => {
    const node = { requestFullscreen: jest.fn(async () => Promise.reject(new TypeError("Permissions check failed"))) };

    await expect(enterElementFullscreen(node)).resolves.toBe(false);
  });
});

describe("getFullscreenElement", () => {
  it("reads the standard property, then the webkit one", () => {
    const node = {};
    installDocument({ fullscreenElement: node });
    expect(getFullscreenElement()).toBe(node);

    installDocument({ fullscreenElement: undefined, webkitFullscreenElement: node });
    expect(getFullscreenElement()).toBe(node);

    installDocument();
    expect(getFullscreenElement()).toBeNull();
  });
});

describe("exitElementFullscreen", () => {
  it("leaves fullscreen when something is fullscreen", async () => {
    const doc = installDocument({ fullscreenElement: {} });

    await exitElementFullscreen();

    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("does nothing when nothing is fullscreen", async () => {
    const doc = installDocument();

    await exitElementFullscreen();

    expect(doc.exitFullscreen).not.toHaveBeenCalled();
  });

  it("uses the webkit method where the standard one is missing", async () => {
    const webkitExitFullscreen = jest.fn(async () => {});
    installDocument({ webkitFullscreenElement: {}, exitFullscreen: undefined, webkitExitFullscreen });

    await exitElementFullscreen();

    expect(webkitExitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("swallows a rejection from a document that is already out", async () => {
    installDocument({ fullscreenElement: {}, exitFullscreen: jest.fn(async () => Promise.reject(new TypeError("Document not active"))) });

    await expect(exitElementFullscreen()).resolves.toBeUndefined();
  });
});

describe("subscribeFullscreenChange", () => {
  it("listens for both event names and unsubscribes from both", () => {
    const doc = installDocument();
    const listener = jest.fn();

    const unsubscribe = subscribeFullscreenChange(listener);
    doc.fire("fullscreenchange");
    doc.fire("webkitfullscreenchange");
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    doc.fire("fullscreenchange");
    doc.fire("webkitfullscreenchange");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
