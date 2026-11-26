import { ZodError, type ZodTypeAny, z } from "zod";
import { ApiError } from "../db/store";
import { roomId } from "../schemas/trip";
import { StorageError } from "../db/storage-error";
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
  if (e instanceof StorageError) {
    console.error("[WeekendWise] Database request failed", { code: e.code });
    return Response.json(
      { error: e.message, code: e.code },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
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
