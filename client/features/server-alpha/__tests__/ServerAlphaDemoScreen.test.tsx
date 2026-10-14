/**
 * Server Alpha overview screen.
 *
 * The overview route declares a loader, which only has a source on web. On
 * native `useLoaderData` would fetch a relative `/_expo/loaders/...` URL with
 * no origin and throw during render, so native must never call it.
 */

import React from "react";
import { Platform } from "react-native";
import { render, screen } from "@testing-library/react-native";

import ServerAlphaDemoScreen from "../ServerAlphaDemoScreen";
import type { TemplateServerCatalog } from "@/server/api/template/examples";

const mockUseLoaderData = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLoaderData: () => mockUseLoaderData(),
}));

// `Seo` renders web `<title>`/`<meta>` tags the RN test renderer cannot host.
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
      path: "/server-alpha",
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
      id: "loader-overview",
      label: "Loader Overview",
      route: "/server-alpha/loader-overview",
      apiPath: "/api/template/examples",
      loaderPath: "/_expo/loaders/server-alpha",
      pattern: "A static route's loader supplies its page data.",
      useCase: "Dashboards.",
      codePointers: ["app/(main)/(demos)/server-alpha/index.tsx"],
    },
  ],
  generatedAt: "2026-08-11T00:00:00.000Z",
};

const originalPlatform = Platform.OS;
const setPlatform = (os: string) => {
  (Platform as { OS: string }).OS = os;
};

describe("ServerAlphaDemoScreen", () => {
  afterEach(() => {
    setPlatform(originalPlatform);
    mockUseLoaderData.mockReset();
  });

  it("renders the loader data on web", async () => {
    setPlatform("web");
    mockUseLoaderData.mockReturnValue(catalog);

    await render(<ServerAlphaDemoScreen />);

    expect(mockUseLoaderData).toHaveBeenCalled();
    expect(screen.getByText("Loader Overview")).toBeTruthy();
    expect(screen.getByText("/server-alpha")).toBeTruthy();
  });

  it("shows a notice on native without reading loader data", async () => {
    setPlatform("ios");
    mockUseLoaderData.mockImplementation(() => {
      throw new TypeError("fetch() URL is invalid");
    });

    await render(<ServerAlphaDemoScreen />);

    expect(mockUseLoaderData).not.toHaveBeenCalled();
    expect(screen.getByText("Server features run on web")).toBeTruthy();
  });
});
