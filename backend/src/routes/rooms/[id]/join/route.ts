import { body, failure, parseId, type Context } from "@backend/http/api";
import { joinSchema } from "@backend/schemas/trip";
import { joinRoom, participantId, rate } from "@backend/db/redis";
import { trackServer } from "@backend/analytics/analytics";
export async function POST(req: Request, c: Context) {
  try {
    const id = await parseId(c);
    await rate(req, "vote");
    const { anonId, internal, source, ...vote } = await body(req, joinSchema);
    const r = await joinRoom(id, {
      ...vote,
      id: participantId(id, anonId),
      joinedAt: new Date().toISOString(),
    });
    await trackServer(req, {
      name: "vote_submitted",
      anonId,
      internal,
      roomId: id,
      source,
      createdDay: new Date(Date.parse(r.createdAt) + 19800000)
        .toISOString()
        .slice(0, 10),
    });
    return Response.json(r);
  } catch (e) {
    return failure(e);
  }
}
