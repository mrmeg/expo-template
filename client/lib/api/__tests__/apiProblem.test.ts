import { getApiProblem, getApiProblemMessage, type ApiProblem } from "../apiProblem";

describe("getApiProblem", () => {
  it("returns null for 200", () => {
    expect(getApiProblem(200)).toBeNull();
  });

  it("returns null for 201", () => {
    expect(getApiProblem(201)).toBeNull();
  });

  it("returns null for 204", () => {
    expect(getApiProblem(204)).toBeNull();
  });

  it("returns unauthorized for 401", () => {
    expect(getApiProblem(401)).toEqual({ kind: "unauthorized" });
  });

  it("returns forbidden for 403", () => {
    expect(getApiProblem(403)).toEqual({ kind: "forbidden" });
  });

  it("returns not-found for 404", () => {
    expect(getApiProblem(404)).toEqual({ kind: "not-found" });
  });

  it("returns timeout for 408", () => {
    expect(getApiProblem(408)).toEqual({ kind: "timeout", temporary: true });
  });

  it("returns server for 500 (not temporary)", () => {
    expect(getApiProblem(500)).toEqual({ kind: "server", status: 500 });
  });

  it("returns server with temporary for 502", () => {
    expect(getApiProblem(502)).toEqual({ kind: "server", status: 502, temporary: true });
  });

  it("returns server with temporary for 503", () => {
    expect(getApiProblem(503)).toEqual({ kind: "server", status: 503, temporary: true });
  });

  it("returns server with temporary for 504", () => {
    expect(getApiProblem(504)).toEqual({ kind: "server", status: 504, temporary: true });
  });

  it("returns rejected for other 4xx errors", () => {
    expect(getApiProblem(422)).toEqual({ kind: "rejected", status: 422 });
    expect(getApiProblem(429)).toEqual({ kind: "rejected", status: 429 });
  });

  it("returns unknown for unexpected status codes", () => {
    expect(getApiProblem(600)).toEqual({ kind: "unknown", temporary: true });
  });
});

describe("getApiProblemMessage", () => {
  const cases: [ApiProblem, string][] = [
    [{ kind: "timeout", temporary: true }, "Request timed out. Please try again."],
    [{ kind: "cannot-connect", temporary: true }, "Unable to connect to the server."],
    [{ kind: "network-error", temporary: true }, "Network error. Please check your connection."],
    [{ kind: "server", status: 500 }, "Server error. Please try again later."],
    [{ kind: "unauthorized" }, "You need to log in to continue."],
    [{ kind: "forbidden" }, "You don't have permission to do that."],
    [{ kind: "not-found" }, "The requested resource was not found."],
    [{ kind: "rejected", status: 422 }, "The request was rejected."],
    [{ kind: "bad-data" }, "Received invalid data from the server."],
    [{ kind: "unknown", temporary: true }, "An unexpected error occurred."],
  ];

  it.each(cases)("returns correct message for %p", (problem, expected) => {
    expect(getApiProblemMessage(problem)).toBe(expected);
  });
});
