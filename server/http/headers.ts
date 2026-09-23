/**
 * Header helpers shared by the Bun request handler (`server/http/`) and the
 * CORS policy (`server/api/shared/cors.ts`). Dependency-free, so the CORS
 * module can pull this into API-route and middleware bundles.
 */

/**
 * Add `value` to the response's `Vary` list unless it is already listed
 * (case-insensitive) or the response already varies on everything (`*`).
 * Never replaces what a route set.
 */
export function appendVary(headers: Headers, value: string): void {
  const current = headers.get("Vary");
  if (!current) {
    headers.set("Vary", value);
    return;
  }

  const listed = current.split(",").map((entry) => entry.trim().toLowerCase());
  if (listed.includes("*") || listed.includes(value.toLowerCase())) {
    return;
  }
  headers.set("Vary", `${current}, ${value}`);
}

/**
 * `response` itself when its headers can be edited, otherwise a copy that
 * can — `Response.redirect()` and fetched responses carry immutable headers.
 */
export function withMutableHeaders(response: Response): Response {
  try {
    // Throws on an immutable guard whether or not the header exists.
    response.headers.delete("X-Mutable-Headers-Probe");
    return response;
  } catch {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });
  }
}
