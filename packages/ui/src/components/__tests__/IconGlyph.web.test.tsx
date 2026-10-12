/**
 * @jest-environment node
 */
/**
 * The web and server glyph renderer, rendered through `react-dom/server` in
 * Node with no DOM, exactly as server rendering does. The jest-expo preset
 * resolves `../IconGlyph` to the `.native` file, so the web file is required by
 * its explicit path.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { IconGlyph as IconGlyphData } from "../iconTypes";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { IconGlyph } = require("../IconGlyph.tsx") as typeof import("../IconGlyph");

const GLYPH: IconGlyphData = [
  ["path", { d: "M20 6 9 17l-5-5" }],
  ["circle", { cx: "12", cy: "12", r: "2", fill: "currentColor" }],
];

const markup = (props: Partial<React.ComponentProps<typeof IconGlyph>>) =>
  renderToStaticMarkup(createElement(IconGlyph, { glyph: GLYPH, size: 16, color: "var(--c-foreground)", ...props }));

describe("IconGlyph (web and server)", () => {
  it("emits an inline svg with its children, stroking currentColor", () => {
    const html = markup({ "aria-hidden": true });

    expect(html).toMatch(/^<svg [^>]*>.*<\/svg>$/);
    expect(html).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(html).toContain('width="16"');
    expect(html).toContain('height="16"');
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('fill="none"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-width="2"');
    expect(html).toContain('stroke-linecap="round"');
    expect(html).toContain('stroke-linejoin="round"');
    expect(html).toContain('<path d="M20 6 9 17l-5-5"></path>');
    expect(html).toContain('<circle cx="12" cy="12" r="2" fill="currentColor"></circle>');
  });

  it("carries the color as a style, so a theme change recolors through CSS", () => {
    const html = markup({ "aria-hidden": true });
    const style = html.match(/style="([^"]*)"/)?.[1] ?? "";

    expect(style).toContain("color:var(--c-foreground)");
    expect(style).toContain("pointer-events:none");
  });

  it("hides an unlabeled icon and names a labeled one", () => {
    const hidden = markup({ "aria-hidden": true });
    expect(hidden).toContain('aria-hidden="true"');
    expect(hidden).not.toContain("role=");

    const labeled = markup({ role: "img", "aria-label": "Saved" });
    expect(labeled).toContain('role="img"');
    expect(labeled).toContain('aria-label="Saved"');
    expect(labeled).not.toContain("aria-hidden");
  });

  it("converts an RN style array and maps testID to data-testid", () => {
    const html = markup({ style: [{ marginRight: 4 }, { opacity: 0.5 }], testID: "icon-check", "aria-hidden": true });
    const style = html.match(/style="([^"]*)"/)?.[1] ?? "";

    expect(style).toContain("margin-right:4px");
    expect(style).toContain("opacity:0.5");
    expect(style).toContain("color:var(--c-foreground)");
    expect(html).toContain('data-testid="icon-check"');
  });
});
