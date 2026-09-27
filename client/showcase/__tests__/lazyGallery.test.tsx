/**
 * The showcase cluster is client-only: the server and client trees diverge
 * under Expo Router's SSR (the server renders inside `app/+html.tsx`, the
 * client hydrates `#root`), so every `useId()` differs and a Radix-backed
 * preview rendered on both sides logs a hydration mismatch. The lazy shells
 * therefore render their fallback until hydration and only then mount the
 * lazy chunk.
 */
import React from "react";
import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";

const mockHydrated = { value: false };
jest.mock("@mrmeg/expo-ui/hooks", () => ({
  ...jest.requireActual("@mrmeg/expo-ui/hooks"),
  useHydrated: () => mockHydrated.value,
}));

jest.mock("@/client/showcase/gallery", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Preview: ({ id }: { id: string }) => React.createElement(Text, null, `preview:${id}`),
    BlockStage: ({ id }: { id: string }) => React.createElement(Text, null, `stage:${id}`),
    ShowcaseScreen: () => React.createElement(Text, null, "showcase"),
  };
});

import { ClientOnly, GalleryRoute, LazyBlockStage, LazyPreview } from "../lazyGallery";

function Shells() {
  return (
    <>
      <GalleryRoute screen="ShowcaseScreen" />
      <LazyPreview id="Button" fallback={<Text>preview-fallback</Text>} />
      <LazyBlockStage id="stat-row" fallback={<Text>stage-fallback</Text>} />
    </>
  );
}

describe("lazy gallery shells", () => {
  afterEach(() => {
    mockHydrated.value = false;
  });

  it("render only their fallback while the tree is still hydrating (and on the server)", async () => {
    await render(<Shells />);
    expect(screen.getByTestId("gallery-loading")).toBeTruthy();
    expect(screen.getByText("preview-fallback")).toBeTruthy();
    expect(screen.getByText("stage-fallback")).toBeTruthy();
    expect(screen.queryByText("showcase")).toBeNull();
    expect(screen.queryByText("preview:Button")).toBeNull();
    expect(screen.queryByText("stage:stat-row")).toBeNull();
  });

  // Jest cannot execute the real `import()` (no --experimental-vm-modules), so
  // the live path is pinned on the gate itself with a child that does not
  // suspend: once hydrated, `ClientOnly` mounts its children in place of the
  // fallback. The shells above are that gate around a `React.lazy` child.
  it("mount their children once the client is live", async () => {
    mockHydrated.value = true;
    await render(
      <ClientOnly fallback={<Text>fallback</Text>}>
        <Text>live content</Text>
      </ClientOnly>
    );
    expect(screen.getByText("live content")).toBeTruthy();
    expect(screen.queryByText("fallback")).toBeNull();
  });

  it("keep their children unmounted until then", async () => {
    const mounted = jest.fn();
    function Probe() {
      mounted();
      return <Text>live content</Text>;
    }
    await render(
      <ClientOnly fallback={<Text>fallback</Text>}>
        <Probe />
      </ClientOnly>
    );
    expect(mounted).not.toHaveBeenCalled();
    expect(screen.getByText("fallback")).toBeTruthy();
  });
});
