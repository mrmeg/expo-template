/**
 * Synchronous authStore tests.
 *
 * Scope: only the setters / reset / initial-state surface. `initialize`,
 * `signOut`, and the Hub listener all dynamic-import `aws-amplify/*`, which
 * Jest's default babel transform can't resolve without the experimental VM
 * modules flag; those paths are exercised in the running app. What we pin
 * down here is the state-machine surface that the UI components depend on —
 * AuthWrapper reads `state`, ProfileTab reads `user`, SignUpForm reads
 * `pendingVerificationEmail`, and the gates call `reset()` on sign-out. A
 * regression in any of these is worth catching.
 */

import { useAuthStore } from "../stores/authStore";

describe("useAuthStore (sync surface)", () => {
  beforeEach(() => {
    // The store is a Zustand singleton — reset fields we actually set below.
    useAuthStore.setState({
      state: "loading",
      user: null,
      pendingVerificationEmail: null,
      error: null,
      isInitializing: false,
      lastInitializeTime: 0,
    });
  });

  it("defaults to loading / null user / no pending verification email", () => {
    const s = useAuthStore.getState();
    expect(s.state).toBe("loading");
    expect(s.user).toBeNull();
    expect(s.pendingVerificationEmail).toBeNull();
    expect(s.error).toBeNull();
  });

  it("setUser(user) moves the store to authenticated", () => {
    useAuthStore
      .getState()
      .setUser({ userId: "u_1", username: "alice", email: "a@example.com" });

    const s = useAuthStore.getState();
    expect(s.state).toBe("authenticated");
    expect(s.user).toEqual({
      userId: "u_1",
      username: "alice",
      email: "a@example.com",
    });
    expect(s.error).toBeNull();
  });

  it("setUser(null) moves the store to unauthenticated", () => {
    useAuthStore.getState().setUser({ userId: "u_1", username: "alice" });
    useAuthStore.getState().setUser(null);

    const s = useAuthStore.getState();
    expect(s.state).toBe("unauthenticated");
    expect(s.user).toBeNull();
  });

  it("setState updates the state flag without touching user or error", () => {
    useAuthStore.getState().setUser({ userId: "u_1", username: "alice" });
    useAuthStore.getState().setError("ignored");
    useAuthStore.getState().setState("loading");

    const s = useAuthStore.getState();
    expect(s.state).toBe("loading");
    expect(s.user).toEqual({ userId: "u_1", username: "alice" });
    expect(s.error).toBe("ignored");
  });

  it("setPendingVerificationEmail holds the email between signup and confirmation", () => {
    useAuthStore.getState().setPendingVerificationEmail("new@example.com");
    expect(useAuthStore.getState().pendingVerificationEmail).toBe("new@example.com");

    useAuthStore.getState().setPendingVerificationEmail(null);
    expect(useAuthStore.getState().pendingVerificationEmail).toBeNull();
  });

  it("setError stores the message and can clear it with null", () => {
    useAuthStore.getState().setError("invalid password");
    expect(useAuthStore.getState().error).toBe("invalid password");

    useAuthStore.getState().setError(null);
    expect(useAuthStore.getState().error).toBeNull();
  });

  it("reset clears everything and lands on unauthenticated", () => {
    useAuthStore.setState({
      state: "authenticated",
      user: { userId: "u_1", username: "alice" },
      pendingVerificationEmail: "new@example.com",
      error: "something",
    });

    useAuthStore.getState().reset();

    const s = useAuthStore.getState();
    expect(s.state).toBe("unauthenticated");
    expect(s.user).toBeNull();
    expect(s.pendingVerificationEmail).toBeNull();
    expect(s.error).toBeNull();
  });
});
