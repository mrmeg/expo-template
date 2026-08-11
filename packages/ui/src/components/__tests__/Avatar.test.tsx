/**
 * Avatar / AvatarGroup tests.
 *
 * Covers the things that are easy to get wrong and impossible to see from a
 * snapshot: initials derivation (including unicode, where a naive `charAt(0)`
 * splits an astral pair or drops a combining mark), the
 * image -> initials -> icon fallback order (both while an image is in flight
 * and after it fails), which source shapes are actually attempted (a valid
 * non-uri source used to be silently dropped), and AvatarGroup's `max` / `+N`
 * arithmetic plus its accessibility structure (members must stay
 * individually announceable inside the group).
 *
 * Unicode literals are written as escapes so the assertions can't drift with
 * however an editor happens to normalize this file.
 */

import "@/test/mockTheme";

import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";

import { Avatar, AvatarGroup, getAvatarInitials } from "../Avatar";
import { spacing } from "../../constants/spacing";

const REMOTE = { uri: "https://example.com/ada.png" };
const HIDDEN = { includeHiddenElements: true } as const;

/** Host `Image` elements in the tree — RNTL has no by-type query. */
function images(): TestInstance[] {
  return screen.root?.queryAll((node) => node.type === "Image") ?? [];
}

function flatStyle(instance: TestInstance): ViewStyle {
  return (StyleSheet.flatten(instance.props.style) ?? {}) as ViewStyle;
}

/** Style value narrowed to a number, for the assertions that compare magnitude. */
function numericStyle(instance: TestInstance, key: keyof ViewStyle): number | undefined {
  const value = flatStyle(instance)[key];
  return typeof value === "number" ? value : undefined;
}

describe("getAvatarInitials", () => {
  it("returns a single initial for a one-word name", () => {
    expect(getAvatarInitials("Ada")).toBe("A");
  });

  it("returns first + last initials for a multi-word name", () => {
    expect(getAvatarInitials("Ada Lovelace")).toBe("AL");
  });

  it("skips middle names and collapses extra whitespace", () => {
    expect(getAvatarInitials("  ada   byron   king  ")).toBe("AK");
  });

  it("uppercases the derived initials", () => {
    expect(getAvatarInitials("grace hopper")).toBe("GH");
  });

  it("returns an empty string for missing or blank names", () => {
    expect(getAvatarInitials(undefined)).toBe("");
    expect(getAvatarInitials("")).toBe("");
    expect(getAvatarInitials("   ")).toBe("");
  });

  it("handles accented latin names", () => {
    // "\u00C5sa \u00D6berg" (precomposed).
    expect(getAvatarInitials("\u00C5sa \u00D6berg")).toBe("\u00C5\u00D6");
  });

  it("keeps a combining mark attached to its base character", () => {
    // "\u00E9lodie dupont" with a DECOMPOSED e-acute (e + U+0301) \u2014 the form a
    // native keyboard or an unnormalized API payload can produce. `charAt(0)`
    // would return a bare "E" here.
    expect(getAvatarInitials("e\u0301lodie dupont")).toBe("\u00C9D");
  });

  it("treats CJK names as a single word", () => {
    expect(getAvatarInitials("李雷")).toBe("李");
  });

  it("does not split an astral code point", () => {
    // A naive charAt(0) yields a lone surrogate here.
    expect(getAvatarInitials("🙂 bob")).toBe("🙂B");
  });
});

describe("Avatar", () => {
  it("renders the image when a source is provided", async () => {
    await render(<Avatar source={REMOTE} name="Ada Lovelace" />);

    expect(images()).toHaveLength(1);
  });

  it("shows the initials until the image reports a successful load", async () => {
    await render(<Avatar source={REMOTE} name="Ada Lovelace" />);

    // A slow image must not leave a bare muted tile.
    expect(screen.getByText("AL", HIDDEN)).toBeTruthy();

    await fireEvent(images()[0], "load");

    expect(images()).toHaveLength(1);
    expect(screen.queryByText("AL", HIDDEN)).toBeNull();
  });

  it("shows the icon while a nameless avatar's image is loading", async () => {
    await render(<Avatar source={REMOTE} icon="camera" />);

    expect(screen.getByTestId("icon-Feather", HIDDEN).props.name).toBe("camera");

    await fireEvent(images()[0], "load");

    expect(screen.queryByTestId("icon-Feather", HIDDEN)).toBeNull();
  });

  it("returns to the fallback when the source changes after a load", async () => {
    await render(<Avatar source={REMOTE} name="Ada Lovelace" />);
    await fireEvent(images()[0], "load");
    expect(screen.queryByText("AL", HIDDEN)).toBeNull();

    await screen.rerender(
      <Avatar source={{ uri: "https://example.com/ada-2.png" }} name="Ada Lovelace" />,
    );

    expect(screen.getByText("AL", HIDDEN)).toBeTruthy();
  });

  it("rounds the image itself, not only the clipping wrapper", async () => {
    // Android leaves square corners on a child image in several cases where
    // the wrapper's overflow: "hidden" should have clipped it.
    await render(
      <View>
        <Avatar source={REMOTE} name="Circle" />
        <Avatar source={REMOTE} name="Square" shape="square" />
      </View>,
    );

    const [circle, square] = images();
    expect(numericStyle(circle, "borderRadius")).toBe(spacing.radiusFull);
    const squared = numericStyle(square, "borderRadius");
    expect(squared).toBeGreaterThan(0);
    expect(squared).toBeLessThan(spacing.radiusFull);
  });

  it("sizes the overlaid image to the tile, not the asset", async () => {
    // The image is absolutely positioned over the fallback, and the explicit
    // 100% size must survive: react-native-web ignores the inset box for an
    // Image's size and falls back to the asset's natural pixels — a 1024px
    // photo blown out of (and clipped away by) a 48px tile.
    await render(<Avatar source={REMOTE} name="Ada Lovelace" />);

    const [image] = images();
    expect(StyleSheet.flatten(image.props.style)).toMatchObject({
      position: "absolute",
      width: "100%",
      height: "100%",
    });
  });

  it("falls back to initials when the image fails to load", async () => {
    await render(<Avatar source={REMOTE} name="Ada Lovelace" />);

    await fireEvent(images()[0], "error");

    expect(images()).toHaveLength(0);
    expect(screen.getByText("AL", HIDDEN)).toBeTruthy();
  });

  it("retries the image when the source changes after a failure", async () => {
    await render(<Avatar source={REMOTE} name="Ada Lovelace" />);
    await fireEvent(images()[0], "error");
    expect(images()).toHaveLength(0);

    await screen.rerender(
      <Avatar source={{ uri: "https://example.com/ada-2.png" }} name="Ada Lovelace" />,
    );

    expect(images()).toHaveLength(1);
  });

  it("keeps the fallback when the same source re-renders as a new object", async () => {
    await render(<Avatar source={{ uri: REMOTE.uri }} name="Ada Lovelace" />);
    await fireEvent(images()[0], "error");

    // Inline `{{ uri }}` literals produce a fresh object every render; the
    // failure must not reset, or the avatar loops image -> error -> image.
    await screen.rerender(<Avatar source={{ uri: REMOTE.uri }} name="Ada Lovelace" />);

    expect(images()).toHaveLength(0);
    expect(screen.getByText("AL", HIDDEN)).toBeTruthy();
  });

  it("attempts a non-uri object source instead of degrading to initials", async () => {
    // An iOS asset-bundle source carries no `uri`. It is a valid source, so the
    // avatar must hand it to Image rather than treat it as "no image".
    await render(<Avatar source={{ bundle: "Avatars" }} name="Ada Lovelace" />);

    expect(images()).toHaveLength(1);
  });

  it("attempts a require()'d asset source", async () => {
    await render(<Avatar source={42} name="Ada Lovelace" />);

    expect(images()).toHaveLength(1);
  });

  it("attempts a multi-resolution array source", async () => {
    await render(
      <Avatar
        source={[
          { uri: REMOTE.uri, width: 40, height: 40 },
          { uri: "https://example.com/ada@2x.png", width: 80, height: 80 },
        ]}
        name="Ada Lovelace"
      />,
    );

    expect(images()).toHaveLength(1);
  });

  it("keeps a failure per non-uri source and clears it when that source changes", async () => {
    await render(<Avatar source={{ bundle: "Avatars" }} name="Ada Lovelace" />);
    await fireEvent(images()[0], "error");
    expect(images()).toHaveLength(0);

    // Same content, new object identity: the failure must survive, or the
    // avatar loops image -> error -> image.
    await screen.rerender(<Avatar source={{ bundle: "Avatars" }} name="Ada Lovelace" />);
    expect(images()).toHaveLength(0);

    await screen.rerender(<Avatar source={{ bundle: "Portraits" }} name="Ada Lovelace" />);
    expect(images()).toHaveLength(1);
  });

  it("renders initials when there is no source", async () => {
    await render(<Avatar name="Ada Lovelace" />);

    expect(images()).toHaveLength(0);
    expect(screen.getByText("AL", HIDDEN)).toBeTruthy();
    expect(screen.queryByTestId("icon-Feather", HIDDEN)).toBeNull();
  });

  it("prefers initials over the icon when both a name and an icon are given", async () => {
    await render(<Avatar name="Ada Lovelace" icon="camera" />);

    expect(screen.getByText("AL", HIDDEN)).toBeTruthy();
    expect(screen.queryByTestId("icon-Feather", HIDDEN)).toBeNull();
  });

  it("renders the given icon when there is no name", async () => {
    await render(<Avatar icon="camera" />);

    expect(screen.getByTestId("icon-Feather", HIDDEN).props.name).toBe("camera");
  });

  it("renders the default user icon when there is no source, name, or icon", async () => {
    await render(<Avatar />);

    expect(screen.getByTestId("icon-Feather", HIDDEN).props.name).toBe("user");
  });

  it("falls back to the icon when a name has no derivable initials", async () => {
    await render(<Avatar name="   " icon="camera" />);

    expect(screen.getByTestId("icon-Feather", HIDDEN).props.name).toBe("camera");
  });

  it("labels itself with the name by default", async () => {
    await render(<Avatar name="Ada Lovelace" />);

    expect(screen.getByLabelText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toBeTruthy();
  });

  it("lets an explicit accessibilityLabel win over the name", async () => {
    await render(<Avatar name="Ada Lovelace" accessibilityLabel="Account owner" />);

    expect(screen.getByLabelText("Account owner")).toBeTruthy();
    expect(screen.queryByLabelText("Ada Lovelace")).toBeNull();
  });

  it("stays out of the accessibility tree when there is nothing to announce", async () => {
    await render(<Avatar icon="camera" />);

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("sizes the md token by default and honours the size tokens", async () => {
    await render(
      <>
        <Avatar name="Small" size="sm" accessibilityLabel="sm" />
        <Avatar name="Medium" accessibilityLabel="md" />
        <Avatar name="Large" size="lg" accessibilityLabel="lg" />
      </>,
    );

    expect(flatStyle(screen.getByLabelText("sm"))).toMatchObject({ width: 32, height: 32 });
    expect(flatStyle(screen.getByLabelText("md"))).toMatchObject({ width: 40, height: 40 });
    expect(flatStyle(screen.getByLabelText("lg"))).toMatchObject({ width: 48, height: 48 });
  });

  it("accepts a numeric size", async () => {
    await render(<Avatar name="Ada" size={88} />);

    expect(flatStyle(screen.getByLabelText("Ada"))).toMatchObject({ width: 88, height: 88 });
  });

  it("is circular by default and rounded-square when shape is square", async () => {
    await render(
      <>
        <Avatar name="Circle" accessibilityLabel="circle" />
        <Avatar name="Square" shape="square" accessibilityLabel="square" />
      </>,
    );

    expect(numericStyle(screen.getByLabelText("circle"), "borderRadius")).toBe(spacing.radiusFull);
    const squareRadius = numericStyle(screen.getByLabelText("square"), "borderRadius");
    expect(squareRadius).toBeGreaterThan(0);
    expect(squareRadius).toBeLessThan(spacing.radiusFull);
  });
});

describe("AvatarGroup", () => {
  it("renders every child when max is not set", async () => {
    await render(
      <AvatarGroup>
        <Avatar name="Ada Lovelace" />
        <Avatar name="Grace Hopper" />
        <Avatar name="Katherine Johnson" />
      </AvatarGroup>,
    );

    expect(screen.getByText("AL", HIDDEN)).toBeTruthy();
    expect(screen.getByText("GH", HIDDEN)).toBeTruthy();
    expect(screen.getByText("KJ", HIDDEN)).toBeTruthy();
    expect(screen.queryByText(/^\+/, HIDDEN)).toBeNull();
  });

  it("truncates to max and renders a +N overflow avatar", async () => {
    await render(
      <AvatarGroup max={3}>
        <Avatar name="Ada Lovelace" />
        <Avatar name="Grace Hopper" />
        <Avatar name="Katherine Johnson" />
        <Avatar name="Mary Jackson" />
        <Avatar name="Dorothy Vaughan" />
      </AvatarGroup>,
    );

    expect(screen.getByText("AL", HIDDEN)).toBeTruthy();
    expect(screen.getByText("GH", HIDDEN)).toBeTruthy();
    expect(screen.getByText("KJ", HIDDEN)).toBeTruthy();
    expect(screen.queryByText("MJ", HIDDEN)).toBeNull();
    expect(screen.queryByText("DV", HIDDEN)).toBeNull();
    expect(screen.getByText("+2", HIDDEN)).toBeTruthy();
  });

  it("does not render an overflow avatar when the child count equals max", async () => {
    await render(
      <AvatarGroup max={2}>
        <Avatar name="Ada Lovelace" />
        <Avatar name="Grace Hopper" />
      </AvatarGroup>,
    );

    expect(screen.queryByText(/^\+/, HIDDEN)).toBeNull();
  });

  it("ignores nullish children when counting", async () => {
    const absent = false;
    await render(
      <AvatarGroup max={1}>
        <Avatar name="Ada Lovelace" />
        {absent && <Avatar name="Grace Hopper" />}
        {null}
      </AvatarGroup>,
    );

    expect(screen.queryByText(/^\+/, HIDDEN)).toBeNull();
  });

  it("keeps overlap and stacking order after the children are reordered", async () => {
    const names = ["Ada Lovelace", "Grace Hopper", "Katherine Johnson"];
    const group = (order: string[]) => (
      <AvatarGroup>
        {order.map((name) => (
          <Avatar key={name} name={name} accessibilityLabel={name} />
        ))}
      </AvatarGroup>
    );

    await render(group(names));
    await screen.rerender(group([...names].reverse()));

    const wrapperOf = (label: string) => screen.getByLabelText(label).parent;
    const reversed = [...names].reverse();

    // Only the leading avatar goes un-overlapped, and z-index still descends
    // left-to-right — a wrapper that stayed glued to the wrong avatar would
    // leave two un-overlapped tiles or an inverted stack.
    expect(numericStyle(wrapperOf(reversed[0])!, "marginLeft")).toBeUndefined();
    expect(numericStyle(wrapperOf(reversed[1])!, "marginLeft")).toBeLessThan(0);
    expect(numericStyle(wrapperOf(reversed[2])!, "marginLeft")).toBeLessThan(0);

    const zIndexes = reversed.map((name) => flatStyle(wrapperOf(name)!).zIndex);
    expect(zIndexes).toEqual([3, 2, 1]);
  });

  it("renders only the overflow tile when max is 0", async () => {
    await render(
      <AvatarGroup max={0}>
        <Avatar name="Ada Lovelace" />
        <Avatar name="Grace Hopper" />
      </AvatarGroup>,
    );

    expect(screen.queryByText("AL", HIDDEN)).toBeNull();
    expect(screen.queryByText("GH", HIDDEN)).toBeNull();
    expect(screen.getByText("+2", HIDDEN)).toBeTruthy();
  });

  it("treats a negative max as 0 instead of rendering everything", async () => {
    // `slice(0, -1)` would drop only the last child; `slice(0, -3)` would
    // return every child, silently disabling the clamp.
    await render(
      <AvatarGroup max={-3}>
        <Avatar name="Ada Lovelace" />
        <Avatar name="Grace Hopper" />
      </AvatarGroup>,
    );

    expect(screen.queryByText("AL", HIDDEN)).toBeNull();
    expect(screen.queryByText("GH", HIDDEN)).toBeNull();
    expect(screen.getByText("+2", HIDDEN)).toBeTruthy();
  });

  it("floors a fractional max", async () => {
    await render(
      <AvatarGroup max={2.7}>
        <Avatar name="Ada Lovelace" />
        <Avatar name="Grace Hopper" />
        <Avatar name="Katherine Johnson" />
      </AvatarGroup>,
    );

    expect(screen.getByText("AL", HIDDEN)).toBeTruthy();
    expect(screen.getByText("GH", HIDDEN)).toBeTruthy();
    expect(screen.queryByText("KJ", HIDDEN)).toBeNull();
    expect(screen.getByText("+1", HIDDEN)).toBeTruthy();
  });

  it("announces the total count, including the hidden overflow", async () => {
    await render(
      <AvatarGroup max={2}>
        <Avatar name="Ada Lovelace" />
        <Avatar name="Grace Hopper" />
        <Avatar name="Katherine Johnson" />
        <Avatar name="Mary Jackson" />
      </AvatarGroup>,
    );

    expect(screen.getByText("4 avatars")).toBeTruthy();
  });

  it("lets an explicit accessibilityLabel replace the count", async () => {
    await render(
      <AvatarGroup accessibilityLabel="Project collaborators">
        <Avatar name="Ada Lovelace" />
      </AvatarGroup>,
    );

    expect(screen.getByText("Project collaborators")).toBeTruthy();
    expect(screen.queryByText("1 avatars")).toBeNull();
  });

  it("keeps every member individually announceable inside the group", async () => {
    await render(
      <AvatarGroup max={2}>
        <Avatar name="Ada Lovelace" />
        <Avatar name="Grace Hopper" />
        <Avatar name="Katherine Johnson" />
      </AvatarGroup>,
    );

    // An `accessible` container with role="image" swallowed these on iOS and
    // made them unreachable behind a leaf `img` role on the web.
    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Grace Hopper" })).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("does not give the group container its own accessibility semantics", async () => {
    await render(
      <AvatarGroup>
        <Avatar name="Ada Lovelace" />
      </AvatarGroup>,
    );

    // The group wrapper is the outermost View; it must stay a plain container.
    const container = screen.getByText("1 avatars").parent?.parent;
    expect(container?.props.accessible).toBeUndefined();
    expect(container?.props.accessibilityRole).toBeUndefined();
    expect(container?.props.accessibilityLabel).toBeUndefined();
  });

  it("keeps the count summary out of the visible layout", async () => {
    await render(
      <AvatarGroup>
        <Avatar name="Ada Lovelace" />
      </AvatarGroup>,
    );

    // Clipped to 1x1 rather than hidden: display:none / opacity:0 nodes are
    // skipped by screen readers, so the summary would never be announced.
    const clip = flatStyle(screen.getByText("1 avatars").parent!);
    expect(clip.position).toBe("absolute");
    expect(clip.width).toBe(1);
    expect(clip.height).toBe(1);
    expect(clip.overflow).toBe("hidden");
    expect(clip.display).not.toBe("none");
  });

  it("applies the group size to children that do not set one", async () => {
    await render(
      <AvatarGroup size="lg">
        <Avatar name="Ada Lovelace" accessibilityLabel="inherits" />
        <Avatar name="Grace Hopper" size="sm" accessibilityLabel="explicit" />
      </AvatarGroup>,
    );

    expect(flatStyle(screen.getByLabelText("inherits"))).toMatchObject({ width: 48, height: 48 });
    expect(flatStyle(screen.getByLabelText("explicit"))).toMatchObject({ width: 32, height: 32 });
  });

  it("applies the group shape to children that do not set one", async () => {
    await render(
      <AvatarGroup shape="square">
        <Avatar name="Ada Lovelace" accessibilityLabel="inherits" />
        <Avatar name="Grace Hopper" shape="circle" accessibilityLabel="explicit" />
      </AvatarGroup>,
    );

    expect(numericStyle(screen.getByLabelText("inherits"), "borderRadius"))
      .toBeLessThan(spacing.radiusFull);
    expect(numericStyle(screen.getByLabelText("explicit"), "borderRadius"))
      .toBe(spacing.radiusFull);
  });

  it("rings grouped avatars in the background color so they read on any surface", async () => {
    await render(
      <AvatarGroup>
        <Avatar name="Ada Lovelace" accessibilityLabel="grouped" />
      </AvatarGroup>,
    );

    const grouped = screen.getByLabelText("grouped");
    expect(numericStyle(grouped, "borderWidth")).toBeGreaterThan(0);
    expect(flatStyle(grouped).borderColor).toBe("#FFFFFF");
  });

  it("does not ring a standalone avatar", async () => {
    await render(<Avatar name="Ada Lovelace" accessibilityLabel="solo" />);

    expect(numericStyle(screen.getByLabelText("solo"), "borderWidth")).toBeUndefined();
  });

  it("overlaps every avatar after the first", async () => {
    await render(
      <AvatarGroup>
        <Avatar name="Ada Lovelace" accessibilityLabel="first" />
        <Avatar name="Grace Hopper" accessibilityLabel="second" />
      </AvatarGroup>,
    );

    const marginOf = (label: string) => {
      const parent = screen.getByLabelText(label).parent;
      return parent ? numericStyle(parent, "marginLeft") : undefined;
    };

    expect(marginOf("first")).toBeUndefined();
    expect(marginOf("second")).toBeLessThan(0);
  });
});
