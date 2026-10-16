"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { clearFailedLogins, isRateLimited, recordFailedLogin } from "@/lib/auth/rate-limit";
import { createSession, deleteSession } from "@/lib/auth/session";

export type LoginState = { message?: string; email?: string };

// Only same-site paths, so the login page can't be used to bounce people to
// another site ("//evil.com" and "/\evil.com" are treated as external).
function safeNext(raw: FormDataEntryValue | null) {
  const next = typeof raw === "string" ? raw : "";
  return /^\/(?![/\\])/.test(next) ? next : "/";
}

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { message: "Enter your email and password.", email };

  const ip = await clientIp();
  if (await isRateLimited(email, ip)) {
    return { message: "Too many sign-in attempts. Wait 15 minutes and try again.", email };
  }

  const user = await db.query.users.findFirst({
    columns: { id: true, passwordHash: true, isDisabled: true },
    where: eq(users.email, email),
  });
  // always run the hash so response time doesn't reveal which emails exist
  const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));

  if (!user || !valid || user.isDisabled) {
    await recordFailedLogin(email, ip);
    return { message: "Incorrect email or password.", email };
  }

  await clearFailedLogins(email);
  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
