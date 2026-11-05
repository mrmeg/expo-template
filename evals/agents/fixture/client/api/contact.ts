// A stand-in for the app's API client: the backend is not built yet.
export interface ContactMessage {
  name: string;
  email: string;
  message: string;
}

/** Sends a message to the team. Rejects when the request fails. */
export async function submitContact(message: ContactMessage): Promise<void> {
  void message;
}
