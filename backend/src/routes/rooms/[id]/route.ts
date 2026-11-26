import { failure, parseId, type Context } from "@backend/http/api";
import { ApiError, getRoom } from "@backend/db/store";
export async function GET(req: Request, c: Context) {
  try {
    const r = await getRoom(await parseId(c));
    if (!r) throw new ApiError(404, "This room expired. Make a new one.");
    return Response.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
