/**
 * Progress component tests
 *
 * Tests determinate/indeterminate modes and accessibility attributes.
 */

import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Progress } from "../Progress";

// Mock useTheme hook
jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: "#18181B",
        accent: "#14B8A6",
        destructive: "#EF4444",
        muted: "#F1F5F9",
      },
    },
    getShadowStyle: () => ({}),
  }),
}));

describe("Progress", () => {
  it("renders in determinate mode with value", () => {
    render(<Progress value={50} />);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeTruthy();
  });

  it("sets aria-valuenow for determinate mode", () => {
    render(<Progress value={75} />);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.props["aria-valuenow"]).toBe(75);
  });

  it("renders in indeterminate mode without value", () => {
    render(<Progress />);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.props["aria-valuenow"]).toBeUndefined();
  });

  it("clamps value between 0 and 100", () => {
    render(<Progress value={150} />);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.props["aria-valuenow"]).toBe(100);
  });

  it("renders all size variants", () => {
    const sizes = ["sm", "md", "lg"] as const;

    sizes.forEach((size) => {
      const { unmount } = render(<Progress value={50} size={size} />);
      expect(screen.getByRole("progressbar")).toBeTruthy();
      unmount();
    });
  });

  it("renders all color variants", () => {
    const variants = ["default", "accent", "destructive"] as const;

    variants.forEach((variant) => {
      const { unmount } = render(<Progress value={50} variant={variant} />);
      expect(screen.getByRole("progressbar")).toBeTruthy();
      unmount();
    });
  });

  it("sets busy accessibility state for indeterminate mode", () => {
    render(<Progress />);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.props.accessibilityState).toEqual(
      expect.objectContaining({ busy: true })
    );
  });
});
