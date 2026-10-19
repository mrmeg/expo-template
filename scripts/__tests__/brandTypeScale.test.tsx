/**
 * Ties the type roles in `docs/brand.md` to what `StyledText` renders.
 *
 * The brand guide once stated Tailwind numbers (body 16/24, captions 14/20)
 * that nothing in the kit renders: they belong to the separate `typography`
 * constant, which is not the text scale. This test parses `<role> <size>/<lineHeight>`
 * for each role out of the guide's Type section and compares it with the
 * `fontSize` and `lineHeight` that `<StyledText semantic={role}>` resolves to,
 * so the doc and the scale cannot drift apart again.
 *
 * The scale has no `Platform` branch, so one run covers iOS, Android, and web.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { StyleSheet } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { StyledText, type SemanticVariant } from "@mrmeg/expo-ui/components/StyledText";

const brandDoc = readFileSync(join(__dirname, "..", "..", "docs", "brand.md"), "utf8");

/** The Type section: from its heading to the next `## ` heading, whitespace collapsed. */
function typeSection(): string {
  const match = /^## Type\s*$([\s\S]*?)(?=^## )/m.exec(brandDoc);
  if (!match) throw new Error("docs/brand.md has no `## Type` section");
  return match[1].replace(/\s+/g, " ");
}

const ROLES = ["body", "label", "caption", "subheading", "heading", "title"] as const satisfies readonly SemanticVariant[];

/** `<role> <size>/<lineHeight>` as the doc states it, e.g. `body 15/24.75`. */
function documentedRole(section: string, role: string): { fontSize: number; lineHeight: number } {
  const match = new RegExp(`(?<![\\w-])${role} (\\d+(?:\\.\\d+)?)/(\\d+(?:\\.\\d+)?)`).exec(section);
  if (!match) {
    throw new Error(`docs/brand.md Type section states no "${role} <size>/<lineHeight>"`);
  }
  return { fontSize: Number(match[1]), lineHeight: Number(match[2]) };
}

describe("docs/brand.md Type section", () => {
  it.each(ROLES)("states the size and line height StyledText renders for %s", async (role) => {
    const documented = documentedRole(typeSection(), role);

    await render(<StyledText semantic={role}>x</StyledText>);
    const rendered = StyleSheet.flatten(screen.getByText("x").props.style) as {
      fontSize: number;
      lineHeight: number;
    };

    expect({ fontSize: rendered.fontSize, lineHeight: rendered.lineHeight }).toEqual(documented);
  });

  it("does not state the Tailwind typography table's 16/24 or 14/20", () => {
    const section = typeSection();

    expect(section).not.toMatch(/(?<!\d)16\/24(?!\d)/);
    expect(section).not.toMatch(/(?<!\d)14\/20(?!\d)/);
  });
});
