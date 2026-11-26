import { body, failure } from "../../../http/api";
import { ApiError, rate } from "../../../db/store";
import { autocompletePlaces, placesInput } from "../../../services/places";

export async function POST(req: Request) {
  try {
    const { input } = await body(req, placesInput);
    if (!process.env.GOOGLE_MAPS_API_KEY) throw new ApiError(503, "Live address search is currently unavailable. You can enter your city manually.");
    await rate(req, "places");
    return Response.json({ suggestions: await autocompletePlaces(input) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
