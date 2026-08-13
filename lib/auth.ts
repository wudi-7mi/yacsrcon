import crypto from "node:crypto";
import { cookies } from "next/headers";
import { config } from "./config.ts";
import { createSession, revokeSession, verifySession } from "./session.ts";

const COOKIE = "yacsrcon_session";
function equal(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function isAuthenticated() {
  const value = (await cookies()).get(COOKIE)?.value;
  return value ? verifySession(value) : false;
}

export async function login(
  username: string,
  password: string,
  secure: boolean,
) {
  if (
    !equal(username, config.ADMIN_USERNAME) ||
    !equal(password, config.ADMIN_PASSWORD)
  ) {
    return false;
  }
  const session = await createSession();
  (await cookies()).set(COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: session.maxAge,
    expires: new Date(session.expiresAt),
    path: "/",
  });
  return true;
}

export async function logout() {
  const store = await cookies();
  try {
    await revokeSession(store.get(COOKIE)?.value);
  } finally {
    store.delete(COOKIE);
  }
}
