import React from "react";
import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { Hydrated } from "../Hydrated";

const mockHydrated = { value: false };
jest.mock("../../hooks/useHydrated", () => ({
  useHydrated: () => mockHydrated.value,
}));

describe("Hydrated", () => {
  afterEach(() => {
    mockHydrated.value = false;
  });

  it("renders the fallback and keeps its children unmounted on the server and while hydrating", async () => {
    const mounted = jest.fn();
    function Child() {
      mounted();
      return <Text>client only</Text>;
    }
    await render(
      <Hydrated fallback={<Text>placeholder</Text>}>
        <Child />
      </Hydrated>,
    );
    expect(screen.getByText("placeholder")).toBeTruthy();
    expect(screen.queryByText("client only")).toBeNull();
    expect(mounted).not.toHaveBeenCalled();
  });

  it("renders nothing by default before hydration", async () => {
    const { toJSON } = await render(
      <Hydrated>
        <Text>client only</Text>
      </Hydrated>,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders its children once the client is live", async () => {
    mockHydrated.value = true;
    await render(
      <Hydrated fallback={<Text>placeholder</Text>}>
        <Text>client only</Text>
      </Hydrated>,
    );
    expect(screen.getByText("client only")).toBeTruthy();
    expect(screen.queryByText("placeholder")).toBeNull();
  });
});
