/**
 * Server Alpha dynamic-route screen.
 *
 * This route deliberately has **no** loader. Server rendering could serve one
 * (loader requests are matched by the route's regex, so params come through),
 * but reading the param and fetching the paired API route is the single data
 * path that works on every rendering mode — native, and a static web export
 * where a param'd route has no addressable loader payload. That portability is
 * the pattern the demo teaches; these tests pin it down so nobody "restores"
 * the loader.
 */

import React from "react";
import { Platform } from "react-native";
import { render, screen } from "@testing-library/react-native";

import ServerAlphaExampleScreen from "../ServerAlphaExampleScreen";
import type { TemplateServerCatalog } from "@/server/api/template/examples";

const routeParams: { example?: string | string[] } = {};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => routeParams,
}));

// `Seo` only pulls in expo-router/head on web, which is every test below but one.
// It renders web `<title>`/`<meta>` tags the RN test renderer cannot host, so the
// mock drops them — this suite is about the screen's data path.
jest.mock("expo-router/head", () => ({
  __esModule: true,
  default: () => null,
}));

const catalog: TemplateServerCatalog = {
  status: {
    ok: true,
    servedAt: "2026-08-11T00:00:00.000Z",
    request: {
      method: "GET",
      path: "/api/template/examples",
      hasRequest: true,
      originHeader: null,
      userAgent: "jest",
    },
    runtime: {
      mode: "server",
      environment: "test",
      origin: null,
      nodeEnv: "test",
    },
  },
  examples: [
    {
      id: "dynamic-loader",
      label: "Dynamic Route",
      route: "/server-alpha/dynamic-loader",
      apiPath: "/api/template/examples",
      loaderPath: null,
      pattern: "Route params drive a client fetch.",
      useCase: "Public profiles and docs articles.",
      codePointers: ["app/(main)/(demos)/server-alpha/[example].tsx"],
    },
  ],
  generatedAt: "2026-08-11T00:00:00.000Z",
};

const originalPlatform = Platform.OS;
const setPlatform = (os: string) => {
  (Platform as { OS: string }).OS = os;
};

function mockFetch(impl: () => Promise<unknown>) {
  const fetchMock = jest.fn(impl);
  (globalThis as { fetch: unknown }).fetch = fetchMock;
  return fetchMock;
}

const okResponse = () =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(catalog) });

describe("ServerAlphaExampleScreen", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    setPlatform(originalPlatform);
    (globalThis as { fetch: unknown }).fetch = originalFetch;
    delete routeParams.example;
  });

  it("resolves the route param against the API route, not a loader", async () => {
    setPlatform("web");
    routeParams.example = "dynamic-loader";
    const fetchMock = mockFetch(okResponse);

    await render(<ServerAlphaExampleScreen />);

    expect(await screen.findByText("Dynamic Route")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/template/examples");
    expect(screen.getByText("Route params drive a client fetch.")).toBeTruthy();
    // The API route runs per request, so the rendered status is the fetched one,
    // not a build-time snapshot.
    expect(screen.getByText("2026-08-11T00:00:00.000Z")).toBeTruthy();
    expect(screen.getByText("server")).toBeTruthy();
  });

  it("accepts an array param (repeated query values) by using the first value", async () => {
    setPlatform("web");
    routeParams.example = ["dynamic-loader", "ignored"];
    mockFetch(okResponse);

    await render(<ServerAlphaExampleScreen />);

    expect(await screen.findByText("Dynamic Route")).toBeTruthy();
  });

  it("reports an unknown pattern instead of rendering an empty card", async () => {
    setPlatform("web");
    routeParams.example = "nope";
    mockFetch(okResponse);

    await render(<ServerAlphaExampleScreen />);

    expect(await screen.findByText("Unknown Server Pattern")).toBeTruthy();
    expect(screen.getByText("Not Found")).toBeTruthy();
    expect(screen.getAllByText("nope").length).toBeGreaterThan(0);
  });

  it("surfaces a failed fetch rather than throwing to the error boundary", async () => {
    setPlatform("web");
    routeParams.example = "dynamic-loader";
    mockFetch(() => Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) }));

    await render(<ServerAlphaExampleScreen />);

    expect(await screen.findByText(/503/)).toBeTruthy();
  });

  it("skips the relative fetch on native, where it cannot resolve", async () => {
    setPlatform("ios");
    routeParams.example = "dynamic-loader";
    const fetchMock = mockFetch(okResponse);

    await render(<ServerAlphaExampleScreen />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/web build/i)).toBeTruthy();
  });
});
