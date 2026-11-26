import { ZodError } from "zod";
import { body, failure, type Context } from "../../../http/api";
import { destinationId } from "../../../schemas/updates";
import { crowdDates, crowdSignal } from "../../../schemas/crowd";
import { crowdInsights, saveCrowdSignal } from "../../../db/crowd";
import { rate } from "../../../db/store";
import { todayIST } from "../../../utils/dates";

const headers = { "Cache-Control": "no-store" };
function crowdFailure(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: "Check the destination, trip dates and crowd level. Check-ins need consent and a fresh location accurate to within 2 km." }, { status: 400, headers });
  return failure(error);
}
export async function GET(req: Request, context: Context) {
  try {
    const id = destinationId.parse((await context.params).id), params = new URL(req.url).searchParams;
    const dates = crowdDates.parse({ startDate: params.get("startDate") ?? todayIST(), endDate: params.get("endDate") ?? todayIST() });
    return Response.json(await crowdInsights(id, dates), { headers });
  } catch (error) { return crowdFailure(error); }
}
export async function POST(req: Request, context: Context) {
  try {
    const id = destinationId.parse((await context.params).id), input = await body(req, crowdSignal);
    await rate(req, "crowd");
    return Response.json(await saveCrowdSignal(id, input), { status: 200, headers });
  } catch (error) { return crowdFailure(error); }
}
