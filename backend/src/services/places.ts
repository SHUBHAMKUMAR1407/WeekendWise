import { z } from "zod";
import { ApiError } from "../db/store";

export const placesInput = z.object({
  input: z.string().trim().min(2).max(160).regex(/^[^\u0000-\u001f\u007f]+$/),
}).strict();

const predictions = z.object({
  suggestions: z.array(z.object({
    placePrediction: z.object({ text: z.object({ text: z.string().min(1).max(1000) }) }).optional(),
  })).default([]),
});

export async function autocompletePlaces(input: string, request: typeof fetch = fetch, key = process.env.GOOGLE_MAPS_API_KEY) {
  if (!key) throw new ApiError(503, "Live address search is currently unavailable. You can enter your city manually.");
  const response = await request("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "suggestions.placePrediction.text.text",
    },
    body: JSON.stringify({ input, includedRegionCodes: ["in"], languageCode: "en", regionCode: "in" }),
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new ApiError(503, "Google Maps address search is unavailable. Please try again shortly.");
  return predictions.parse(await response.json()).suggestions
    .flatMap(s => s.placePrediction ? [s.placePrediction.text.text] : []).slice(0, 5);
}
