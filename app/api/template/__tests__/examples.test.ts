import { GET as getExamples, OPTIONS as optionsExamples } from "../examples+api";
import { POST as postEcho, OPTIONS as optionsEcho } from "../echo+api";

describe("GET /api/template/examples", () => {
  it("returns the server-pattern catalog", async () => {
    const response = getExamples(
      new Request("http://localhost/api/template/examples", {
        headers: {
          Origin: "http://localhost:8081",
          "User-Agent": "jest",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:8081");

    const body = await response.json();
    expect(body.status.request.path).toBe("/api/template/examples");
    expect(body.examples.map((example: { id: string }) => example.id)).toEqual([
      "loader-overview",
      "dynamic-loader",
      "api-route",
      "middleware",
    ]);
  });

  it("handles CORS preflight requests", () => {
    const response = optionsExamples(
      new Request("http://localhost/api/template/examples", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:8081" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:8081");
    expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
  });
});

describe("POST /api/template/echo", () => {
  it("echoes parsed JSON so body handling stays in API routes", async () => {
    const response = await postEcho(
      new Request("http://localhost/api/template/echo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:8081",
        },
        body: JSON.stringify({ action: "preview", count: 2 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:8081");

    const body = await response.json();
    expect(body.status.request).toMatchObject({
      method: "POST",
      path: "/api/template/echo",
      hasRequest: true,
      originHeader: "http://localhost:8081",
    });
    expect(body.body).toEqual({ action: "preview", count: 2 });
  });

  it("handles empty or invalid JSON bodies as null", async () => {
    const response = await postEcho(
      new Request("http://localhost/api/template/echo", {
        method: "POST",
        body: "not json",
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.body).toBeNull();
  });

  it("handles CORS preflight requests", () => {
    const response = optionsEcho(
      new Request("http://localhost/api/template/echo", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:8081" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:8081");
    expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
  });
});
