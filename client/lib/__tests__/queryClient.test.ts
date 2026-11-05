import fs from "fs";
import path from "path";
import { QueryObserver } from "@tanstack/react-query";
import { createQueryClient } from "../queryClient";

const THIRTY_MINUTES = 30 * 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;
const originalWindow = globalThis.window;

function setWindow(value: unknown) {
  Object.defineProperty(globalThis, "window", { value, configurable: true, writable: true });
}

function longTimers(spy: jest.SpyInstance) {
  return spy.mock.calls.filter(([, delay]) => typeof delay === "number" && delay >= 60_000);
}

describe("createQueryClient", () => {
  let setTimeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    setTimeoutSpy = jest.spyOn(globalThis, "setTimeout");
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
    setWindow(originalWindow);
  });

  it("is never created at module scope, which would share one cache across requests", () => {
    const layout = fs.readFileSync(
      path.join(__dirname, "../../features/app/RootLayout.tsx"),
      "utf8",
    );

    expect(layout).toContain("useState(createQueryClient)");
    expect(layout).not.toContain("new QueryClient(");
  });

  it("returns a separate cache on each call", () => {
    const first = createQueryClient();
    const second = createQueryClient();
    first.setQueryData(["private"], "first request");

    expect(second.getQueryData(["private"])).toBeUndefined();

    first.clear();
  });

  describe("on the server", () => {
    beforeEach(() => setWindow(undefined));

    it("starts no gc timer for a query using the default gcTime", () => {
      const client = createQueryClient();
      const query = client.getQueryCache().build(client, { queryKey: ["default"] });

      expect(query.gcTime).toBe(Infinity);
      expect(longTimers(setTimeoutSpy)).toEqual([]);
    });

    it("starts no gc timer for a query with its own gcTime", () => {
      const client = createQueryClient();
      const query = client.getQueryCache().build(client, {
        queryKey: ["explicit"],
        gcTime: THIRTY_MINUTES,
      });
      new QueryObserver(client, { queryKey: ["explicit"], gcTime: THIRTY_MINUTES });

      expect(query.gcTime).toBe(Infinity);
      expect(longTimers(setTimeoutSpy)).toEqual([]);
    });

    it("keeps the other defaults", () => {
      const options = createQueryClient().defaultQueryOptions({ queryKey: ["defaults"] });
      const retry = options.retry as (failureCount: number, error: unknown) => boolean;

      expect(options.staleTime).toBe(5 * 60 * 1000);
      expect(retry(0, { status: 404 })).toBe(false);
      expect(retry(1, { status: 500 })).toBe(true);
      expect(retry(2, { status: 500 })).toBe(false);
    });
  });

  describe("in a browser or app", () => {
    beforeEach(() => setWindow({}));

    it("keeps the default and per-query gcTime", () => {
      const client = createQueryClient();
      const byDefault = client.getQueryCache().build(client, { queryKey: ["default"] });
      const explicit = client.getQueryCache().build(client, {
        queryKey: ["explicit"],
        gcTime: THIRTY_MINUTES,
      });

      expect(byDefault.gcTime).toBe(TEN_MINUTES);
      expect(explicit.gcTime).toBe(THIRTY_MINUTES);
      expect(longTimers(setTimeoutSpy).length).toBeGreaterThan(0);

      client.clear();
    });
  });
});
