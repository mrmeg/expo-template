/**
 * globalUIStore tests
 *
 * Tests show/hide alert behavior and state shape.
 */

import { globalUIStore } from "../globalUIStore";

// Reset store between tests
beforeEach(() => {
  globalUIStore.setState({ alert: null });
});

describe("globalUIStore", () => {
  it("starts with null alert", () => {
    expect(globalUIStore.getState().alert).toBeNull();
  });

  it("show() sets alert with show: true", () => {
    globalUIStore.getState().show({
      type: "success",
      title: "Done",
      messages: ["Operation completed."],
    });

    const alert = globalUIStore.getState().alert;
    expect(alert).not.toBeNull();
    expect(alert!.show).toBe(true);
    expect(alert!.type).toBe("success");
    expect(alert!.title).toBe("Done");
    expect(alert!.messages).toEqual(["Operation completed."]);
  });

  it("hide() sets alert to null", () => {
    globalUIStore.getState().show({ type: "info", title: "Notice" });
    globalUIStore.getState().hide();

    expect(globalUIStore.getState().alert).toBeNull();
  });

  it("show() with error type", () => {
    globalUIStore.getState().show({
      type: "error",
      title: "Error",
      messages: ["Something went wrong."],
    });

    const alert = globalUIStore.getState().alert;
    expect(alert!.type).toBe("error");
  });

  it("show() with optional fields", () => {
    globalUIStore.getState().show({
      type: "warning",
      title: "Warning",
      duration: 5000,
      loading: true,
      position: "bottom",
    });

    const alert = globalUIStore.getState().alert;
    expect(alert!.duration).toBe(5000);
    expect(alert!.loading).toBe(true);
    expect(alert!.position).toBe("bottom");
  });

  it("calling show() again replaces the previous alert", () => {
    globalUIStore.getState().show({ type: "info", title: "First" });
    globalUIStore.getState().show({ type: "error", title: "Second" });

    const alert = globalUIStore.getState().alert;
    expect(alert!.title).toBe("Second");
    expect(alert!.type).toBe("error");
  });
});
