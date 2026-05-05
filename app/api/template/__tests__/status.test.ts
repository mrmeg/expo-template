import { GET, OPTIONS } from "../status+api";

describe("GET /api/template/status", () => {
  it("returns request-scoped server status without exposing secrets", async () => {
    const response = GET(
      new Request("http://localhost/api/template/status", {
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
    expect(body.ok).toBe(true);
    expect(body.request).toMatchObject({
      method: "GET",
      path: "/api/template/status",
      hasRequest: true,
      originHeader: "http://localhost:8081",
      userAgent: "jest",
    });
    expect(body.runtime.mode).toBe("server");
    expect(body).not.toHaveProperty("env");
  });

  it("handles CORS preflight requests", () => {
    const response = OPTIONS(
      new Request("http://localhost/api/template/status", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:8081" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:8081");
    expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
  });
});
