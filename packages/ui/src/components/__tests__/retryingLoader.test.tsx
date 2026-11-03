/**
 * A failed overlay chunk must reach an error boundary, not retry forever behind
 * Suspense, and a later render must be able to load it again.
 */
import * as React from "react";
import { Text } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import { retryingLoader } from "../overlayPrimitives/retryingLoader";

class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <Text>failed</Text> : this.props.children;
  }
}

function setup() {
  const load = jest.fn<Promise<string>, []>();
  const getValue = retryingLoader(load, 5000);
  function Reader() {
    return <Text>{React.use(getValue())}</Text>;
  }
  const tree = (
    <Boundary>
      <React.Suspense fallback={<Text>loading</Text>}>
        <Reader />
      </React.Suspense>
    </Boundary>
  );
  return { load, getValue, tree };
}

const advance = (ms: number) => act(async () => {
  await jest.advanceTimersByTimeAsync(ms);
});

describe("retryingLoader", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    jest.useRealTimers();
  });

  it("shares one load between callers", async () => {
    const { load, getValue } = setup();
    load.mockResolvedValue("loaded");

    expect(getValue()).toBe(getValue());
    await advance(10000);
    getValue();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("throws a failure to the boundary without loading again", async () => {
    const { load, tree } = setup();
    load.mockRejectedValue(new Error("chunk failed"));

    await render(tree);
    await advance(1000);

    expect(screen.getByText("failed")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reads the same failure inside the delay, then loads again after it", async () => {
    const { load, tree, getValue } = setup();
    load.mockRejectedValueOnce(new Error("chunk failed"));

    const first = await render(tree);
    await advance(1000);
    await first.unmount();

    const second = await render(tree);
    await advance(1000);
    expect(screen.getByText("failed")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
    await second.unmount();

    load.mockResolvedValue("loaded");
    await advance(5000);
    await render(tree);
    await advance(100);

    expect(screen.getByText("loaded")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
    await expect(getValue()).resolves.toBe("loaded");
  });

  it("does not clear a newer load when an old failure's delay ends", async () => {
    const { load, getValue } = setup();
    load.mockRejectedValueOnce(new Error("chunk failed"));
    getValue().catch(() => {});
    await advance(5000);

    load.mockResolvedValue("loaded");
    const newer = getValue();
    await advance(10000);

    expect(getValue()).toBe(newer);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
