import { timingSafeEqual, createHash } from "node:crypto";
import { z } from "zod";
export function statsAccess(key: unknown) {
  const val = z.string().min(1).max(512).safeParse(key),
    secret = process.env.STATS_SECRET;
  if (!val.success || !secret) return false;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(val.data), digest(secret));
}
