import React from "react";
import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { SafeAreaInsetsContext, initialWindowMetrics } from "react-native-safe-area-context";

import { useWindowInsets } from "../useWindowInsets";

function Probe() {
  const insets = useWindowInsets();
  return <Text testID="probe">{`${insets.top}/${insets.bottom}/${insets.left}/${insets.right}`}</Text>;
}

const ISLAND = { top: 59, bottom: 34, left: 0, right: 0 };

describe("useWindowInsets", () => {
  it("reads the SafeAreaProvider's insets when one is above", async () => {
    await render(
      <SafeAreaInsetsContext.Provider value={ISLAND}>
        <Probe />
      </SafeAreaInsetsContext.Provider>,
    );
    expect(screen.getByTestId("probe").props.children).toBe("59/34/0/0");
  });

  it("falls back to initialWindowMetrics edge by edge when the provider is missing or reads zero", async () => {
    const metrics = initialWindowMetrics as unknown as { insets: typeof ISLAND };
    const saved = metrics.insets;
    metrics.insets = { top: 47, bottom: 21, left: 0, right: 0 };
    try {
      await render(
        <SafeAreaInsetsContext.Provider value={null}>
          <Probe />
        </SafeAreaInsetsContext.Provider>,
      );
      expect(screen.getByTestId("probe").props.children).toBe("47/21/0/0");
    } finally {
      metrics.insets = saved;
    }
  });

  it("is all zeros with neither (web, tests)", async () => {
    await render(<Probe />);
    expect(screen.getByTestId("probe").props.children).toBe("0/0/0/0");
  });
});
