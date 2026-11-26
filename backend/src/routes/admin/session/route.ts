import { ZodError } from "zod";
import { adminConfigured, adminCookie, adminHeaders, adminKeyValid, adminSessionExpiry, adminToken, createAdminSession, sameOrigin } from "../../../auth/admin";
import { adminLogin } from "../../../schemas/admin";
import { body, failure } from "../../../http/api";
import { rate } from "../../../db/store";

export async function GET(req: Request) {
  const expiresAt = adminSessionExpiry(adminToken(req));
  return Response.json({ configured: adminConfigured(), authenticated: expiresAt !== null, expiresAt }, { headers: adminHeaders });
}
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Request not allowed." }, { status: 403, headers: adminHeaders });
  if (!adminConfigured()) return Response.json({ error: "Admin access is not configured. Set ADMIN_SECRET to a strong key of at least 16 characters on the server." }, { status: 503, headers: adminHeaders });
  try {
    const input = await body(req, adminLogin);
    await rate(req, "adminLogin");
    if (!adminKeyValid(input.key)) return Response.json({ error: "Invalid admin key." }, { status: 401, headers: adminHeaders });
    const token = createAdminSession();
    return Response.json({ authenticated: true, expiresAt: adminSessionExpiry(token) }, { headers: { ...adminHeaders, "Set-Cookie": adminCookie(token) } });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Enter a valid admin key." }, { status: 400, headers: adminHeaders });
    const response = failure(error);
    Object.entries(adminHeaders).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Request not allowed." }, { status: 403, headers: adminHeaders });
  return Response.json({ authenticated: false }, { headers: { ...adminHeaders, "Set-Cookie": adminCookie("", 0) } });
}
