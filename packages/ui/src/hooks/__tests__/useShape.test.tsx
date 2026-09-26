/**
 * `useShape(slot)` is how a component reads its `setShape` override. It has to
 * return exactly the slot's override (or undefined), re-render on `setShape`,
 * and go back to undefined when the overrides are cleared — otherwise a
 * component would keep a stale radius after `setShape({})`.
 */
import React from "react";
import { Text } from "react-native";
import { act, render, screen } from "@testing-library/react-native";

import { useShape, shapeRadius } from "../useShape";
import { useThemeStore } from "../../state/themeStore";

function Probe({ slot }: { slot: Parameters<typeof useShape>[0] }) {
  const override = useShape(slot);
  return <Text testID="probe">{JSON.stringify(override ?? null)}</Text>;
}

describe("useShape", () => {
  afterEach(() => {
    useThemeStore.getState().setShape({});
  });

  it("returns undefined for a slot with no override", async () => {
    await render(<Probe slot="card" />);
    expect(screen.getByTestId("probe").props.children).toBe("null");
  });

  it("returns the slot's override and only that slot's", async () => {
    useThemeStore.getState().setShape({ card: { borderRadius: 24 }, input: { borderRadius: 4 } });
    await render(<Probe slot="card" />);
    expect(screen.getByTestId("probe").props.children).toBe(JSON.stringify({ borderRadius: 24 }));
  });

  it("re-renders on setShape and clears with setShape({})", async () => {
    await render(<Probe slot="badge" />);
    await act(async () => {
      useThemeStore.getState().setShape({ badge: { borderRadius: 6 } });
    });
    expect(screen.getByTestId("probe").props.children).toBe(JSON.stringify({ borderRadius: 6 }));
    await act(async () => {
      useThemeStore.getState().setShape({});
    });
    expect(screen.getByTestId("probe").props.children).toBe("null");
  });

  it("shapeRadius turns an override into a style, and nothing into nothing", () => {
    expect(shapeRadius({ borderRadius: 12 })).toEqual({ borderRadius: 12 });
    expect(shapeRadius({})).toBeUndefined();
    expect(shapeRadius(undefined)).toBeUndefined();
    // Zero is a real radius (square corners), not "unset".
    expect(shapeRadius({ borderRadius: 0 })).toEqual({ borderRadius: 0 });
  });
});
