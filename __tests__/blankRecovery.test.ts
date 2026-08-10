/**
 * Behavior of the inline blank-screen recovery watchdog.
 *
 * The script ships as a string inside the SSR <head> (app/+html.tsx), so it
 * can't be imported as code — these tests evaluate the string in a sandbox
 * with every global it touches shadowed, then drive the `load` handler and
 * queued timers by hand. The contract under test is the one documented in
 * client/features/app/blankRecoveryScript.ts: reload once on a provably dead
 * root, never loop, and replay captured errors on the next healthy load.
 */
import {
  BLANK_RECOVERY_LAST_KEY,
  BLANK_RECOVERY_SCRIPT,
  BLANK_RECOVERY_STORAGE_KEY,
} from "@/client/features/app/blankRecoveryScript";

type Handler = (event?: unknown) => void;

function runScript(options: { rootText: string | null; previous?: string }) {
  const listeners: Record<string, Handler[]> = {};
  const queuedTimers: Handler[] = [];
  const store = new Map<string, string>();
  if (options.previous !== undefined) {
    store.set(BLANK_RECOVERY_STORAGE_KEY, options.previous);
  }

  const reload = jest.fn();
  const warn = jest.fn();
  const error = jest.fn();
  const durable = new Map<string, string>();

  const sandbox = {
    window: {
      addEventListener: (name: string, fn: Handler) => {
        (listeners[name] ??= []).push(fn);
      },
    },
    document: {
      getElementById: (id: string) =>
        id === "root" && options.rootText !== null ? { innerText: options.rootText } : null,
    },
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
    localStorage: {
      getItem: (key: string) => durable.get(key) ?? null,
      setItem: (key: string, value: string) => void durable.set(key, value),
      removeItem: (key: string) => void durable.delete(key),
    },
    location: { href: "http://localhost/test", reload },
    console: { warn, error },
    setTimeout: (fn: Handler) => {
      queuedTimers.push(fn);
      return 0;
    },
  };

  new Function(
    "window",
    "document",
    "sessionStorage",
    "localStorage",
    "location",
    "console",
    "setTimeout",
    BLANK_RECOVERY_SCRIPT,
  )(
    sandbox.window,
    sandbox.document,
    sandbox.sessionStorage,
    sandbox.localStorage,
    sandbox.location,
    sandbox.console,
    sandbox.setTimeout,
  );

  return {
    reload,
    warn,
    error,
    store,
    durable,
    emit: (name: string, event?: unknown) => (listeners[name] ?? []).forEach((fn) => fn(event)),
    flushTimers: () => {
      // Drain-and-run so the `load` handler's nested setTimeout also fires.
      while (queuedTimers.length > 0) {
        queuedTimers.shift()!();
      }
    },
  };
}

describe("blank-screen recovery watchdog", () => {
  it("reloads once and persists captured errors when the root rendered nothing", () => {
    const run = runScript({ rootText: "  \n  " });
    run.emit("error", { message: "Minified React error #418" });
    run.emit("unhandledrejection", { reason: new Error("chunk eval failed") });
    run.emit("load");
    run.flushTimers();

    expect(run.reload).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(run.store.get(BLANK_RECOVERY_STORAGE_KEY)!);
    expect(payload.url).toBe("http://localhost/test");
    expect(payload.errors).toEqual([
      "error: Minified React error #418",
      "unhandledrejection: chunk eval failed",
    ]);
    expect(run.error).toHaveBeenCalledWith(
      expect.stringContaining("reloading once"),
      expect.any(String),
    );
    // The durable copy matches the session payload and is never auto-cleared.
    expect(run.durable.get(BLANK_RECOVERY_LAST_KEY)).toBe(
      run.store.get(BLANK_RECOVERY_STORAGE_KEY),
    );
  });

  it("treats a missing #root as dead", () => {
    const run = runScript({ rootText: null });
    run.emit("load");
    run.flushTimers();
    expect(run.reload).toHaveBeenCalledTimes(1);
  });

  it("checks exactly once even when both the load timer and the fallback fire", () => {
    const run = runScript({ rootText: "" });
    run.emit("load");
    run.flushTimers(); // load-scheduled check + the 15s fallback both queued
    run.flushTimers();
    expect(run.reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload a healthy page, and replays then clears a prior capture", () => {
    const previous = JSON.stringify({ at: "2026-01-01T00:00:00Z", errors: ["error: boom"] });
    const run = runScript({ rootText: "Explore", previous });
    run.emit("load");
    run.flushTimers();

    expect(run.reload).not.toHaveBeenCalled();
    expect(run.warn).toHaveBeenCalledWith(
      expect.stringContaining("auto-reloaded once"),
      expect.objectContaining({ errors: ["error: boom"] }),
    );
    expect(run.store.has(BLANK_RECOVERY_STORAGE_KEY)).toBe(false);
    // A healthy load never touches the durable copy — it must stay readable
    // long after the session guard self-clears (phones have no console open).
    expect(run.durable.has(BLANK_RECOVERY_LAST_KEY)).toBe(false);
  });

  it("never reloads twice: a still-dead page after recovery logs and stays put", () => {
    const previous = JSON.stringify({ at: "2026-01-01T00:00:00Z", errors: [] });
    const run = runScript({ rootText: "", previous });
    run.emit("load");
    run.flushTimers();

    expect(run.reload).not.toHaveBeenCalled();
    expect(run.error).toHaveBeenCalledWith(
      expect.stringContaining("Still blank after an automatic reload"),
      expect.any(String),
    );
    // The guard key stays so a reload storm is impossible for this session.
    expect(run.store.has(BLANK_RECOVERY_STORAGE_KEY)).toBe(true);
    // The still-dead second load overwrites the durable copy with its own
    // (fresher) capture.
    expect(JSON.parse(run.durable.get(BLANK_RECOVERY_LAST_KEY)!).url).toBe(
      "http://localhost/test",
    );
  });

  it("does not reload a page whose content simply arrived late but present", () => {
    const run = runScript({ rootText: "Component Library" });
    run.emit("load");
    run.flushTimers();
    expect(run.reload).not.toHaveBeenCalled();
    expect(run.error).not.toHaveBeenCalled();
    expect(run.store.has(BLANK_RECOVERY_STORAGE_KEY)).toBe(false);
  });
});
