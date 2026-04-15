import { isAuthEnabled } from "../isAuthEnabled";

describe("isAuthEnabled", () => {
  const originals = {
    pool: process.env.EXPO_PUBLIC_USER_POOL_ID,
    client: process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID,
  };

  afterEach(() => {
    if (originals.pool === undefined) delete process.env.EXPO_PUBLIC_USER_POOL_ID;
    else process.env.EXPO_PUBLIC_USER_POOL_ID = originals.pool;
    if (originals.client === undefined) delete process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;
    else process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = originals.client;
  });

  it("is false when neither env var is set", () => {
    delete process.env.EXPO_PUBLIC_USER_POOL_ID;
    delete process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;
    expect(isAuthEnabled()).toBe(false);
  });

  it("is false when only the pool id is set", () => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_AAAAA";
    delete process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID;
    expect(isAuthEnabled()).toBe(false);
  });

  it("is false when only the client id is set", () => {
    delete process.env.EXPO_PUBLIC_USER_POOL_ID;
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "aaaaaaaaa";
    expect(isAuthEnabled()).toBe(false);
  });

  it("is true when both env vars are set", () => {
    process.env.EXPO_PUBLIC_USER_POOL_ID = "us-east-1_AAAAA";
    process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID = "aaaaaaaaa";
    expect(isAuthEnabled()).toBe(true);
  });
});
