/**
 * `LazyMediaViewer`: renders nothing, and so fetches nothing, until the viewer
 * has been opened once. (Jest cannot run the real `import()`, so the live path
 * is the showcase's and the media tab's: see `mediaChunkSplitPoint.test.ts`
 * for how the chunk is kept out of `__common`.)
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";

const mockLoads = jest.fn();
jest.mock("@/client/components/mediaChunk", () => {
  mockLoads();
  const { Text } = require("react-native");
  const React = require("react");
  return { MediaViewer: () => React.createElement(Text, null, "viewer"), Video: () => null };
});

const mockHydrated = { value: true };
jest.mock("@mrmeg/expo-ui/hooks/useHydrated", () => ({
  useHydrated: () => mockHydrated.value,
}));

import { LazyMediaViewer } from "../LazyMediaViewer";

const items = [{ type: "image" as const, key: "a", source: "a.jpg", alt: "A" }];

afterEach(() => {
  mockHydrated.value = true;
  mockLoads.mockClear();
});

describe("LazyMediaViewer", () => {
  it("renders nothing while it has never been visible, and loads nothing", async () => {
    await render(<LazyMediaViewer items={items} visible={false} onClose={() => {}} />);

    expect(screen.queryByText("viewer")).toBeNull();
    expect(mockLoads).not.toHaveBeenCalled();
  });

  it("renders nothing before hydration even when visible", async () => {
    mockHydrated.value = false;
    await render(<LazyMediaViewer items={items} visible onClose={() => {}} />);

    expect(screen.queryByText("viewer")).toBeNull();
  });
});
