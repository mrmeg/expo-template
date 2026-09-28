/**
 * @jest-environment node
 */

/**
 * The SSR stylesheet flush serializes react-native-web's server-wide sheet
 * into every server render. These tests run it against a real
 * react-native-web StyleSheet in its server mode (no DOM) and pin the cache:
 * an unchanged sheet is reused as is, and a render that registers new rules
 * still flushes them.
 */

import type { ReactElement } from "react";

type RnwStyleSheet = {
  create: <T extends Record<string, object>>(styles: T) => T;
  getSheet: () => { id: string; textContent: string };
};

/** A fresh react-native-web StyleSheet module — its sheet is module state. */
function freshStyleSheet(): RnwStyleSheet {
  let sheet!: RnwStyleSheet;
  jest.isolateModules(() => {
    // The CommonJS build exports the StyleSheet function itself.
    sheet = require("react-native-web/dist/cjs/exports/StyleSheet");
  });
  return sheet;
}

type FlushModule = typeof import("../SsrStyleFlush");

/** SsrStyleFlush loaded as the server web render loads it, bound to `sheet`. */
function loadServerFlush(sheet: RnwStyleSheet): FlushModule {
  let flush!: FlushModule;
  jest.isolateModules(() => {
    jest.doMock("react-native", () => ({ Platform: { OS: "web" }, StyleSheet: sheet }));
    flush = require("../SsrStyleFlush");
  });
  return flush;
}

function flushedText(element: ReactElement | null): string {
  expect(element).not.toBeNull();
  return (element as ReactElement<{ children: string }>).props.children;
}

afterEach(() => {
  jest.dontMock("react-native");
});

describe("readFlushedSheet", () => {
  it("serializes once and reuses the text while no rules are added", () => {
    const sheet = freshStyleSheet();
    const { readFlushedSheet, trackStyleSheetRules } = loadServerFlush(freshStyleSheet());
    trackStyleSheetRules(sheet);
    sheet.create({ box: { paddingTop: 11 } });
    const getSheet = jest.spyOn(sheet, "getSheet");

    const first = readFlushedSheet(sheet);
    const second = readFlushedSheet(sheet);

    expect(getSheet).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(first).toContain("padding-top:11px");
    expect(first).toMatch(/^\.(r-[\w-]+)\.\1\{padding-top:11px;\}$/m);
  });

  it("re-serializes after StyleSheet.create adds rules", () => {
    const sheet = freshStyleSheet();
    const { readFlushedSheet, trackStyleSheetRules } = loadServerFlush(freshStyleSheet());
    trackStyleSheetRules(sheet);
    const before = readFlushedSheet(sheet);
    const getSheet = jest.spyOn(sheet, "getSheet");

    sheet.create({ card: { marginLeft: 23 } });
    const after = readFlushedSheet(sheet);

    expect(getSheet).toHaveBeenCalledTimes(1);
    expect(before).not.toContain("margin-left:23px");
    expect(after).toMatch(/^\.(r-[\w-]+)\.\1\{margin-left:23px;\}$/m);
  });

  it("re-serializes an untracked sheet on every read", () => {
    const sheet = freshStyleSheet();
    const { readFlushedSheet } = loadServerFlush(freshStyleSheet());
    const getSheet = jest.spyOn(sheet, "getSheet");

    readFlushedSheet(sheet);
    readFlushedSheet(sheet);
    expect(getSheet).toHaveBeenCalledTimes(2);
  });

  it("wraps create once, however many copies of the module track the sheet", () => {
    const sheet = freshStyleSheet();
    const first = loadServerFlush(freshStyleSheet());
    const second = loadServerFlush(freshStyleSheet());

    first.trackStyleSheetRules(sheet);
    const tracked = sheet.create;
    second.trackStyleSheetRules(sheet);
    expect(sheet.create).toBe(tracked);

    // Both copies see the same counter, so neither serves a stale cache.
    const getSheet = jest.spyOn(sheet, "getSheet");
    first.readFlushedSheet(sheet);
    second.readFlushedSheet(sheet);
    sheet.create({ row: { gap: 7 } });
    expect(first.readFlushedSheet(sheet)).toContain("gap:7px");
    expect(second.readFlushedSheet(sheet)).toContain("gap:7px");
    expect(getSheet).toHaveBeenCalledTimes(4);
  });
});

describe("SsrStyleFlush", () => {
  it("flushes rules registered during a render, and reuses the text otherwise", () => {
    const sheet = freshStyleSheet();
    const { SsrStyleFlush } = loadServerFlush(sheet);
    const getSheet = jest.spyOn(sheet, "getSheet");

    const firstRender = flushedText(SsrStyleFlush());
    const secondRender = flushedText(SsrStyleFlush());
    expect(secondRender).toBe(firstRender);
    expect(getSheet).toHaveBeenCalledTimes(1);

    // A later request loads a route module whose styles register at module scope.
    sheet.create({ hero: { paddingBottom: 37 } });
    const thirdRender = flushedText(SsrStyleFlush());
    expect(thirdRender).toMatch(/^\.(r-[\w-]+)\.\1\{padding-bottom:37px;\}$/m);
    expect(getSheet).toHaveBeenCalledTimes(2);
  });

  it("renders nothing off the server", () => {
    const sheet = freshStyleSheet();
    let flush!: FlushModule;
    jest.isolateModules(() => {
      jest.doMock("react-native", () => ({ Platform: { OS: "ios" }, StyleSheet: sheet }));
      flush = require("../SsrStyleFlush");
    });
    const create = sheet.create;
    expect(flush.SsrStyleFlush()).toBeNull();
    // Native never wraps create either.
    expect(sheet.create).toBe(create);
  });
});
