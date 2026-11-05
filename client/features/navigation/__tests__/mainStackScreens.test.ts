/**
 * A stack screen with no title shows its route name in the header, such as
 * `(demos)/screen-faq`. Every route in the stack has to declare a title in the
 * shared list or hide the header, and a new route that skips the list fails here.
 */
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { MAIN_STACK_SCREENS } from "../mainStackScreens";

jest.mock("expo-router", () => ({ Stack: { Screen: () => null } }));
jest.mock("@/client/features/navigation/WebBackButton", () => ({ WebBackButton: () => null }));

const MAIN_DIR = join(process.cwd(), "app/(main)");

function demoRoutes(dir = join(MAIN_DIR, "(demos)")): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return demoRoutes(path);
    return [relative(MAIN_DIR, path).replace(/\.tsx$/, "")];
  });
}

function resolvedOptions(name: string, params: Record<string, string> = {}) {
  const screen = MAIN_STACK_SCREENS.find((candidate) => candidate.name === name);
  if (!screen) throw new Error(`${name} is not in MAIN_STACK_SCREENS`);
  const { options } = screen;
  const resolve = options as (props: unknown) => { title?: string; headerShown?: boolean };
  return typeof options === "function" ? resolve({ route: { params } }) : options;
}

describe("MAIN_STACK_SCREENS", () => {
  it("lists every demo route", () => {
    const listed = new Set(MAIN_STACK_SCREENS.map(({ name }) => name));
    expect(demoRoutes().filter((route) => !listed.has(route))).toEqual([]);
  });

  it.each(demoRoutes())("gives %s a title or hides its header", (route) => {
    const options = resolvedOptions(route, { id: "Button", example: "alpha" });
    expect(options?.headerShown === false || Boolean(options?.title)).toBe(true);
  });

  it("titles the component detail route from the URL before its lazy screen loads", () => {
    expect(resolvedOptions("(demos)/components/[id]", { id: "Button" })?.title).toBe("Button");
    expect(resolvedOptions("(demos)/components/[id]")?.title).toBe("Component");
  });
});
