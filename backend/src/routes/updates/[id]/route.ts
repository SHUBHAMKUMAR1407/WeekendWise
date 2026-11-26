import { body, failure, type Context } from "@backend/http/api";
import { destinationId, updateSchema } from "@backend/schemas/updates";
import { recentUpdates, saveUpdate } from "@backend/db/updates";
import { rate } from "@backend/db/store";
import { ZodError } from "zod";

function updateFailure(error: unknown) {
  if (error instanceof ZodError) return Response.json({
    error: "Choose a supported destination, a visit from the last seven days, and valid weather and crowd options. Keep your name within 40 characters and note within 280, and confirm your visit.",
  }, { status: 400, headers: { "Cache-Control": "no-store" } });
  return failure(error);
}

export async function GET(_req: Request, context: Context) {
  try {
    const id = destinationId.parse((await context.params).id);
    return Response.json(await recentUpdates(id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return updateFailure(error); }
}
export async function POST(req: Request, context: Context) {
  try {
    const id = destinationId.parse((await context.params).id);
    const input = await body(req, updateSchema);
    await rate(req, "report");
    return Response.json(await saveUpdate(id, input), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return updateFailure(error); }
}
