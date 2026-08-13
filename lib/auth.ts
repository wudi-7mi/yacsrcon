import crypto from "node:crypto";
import { cookies } from "next/headers";
import { config } from "./config";

const COOKIE = "yacsrcon_session";
function sign(value: string) { return crypto.createHmac("sha256", config.AUTH_SECRET).update(value).digest("hex"); }
export async function isAuthenticated() { const store = await cookies(); const value = store.get(COOKIE)?.value; return Boolean(value && value === sign(config.ADMIN_USERNAME)); }
export async function login(username: string, password: string, secure: boolean) { if (username !== config.ADMIN_USERNAME || password !== config.ADMIN_PASSWORD) return false; (await cookies()).set(COOKIE, sign(username), { httpOnly: true, sameSite: "lax", secure, maxAge: 60 * 60 * 24 * 7, path: "/" }); return true; }
export async function logout() { (await cookies()).delete(COOKIE); }
