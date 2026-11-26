import { card } from "@backend/services/og";
import type { Context } from "@backend/http/api";
export function GET(req: Request, c: Context) {
  return card(req, c, "parent");
}
