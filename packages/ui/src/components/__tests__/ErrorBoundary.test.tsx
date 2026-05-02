import React from "react";
import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { ErrorBoundary } from "../ErrorBoundary";

function ThrowingChild(): React.ReactNode {
  throw new Error("render failed");
}

describe("ErrorBoundary", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("calls the app-owned error reporter when a child throws", () => {
    const onError = jest.fn();

    render(
      <ErrorBoundary
        catchErrors="always"
        FallbackComponent={() => <Text>Recovered</Text>}
        onError={onError}
      >
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByText("Recovered")).toBeTruthy();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({
      componentStack: expect.any(String),
    }));
  });
});
