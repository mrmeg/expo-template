// A stand-in for the app's auth layer: the session is not real in this app.
export interface Session {
  /** The signed-in user's id, or null when signed out. */
  userId: string | null;
}

export function useAuth(): Session {
  return { userId: "user-1" };
}

export async function signOut(): Promise<void> {
  // Clears the session.
}
