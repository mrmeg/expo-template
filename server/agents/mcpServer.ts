/**
 * PROTOTYPE: the MCP server behind `app/api/mcp+api.ts`.
 *
 * Stateless: `createMcpHandler` builds a fresh `McpServer` per HTTP request
 * around the verified caller. Token verification (JWKS signature, issuer,
 * audience = MCP_RESOURCE, expiry) happens in front of it, in `requireMcpAuth`;
 * per-tool scopes are enforced here with `scopeChallenge`, which answers
 * HTTP 403 `insufficient_scope` before the tool runs.
 */

import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, McpServer, requireScopes } from "@modelcontextprotocol/server";
import type { JWTPayload } from "jose";
import * as z from "zod";

import { AGENT_BASE_URL, MCP_RESOURCE, NOTES_READ, NOTES_WRITE } from "./config";
import { addNote, listNotes } from "./notes";

const PROTECTED_RESOURCE_METADATA_URL = `${AGENT_BASE_URL}/.well-known/oauth-protected-resource${new URL(MCP_RESOURCE).pathname}`;

const noteSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.string(),
});

export function authInfoFromClaims(request: Request, claims: JWTPayload): AuthInfo {
  const header = request.headers.get("authorization") ?? "";
  const scope = typeof claims.scope === "string" ? claims.scope : "";
  return {
    token: header.replace(/^(Bearer|DPoP)\s+/i, ""),
    clientId: String(claims.azp ?? claims.client_id ?? ""),
    scopes: scope.split(" ").filter(Boolean),
    expiresAt: claims.exp,
    resource: new URL(MCP_RESOURCE),
    resourceMetadataUrl: PROTECTED_RESOURCE_METADATA_URL,
    extra: { userId: claims.sub },
  };
}

function userIdOf(authInfo: AuthInfo | undefined): string {
  const userId = authInfo?.extra?.userId;
  if (typeof userId !== "string" || !userId) throw new Error("No user on this token");
  return userId;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    });
  });

export const mcpHandler = createMcpHandler(({ authInfo }) => {
  const server = new McpServer(
    { name: "template-notes", version: "0.0.1" },
    {
      instructions:
        "Personal notes for the signed-in user of the template app. Call list_notes to read " +
        "the user's notes before answering questions about them; call add_note only when the " +
        "user asks to save something. Notes are plain text and private to this user.",
    },
  );

  server.registerTool(
    "list_notes",
    {
      title: "List notes",
      description: "List every note the signed-in user has saved, oldest first.",
      outputSchema: z.object({ notes: z.array(noteSchema) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      scopeChallenge: requireScopes(NOTES_READ),
    },
    async () => {
      const notes = await listNotes(userIdOf(authInfo));
      return {
        content: [{ type: "text", text: notes.length ? notes.map((n) => `- ${n.text}`).join("\n") : "No notes yet." }],
        structuredContent: { notes },
      };
    },
  );

  server.registerTool(
    "add_note",
    {
      title: "Add a note",
      description: "Save a new plain-text note for the signed-in user.",
      inputSchema: z.object({ text: z.string().min(1).max(2000).describe("The note text") }),
      outputSchema: z.object({ note: noteSchema }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      scopeChallenge: requireScopes(NOTES_WRITE),
    },
    async ({ text }) => {
      const note = await addNote(userIdOf(authInfo), text);
      return { content: [{ type: "text", text: `Saved note ${note.id}` }], structuredContent: { note } };
    },
  );

  if (process.env.PROTO_MCP_DIAGNOSTICS === "1") {
    // Diagnostic only (not a product tool): holds the response open to probe
    // the server's idle timeout, optionally streaming progress meanwhile.
    server.registerTool(
      "proto_wait",
      {
        title: "Wait (diagnostic)",
        description: "Diagnostic: wait N seconds, optionally sending progress notifications every 2 s.",
        inputSchema: z.object({ seconds: z.number().min(0).max(60), progress: z.boolean().optional() }),
        outputSchema: z.object({ waitedMs: z.number() }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        scopeChallenge: requireScopes(NOTES_READ),
      },
      async ({ seconds, progress }, ctx) => {
        const started = Date.now();
        const progressToken = ctx.mcpReq._meta?.progressToken;
        const steps = Math.ceil(seconds / 2);
        for (let i = 0; i < steps; i++) {
          await sleep(Math.min(2000, seconds * 1000 - i * 2000), ctx.mcpReq.signal);
          if (progress && progressToken !== undefined) {
            await ctx.mcpReq.notify({
              method: "notifications/progress",
              params: { progressToken, progress: i + 1, total: steps, message: `step ${i + 1}` },
            });
          }
        }
        const waitedMs = Date.now() - started;
        return { content: [{ type: "text", text: `waited ${waitedMs} ms` }], structuredContent: { waitedMs } };
      },
    );
  }

  return server;
});
