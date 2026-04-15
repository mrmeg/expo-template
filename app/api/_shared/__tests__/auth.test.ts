import {
  requireAuthenticatedUser,
  setTokenVerifier,
  type TokenVerifier,
} from "../auth";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/billing/summary", { headers });
}

const goodVerifier: TokenVerifier = {
  async verify(token: string) {
    if (token === "good") {
      return { userId: "u_1", email: "u1@example.com" };
    }
    throw new Error("bad token");
  },
};

describe("requireAuthenticatedUser", () => {
  afterEach(() => {
    setTokenVerifier(null);
  });

  it("returns 401 when no Authorization header is present", async () => {
    setTokenVerifier(goodVerifier);
    const result = await requireAuthenticatedUser(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const body = await result.response.json();
      expect(body.code).toBe("unauthorized");
    }
  });

  it("returns 401 when the Authorization scheme is not Bearer", async () => {
    setTokenVerifier(goodVerifier);
    const result = await requireAuthenticatedUser(
      makeRequest({ Authorization: "Basic abc" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("returns 401 when the bearer token is empty", async () => {
    setTokenVerifier(goodVerifier);
    const result = await requireAuthenticatedUser(
      makeRequest({ Authorization: "Bearer " }),
    );
    expect(result.ok).toBe(false);
  });

  it("returns 401 when no verifier is registered (fail closed)", async () => {
    setTokenVerifier(null);
    const result = await requireAuthenticatedUser(
      makeRequest({ Authorization: "Bearer good" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const body = await result.response.json();
      expect(body.message).toMatch(/not configured/i);
    }
  });

  it("returns 401 when the verifier rejects the token", async () => {
    setTokenVerifier(goodVerifier);
    const result = await requireAuthenticatedUser(
      makeRequest({ Authorization: "Bearer bad" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("returns the verified user on a valid bearer token", async () => {
    setTokenVerifier(goodVerifier);
    const result = await requireAuthenticatedUser(
      makeRequest({ Authorization: "Bearer good" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user).toEqual({ userId: "u_1", email: "u1@example.com" });
    }
  });

  it("accepts lowercase authorization header names", async () => {
    setTokenVerifier(goodVerifier);
    const result = await requireAuthenticatedUser(
      makeRequest({ authorization: "Bearer good" }),
    );
    expect(result.ok).toBe(true);
  });
});
