/**
 * @jest-environment node
 */

import { appendVary, withMutableHeaders } from "../headers";

describe("appendVary", () => {
  it("sets, appends, and never duplicates entries", () => {
    const headers = new Headers();
    appendVary(headers, "Origin");
    appendVary(headers, "Accept-Encoding");
    appendVary(headers, "origin");
    expect(headers.get("Vary")).toBe("Origin, Accept-Encoding");
  });

  it("keeps a route's own entries and leaves Vary: * alone", () => {
    const own = new Headers({ Vary: "Accept-Language" });
    appendVary(own, "Origin");
    expect(own.get("Vary")).toBe("Accept-Language, Origin");

    const everything = new Headers({ Vary: "*" });
    appendVary(everything, "Origin");
    expect(everything.get("Vary")).toBe("*");
  });
});

describe("withMutableHeaders", () => {
  it("returns an editable response as is", () => {
    const response = new Response("ok");
    expect(withMutableHeaders(response)).toBe(response);
  });

  it("copies a response whose headers are immutable", () => {
    const redirect = Response.redirect("http://localhost/next", 302);
    expect(() => redirect.headers.set("X-Test", "1")).toThrow("immutable");

    const copy = withMutableHeaders(redirect);
    expect(copy).not.toBe(redirect);
    copy.headers.set("X-Test", "1");
    expect(copy.status).toBe(302);
    expect(copy.headers.get("Location")).toBe("http://localhost/next");
    expect(copy.headers.get("X-Test")).toBe("1");
  });
});
