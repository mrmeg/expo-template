import React from "react";
import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { UIProvider } from "../UIProvider";

jest.mock("@rn-primitives/portal", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return {
    PortalHost: () => React.createElement(Text, null, "PortalHost"),
  };
});

jest.mock("../Notification", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return {
    Notification: () => React.createElement(Text, null, "Notification"),
  };
});

jest.mock("../StatusBar", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return {
    StatusBar: () => React.createElement(Text, null, "StatusBar"),
  };
});

describe("UIProvider", () => {
  it("mounts package root UI infrastructure by default", async () => {
    await render(
      <UIProvider>
        <Text>App content</Text>
      </UIProvider>
    );

    expect(screen.getByText("App content")).toBeTruthy();
    expect(screen.getByText("Notification")).toBeTruthy();
    expect(screen.getByText("PortalHost")).toBeTruthy();
    expect(screen.getByText("StatusBar")).toBeTruthy();
  });

  it("can opt out of individual root UI mounts", async () => {
    await render(
      <UIProvider notification={false} portalHost={false} statusBar={false}>
        <Text>App content</Text>
      </UIProvider>
    );

    expect(screen.getByText("App content")).toBeTruthy();
    expect(screen.queryByText("Notification")).toBeNull();
    expect(screen.queryByText("PortalHost")).toBeNull();
    expect(screen.queryByText("StatusBar")).toBeNull();
  });

  it("mounts the keyboard-avoiding root by default and can opt out", async () => {
    const { unmount } = await render(
      <UIProvider keyboardAvoidingProps={{ testID: "keyboard-root" }}>
        <Text>App content</Text>
      </UIProvider>
    );

    expect(screen.getByTestId("keyboard-root")).toBeTruthy();
    await unmount();

    await render(
      <UIProvider
        keyboardAvoiding={false}
        keyboardAvoidingProps={{ testID: "keyboard-root" }}
      >
        <Text>App content</Text>
      </UIProvider>
    );

    expect(screen.queryByTestId("keyboard-root")).toBeNull();
  });
});
