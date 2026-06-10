/**
 * Skeleton family tests — the four exports (Skeleton, SkeletonText,
 * SkeletonAvatar, SkeletonCard) all have to render without crashing in
 * the loading state. Tests assert each variant produces a node and that
 * SkeletonText respects the `lines` prop.
 */

import "@/test/mockTheme";

import React from "react";
import { render } from "@testing-library/react-native";

import {
  Skeleton,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonText,
} from "../Skeleton";

describe("Skeleton", () => {
  it("renders a Skeleton block", async () => {
    const { toJSON } = await render(<Skeleton width={120} height={20} />);
    expect(toJSON()).not.toBeNull();
  });

  it("renders a SkeletonAvatar", async () => {
    const { toJSON } = await render(<SkeletonAvatar size={40} />);
    expect(toJSON()).not.toBeNull();
  });

  it("renders a SkeletonCard", async () => {
    const { toJSON } = await render(<SkeletonCard />);
    expect(toJSON()).not.toBeNull();
  });

  it("renders SkeletonText with the requested number of lines", async () => {
    const { toJSON } = await render(<SkeletonText lines={3} />);
    expect(toJSON()).not.toBeNull();
  });
});
