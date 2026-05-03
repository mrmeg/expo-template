import React from "react";
import { Text } from "react-native";
import { act, cleanup, render, screen } from "@testing-library/react-native";
import { configureExpoUiI18n } from "../../lib/i18n";
import { globalUIStore } from "../../state/globalUIStore";
import { UIProvider } from "../UIProvider";

jest.mock("@rn-primitives/portal", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return {
    PortalHost: () => React.createElement(Text, null, "PortalHost"),
  };
});

jest.mock("../StatusBar", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return {
    StatusBar: () => React.createElement(Text, null, "StatusBar"),
  };
});

describe("UIProvider without app i18n", () => {
  afterEach(() => {
    cleanup();
    configureExpoUiI18n(null);
    globalUIStore.setState({ alert: null });
  });

  it("mounts root UI infrastructure without initializing i18n", () => {
    render(
      <UIProvider>
        <Text>App content</Text>
      </UIProvider>
    );

    expect(screen.getByText("App content")).toBeTruthy();
    expect(screen.getByText("PortalHost")).toBeTruthy();
    expect(screen.getByText("StatusBar")).toBeTruthy();
  });

  it("uses readable package notification defaults without app i18n", () => {
    act(() => {
      globalUIStore.getState().show({ type: "error" });
    });

    render(
      <UIProvider>
        <Text>App content</Text>
      </UIProvider>
    );

    expect(screen.getByText("Error")).toBeTruthy();
  });

  it("uses the configured translator for package notification defaults", () => {
    configureExpoUiI18n((key) => `translated:${key}`);
    act(() => {
      globalUIStore.getState().show({ type: "error" });
    });

    render(
      <UIProvider>
        <Text>App content</Text>
      </UIProvider>
    );

    expect(screen.getByText("translated:notification.error")).toBeTruthy();
  });
});
