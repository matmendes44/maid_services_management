import "server-only";

import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

const WINDOW = sql`now() - interval '15 minutes'`;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 20;

export async function isRateLimited(email: string, ip: string | null) {
  const [byEmail, byIp] = await Promise.all([
    db.$count(loginAttempts, and(eq(loginAttempts.email, email), gt(loginAttempts.attemptedAt, WINDOW))),
    ip
      ? db.$count(loginAttempts, and(eq(loginAttempts.ip, ip), gt(loginAttempts.attemptedAt, WINDOW)))
      : 0,
  ]);
  return byEmail >= MAX_PER_EMAIL || byIp >= MAX_PER_IP;
}

export async function recordFailedLogin(email: string, ip: string | null) {
  await db.insert(loginAttempts).values({ email, ip });
  // keep the table small; anything outside the window no longer matters
  await db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, sql`now() - interval '1 day'`));
}

export async function clearFailedLogins(email: string) {
  await db.delete(loginAttempts).where(eq(loginAttempts.email, email));
}
