import { problemFromResponse } from "../lib/problem";

describe("billing api — problemFromResponse", () => {
  it("maps 401 to unauthorized regardless of body", () => {
    expect(problemFromResponse(401, {})).toEqual({ kind: "unauthorized" });
  });

  it("maps billing-disabled code", () => {
    expect(problemFromResponse(503, { code: "billing-disabled" })).toEqual({
      kind: "billing-disabled",
    });
  });

  it("maps billing-conflict and preserves candidate customer ids", () => {
    expect(
      problemFromResponse(409, {
        code: "billing-conflict",
        candidateCustomerIds: ["cus_a", "cus_b"],
      }),
    ).toEqual({
      kind: "billing-conflict",
      candidateCustomerIds: ["cus_a", "cus_b"],
    });
  });

  it("maps no-customer code", () => {
    expect(problemFromResponse(409, { code: "no-customer" })).toEqual({
      kind: "no-customer",
    });
  });

  it("maps configuration-missing and preserves message", () => {
    expect(
      problemFromResponse(422, {
        code: "configuration-missing",
        message: "missing monthly price",
      }),
    ).toEqual({ kind: "configuration-missing", message: "missing monthly price" });
  });

  it("maps unknown-plan with the returned available plans", () => {
    expect(
      problemFromResponse(400, {
        code: "unknown-plan",
        availablePlans: ["free", "pro"],
      }),
    ).toEqual({ kind: "unknown-plan", availablePlans: ["free", "pro"] });
  });

  it("maps generic 400 without a code into bad-request", () => {
    expect(problemFromResponse(400, { message: "bad json" })).toEqual({
      kind: "bad-request",
      message: "bad json",
    });
  });

  it("falls back to server-error with the HTTP status for unknown failures", () => {
    expect(problemFromResponse(502, {})).toEqual({
      kind: "server-error",
      message: "HTTP 502",
    });
  });
});
