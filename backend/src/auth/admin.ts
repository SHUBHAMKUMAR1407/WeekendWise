import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "weekendwise_admin";
export const ADMIN_SESSION_SECONDS = 3600;
function secret() { return process.env.ADMIN_SECRET || ""; }
export function adminConfigured() { return secret().length >= 16 && secret().length <= 512; }
function equal(a: string, b: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}
export function adminKeyValid(key: string) {
  return adminConfigured() && key.length <= 512 && equal(key, secret());
}
export function createAdminSession(now = Date.now()) {
  if (!adminConfigured()) throw new Error("Admin access is not configured.");
  const payload = `v1.${Math.floor(now / 1000) + ADMIN_SESSION_SECONDS}.${randomBytes(16).toString("hex")}`;
  return payload + "." + createHmac("sha256", secret()).update(payload).digest("hex");
}
export function adminSessionExpiry(token: string | undefined, now = Date.now()): number | null {
  if (!adminConfigured() || !token || token.length > 256) return null;
  const match = /^v1\.(\d{10})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return null;
  const expires = Number(match[1]), seconds = Math.floor(now / 1000);
  if (expires <= seconds || expires > seconds + ADMIN_SESSION_SECONDS) return null;
  const payload = token.slice(0, token.lastIndexOf("."));
  const signature = createHmac("sha256", secret()).update(payload).digest("hex");
  return equal(signature, match[3]) ? expires * 1000 : null;
}
export function adminToken(req: Request) {
  return req.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(ADMIN_COOKIE + "="))?.slice(ADMIN_COOKIE.length + 1);
}
export function adminCookie(token: string, maxAge = ADMIN_SESSION_SECONDS) {
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function sameOrigin(req: Request) {
  return req.headers.get("origin") === new URL(req.url).origin;
}
export const adminHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
