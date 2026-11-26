import { body, failure } from "@backend/http/api";
import { createSchema } from "@backend/schemas/trip";
import { createRoom, rate } from "@backend/db/store";
import { trackServer } from "@backend/analytics/analytics";
export async function POST(req: Request) {
  try {
    await rate(req, "create");
    const { anonId, internal, source, solo, ...fields } = await body(
      req,
      createSchema,
    );
    const r = await createRoom(
      fields,
      solo ? { ...solo, comfortBudget: fields.maxBudgetPerPerson } : undefined,
      anonId,
    );
    await trackServer(req, {
      name: "room_created",
      roomId: r.id,
      anonId,
      internal,
      source,
      city: r.startCity,
      groupCreated: r.mode !== "solo",
    });
    return Response.json(r, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
