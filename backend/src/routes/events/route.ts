import { body, failure } from "@backend/http/api";
import { eventSchema } from "@backend/schemas/trip";
import { ApiError, rate } from "@backend/db/store";
import { trackServer } from "@backend/analytics/analytics";
export async function POST(req: Request) {
  try {
    await rate(req, "event");
    const h = await body(req, eventSchema);
    if (h.name === "room_created" || h.name === "vote_submitted")
      throw new ApiError(400, "This event is recorded by the room.");
    await trackServer(req, {
      ...h,
      destination: h.meta?.destination,
      mode: h.meta?.mode,
    });
    return new Response(null, { status: 204 });
  } catch (e) {
    return failure(e);
  }
}
