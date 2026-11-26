import { body, parseId, failure, type Context } from "@backend/http/api";
import { z } from "zod";
import { ApiError, markRevealed } from "@backend/db/store";
import { report, requireRoom } from "@backend/services/reveal";
export async function POST(req: Request, c: Context) {
  try {
    await body(req, z.object({}).strict());
    return Response.json(await markRevealed(await parseId(c)));
  } catch (e) {
    return failure(e);
  }
}
export async function GET(req: Request, c: Context) {
  try {
    const room = await requireRoom(await parseId(c));
    if (!room.participants.length)
      throw new ApiError(409, "Add the first vote before checking trips.");
    return Response.json(await report(room), {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (e) {
    return failure(e);
  }
}
