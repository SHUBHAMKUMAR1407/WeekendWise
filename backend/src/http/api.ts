import { ZodError, type ZodTypeAny, z } from "zod";
import { ApiError } from "../db/redis";
import { roomId } from "../schemas/trip";
export type Context = { params: Promise<{ id: string }> };
export async function parseId(c: Context) {
  return roomId.parse((await c.params).id);
}
export async function body<T extends ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<z.output<T>> {
  if (Number(req.headers.get("content-length")) > 8192)
    throw new ApiError(413, "Request is too large.");
  const s = await req.text();
  if (s.length > 8192) throw new ApiError(413, "Request is too large.");
  try {
    return schema.parse(JSON.parse(s));
  } catch (e) {
    if (e instanceof SyntaxError) throw new ApiError(400, "Invalid request.");
    throw e;
  }
}
export function failure(e: unknown) {
  const status =
    e instanceof ApiError ? e.status : e instanceof ZodError ? 400 : 503;
  return Response.json(
    {
      error:
        e instanceof ApiError
          ? e.message
          : status === 400
            ? "Check your dates, full name, budget and at least one vibe."
            : "Connection issue. Please try again.",
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(status === 429 ? { "Retry-After": "3600" } : {}),
      },
    },
  );
}
