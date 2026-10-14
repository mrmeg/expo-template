/**
 * The native glyph renderer draws through react-native-svg the way Lucide's
 * own native component does, so native pixels match: one child element per
 * glyph node, each repeating the root's fill, stroke, width, cap, and join
 * before its own attributes.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Circle, Path, Rect, Svg } from "react-native-svg";
import { IconGlyph } from "../IconGlyph";
import type { IconGlyph as IconGlyphData } from "../iconTypes";

const GLYPH: IconGlyphData = [
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
  ["circle", { cx: "9", cy: "9", r: "2", fill: "currentColor" }],
  ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }],
];

function render(element: React.ReactElement): TestRenderer.ReactTestRenderer {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!;
}

describe("IconGlyph (native)", () => {
  it("draws one child per glyph node with the stroke attributes repeated", () => {
    const { root } = render(<IconGlyph glyph={GLYPH} size={20} color="#14B8A6" testID="glyph" />);

    const svg = root.findByType(Svg);
    expect(svg.props).toMatchObject({
      width: 20,
      height: 20,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#14B8A6",
      color: "#14B8A6",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    });

    const children = [root.findByType(Rect), root.findByType(Circle), root.findByType(Path)];
    expect(root.findAllByType(Rect)).toHaveLength(1);
    expect(root.findAllByType(Circle)).toHaveLength(1);
    expect(root.findAllByType(Path)).toHaveLength(1);
    for (const child of children) {
      expect(child.props).toMatchObject({
        stroke: "#14B8A6",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
      });
    }
    expect(children[0].props).toMatchObject({ fill: "none", width: "18", rx: "2" });
    // A node's own attributes win: this fill resolves through the root's `color`.
    expect(children[1].props).toMatchObject({ fill: "currentColor", cx: "9", r: "2" });
    expect(children[2].props.d).toBe("m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21");
  });

  it("puts testID and accessibility props on the host and honors strokeWidth", () => {
    const { root } = render(
      <IconGlyph glyph={GLYPH} size={24} color="#000" strokeWidth={1.5} testID="glyph" accessible={false} aria-hidden />
    );

    const host = root.findAllByProps({ testID: "glyph" }).filter((node) => typeof node.type === "string");
    expect(host).toHaveLength(1);
    expect(host[0].props.accessible).toBe(false);
    expect(host[0].props["aria-hidden"]).toBe(true);
    expect(root.findByType(Path).props.strokeWidth).toBe(1.5);
  });
});
