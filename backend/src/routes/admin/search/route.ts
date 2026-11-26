import { ZodError } from "zod";
import { adminHeaders, adminSessionExpiry, adminToken, sameOrigin } from "../../../auth/admin";
import { adminSearch } from "../../../schemas/admin";
import { searchAdminRecords } from "../../../db/admin";
import { rate } from "../../../db/store";
import { body, failure } from "../../../http/api";

export async function POST(req: Request) {
  if (!adminSessionExpiry(adminToken(req))) return Response.json({ error: "Admin session expired. Please sign in again." }, { status: 401, headers: adminHeaders });
  if (!sameOrigin(req)) return Response.json({ error: "Request not allowed." }, { status: 403, headers: adminHeaders });
  try {
    const input = await body(req, adminSearch);
    await rate(req, "adminSearch");
    return Response.json(await searchAdminRecords(input), { headers: adminHeaders });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Enter a name of 2–80 characters and a valid page." }, { status: 400, headers: adminHeaders });
    const response = failure(error);
    Object.entries(adminHeaders).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }
}
