/**
 * PROTOTYPE: per-user notes in `proto_notes`, keyed by the better-auth user id
 * (the access token's `sub`). Created on first use.
 */

import { getAgentPool } from "./auth";

export interface ProtoNote {
  id: string;
  text: string;
  createdAt: string;
}

let ensured: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  ensured ??= getAgentPool()
    .query(
      `CREATE TABLE IF NOT EXISTS proto_notes (
         id bigserial PRIMARY KEY,
         user_id text NOT NULL,
         text text NOT NULL,
         created_at timestamptz NOT NULL DEFAULT now()
       );
       CREATE INDEX IF NOT EXISTS proto_notes_user_idx ON proto_notes (user_id, created_at);`,
    )
    .then(() => undefined)
    .catch((error) => {
      ensured = null;
      throw error;
    });
  return ensured;
}

type Row = { id: string; text: string; created_at: Date };

function toNote(row: Row): ProtoNote {
  return { id: String(row.id), text: row.text, createdAt: row.created_at.toISOString() };
}

export async function listNotes(userId: string): Promise<ProtoNote[]> {
  await ensureTable();
  const { rows } = await getAgentPool().query<Row>(
    "SELECT id, text, created_at FROM proto_notes WHERE user_id = $1 ORDER BY created_at, id",
    [userId],
  );
  return rows.map(toNote);
}

export async function addNote(userId: string, text: string): Promise<ProtoNote> {
  await ensureTable();
  const { rows } = await getAgentPool().query<Row>(
    "INSERT INTO proto_notes (user_id, text) VALUES ($1, $2) RETURNING id, text, created_at",
    [userId, text],
  );
  return toNote(rows[0]!);
}
