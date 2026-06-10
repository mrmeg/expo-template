/**
 * notify tests
 *
 * Tests the imperative notification helpers backed by globalUIStore.
 */

import { DEFAULT_NOTIFICATION_DURATION, globalUIStore } from "../globalUIStore";
import { notify } from "../notify";

// Reset store between tests
beforeEach(() => {
  globalUIStore.setState({ alert: null });
});

describe("notify", () => {
  it("notify() shows a full alert payload", () => {
    notify({ type: "info", title: "Copied", duration: 2000, position: "bottom" });

    const alert = globalUIStore.getState().alert;
    expect(alert).toEqual({
      show: true,
      type: "info",
      title: "Copied",
      duration: 2000,
      position: "bottom",
    });
  });

  it.each(["success", "error", "info", "warning"] as const)(
    "notify.%s() shows a %s alert",
    (type) => {
      notify[type]("Title", { messages: ["Details."] });

      const alert = globalUIStore.getState().alert;
      expect(alert!.show).toBe(true);
      expect(alert!.type).toBe(type);
      expect(alert!.title).toBe("Title");
      expect(alert!.messages).toEqual(["Details."]);
    }
  );

  it("notify.success() forwards options", () => {
    const onPress = jest.fn();
    notify.success("Saved", {
      duration: 5000,
      position: "bottom",
      action: { label: "Undo", onPress },
    });

    const alert = globalUIStore.getState().alert;
    expect(alert!.duration).toBe(5000);
    expect(alert!.position).toBe("bottom");
    expect(alert!.action).toEqual({ label: "Undo", onPress });
  });

  it("applies the default duration when none is given", () => {
    notify.success("Saved");

    expect(globalUIStore.getState().alert!.duration).toBe(DEFAULT_NOTIFICATION_DURATION);
  });

  it("treats duration: 0 as persistent", () => {
    notify.info("Sticky", { duration: 0 });

    expect(globalUIStore.getState().alert!.duration).toBe(0);
  });

  it("notify.loading() shows a persistent loading alert", () => {
    notify.loading("Uploading…");

    const alert = globalUIStore.getState().alert;
    expect(alert!.loading).toBe(true);
    expect(alert!.type).toBe("info");
    expect(alert!.duration).toBeUndefined();
  });

  it("notify.hide() clears the alert", () => {
    notify.info("Notice");
    notify.hide();

    expect(globalUIStore.getState().alert).toBeNull();
  });

  describe("notify.promise()", () => {
    it("shows loading then success, and returns the resolved value", async () => {
      let resolve!: (value: string) => void;
      const promise = new Promise<string>((r) => { resolve = r; });

      const wrapped = notify.promise(promise, {
        loading: "Saving…",
        success: "Saved",
        error: "Failed",
      });

      expect(globalUIStore.getState().alert).toMatchObject({
        loading: true,
        title: "Saving…",
      });

      resolve("value");
      await expect(wrapped).resolves.toBe("value");
      expect(globalUIStore.getState().alert).toMatchObject({
        type: "success",
        title: "Saved",
      });
    });

    it("shows error and rethrows on rejection", async () => {
      const failure = new Error("boom");
      const wrapped = notify.promise(Promise.reject(failure), {
        loading: "Saving…",
        success: "Saved",
        error: "Failed",
      });

      await expect(wrapped).rejects.toBe(failure);
      expect(globalUIStore.getState().alert).toMatchObject({
        type: "error",
        title: "Failed",
      });
    });

    it("supports message functions for success and error", async () => {
      await notify.promise(Promise.resolve(3), {
        loading: "Counting…",
        success: (n) => `Counted ${n}`,
        error: "Failed",
      });
      expect(globalUIStore.getState().alert!.title).toBe("Counted 3");

      await expect(
        notify.promise(Promise.reject(new Error("boom")), {
          loading: "Counting…",
          success: "Done",
          error: (e) => `Failed: ${(e as Error).message}`,
        })
      ).rejects.toThrow("boom");
      expect(globalUIStore.getState().alert!.title).toBe("Failed: boom");
    });
  });
});
