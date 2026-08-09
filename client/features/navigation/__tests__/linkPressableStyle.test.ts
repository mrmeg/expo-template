/**
 * `linkPressableStyle` — the flattening contract.
 *
 * The reason this helper exists is a web-only crash (see the module docblock and
 * `client/showcase/__tests__/galleries.test.tsx` → "Link asChild style
 * flattening"), so the one assertion that matters everywhere is **never return
 * an array**. Radix's `Slot` merges a child's `style` with an object spread, and
 * spreading an array yields `{ 0: …, 1: … }`.
 */

import { Platform, StyleSheet } from "react-native";

import { linkPressableStyle } from "../linkPressableStyle";

const originalOS = Platform.OS;

afterEach(() => {
  Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true });
});

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
}

describe("linkPressableStyle", () => {
  it("returns a plain object, never an array", () => {
    const result = linkPressableStyle({ padding: 4 }, { margin: 2 });

    expect(Array.isArray(result)).toBe(false);
    expect(result).toEqual({ padding: 4, margin: 2 });
  });

  it("merges left to right, so a later entry wins", () => {
    expect(linkPressableStyle({ flexBasis: "30%" }, { flexBasis: "47%" })).toEqual({
      flexBasis: "47%",
    });
  });

  it("flattens registered StyleSheet entries, not just literals", () => {
    // A registered style is an opaque id on native; only `flatten` resolves it.
    const styles = StyleSheet.create({
      card: { backgroundColor: "red", borderWidth: 1 },
    });

    expect(linkPressableStyle(styles.card, { flexBasis: "47%" })).toEqual({
      backgroundColor: "red",
      borderWidth: 1,
      flexBasis: "47%",
    });
  });

  it("drops null / undefined / false entries instead of keying them by index", () => {
    // The pre-fix idiom was `[styles.card, cond ? {…} : null]`; the falsy branch
    // is exactly what became `{ 1: null }` once spread.
    const result = linkPressableStyle({ padding: 4 }, null, undefined);

    expect(Array.isArray(result)).toBe(false);
    expect(Object.keys(result)).toEqual(["padding"]);
  });

  it("produces no numeric keys even for a nested array", () => {
    const result = linkPressableStyle([{ padding: 4 }, [{ margin: 2 }]]);

    expect(Object.keys(result).some((key) => /^\d+$/.test(key))).toBe(false);
    expect(result).toEqual({ padding: 4, margin: 2 });
  });

  it("adds the pointer cursor on web", () => {
    setPlatform("web");
    expect(linkPressableStyle({ padding: 4 })).toEqual({ padding: 4, cursor: "pointer" });
  });

  it("leaves cursor off on native, where it is meaningless", () => {
    setPlatform("ios");
    expect(linkPressableStyle({ padding: 4 })).toEqual({ padding: 4 });
  });

  it("still returns an object with no arguments", () => {
    expect(linkPressableStyle()).toEqual({});
  });
});
