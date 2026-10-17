import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";

// Postgres errors arrive wrapped (DrizzleQueryError → NeonDbError); walk the
// cause chain to find the one carrying the SQLSTATE code.
export function pgError(err: unknown): { code?: string; constraint?: string } | null {
  let current: unknown = err;
  while (current && typeof current === "object") {
    if ("code" in current && typeof current.code === "string") {
      return current as { code: string; constraint?: string };
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

// Reserves an id from a table's sequence. The HTTP driver has no interactive
// transactions, so rows that reference each other are written in one
// db.batch() (a single transaction) with their ids reserved up front.
export async function nextId(table: "customers" | "properties") {
  const { rows } = await db.execute<{ id: number }>(
    sql`select nextval(pg_get_serial_sequence(${table}, 'id'))::int as id`,
  );
  return rows[0].id;
}

// First statement of a db.batch() that changes audited tables: tells the
// database triggers who is making the change (app.user_id, transaction-local),
// so created_by / updated_by and the audit_log record the right user.
export function asUser(userId: number) {
  return db.execute(sql`select set_config('app.user_id', ${String(userId)}, true)`);
}
