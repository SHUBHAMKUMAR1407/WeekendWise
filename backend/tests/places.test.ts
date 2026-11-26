import { describe, expect, it, vi } from "vitest";
import { autocompletePlaces, placesInput } from "../src/services/places";

describe("Google Places address search", () => {
  it("searches India using a server-side key and returns Sitamarhi predictions", async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ suggestions: [
      { placePrediction: { text: { text: "Sitamarhi, Bihar, India" } } },
    ] }));
    expect(await autocompletePlaces("sitamarhi", request, "test-key")).toEqual(["Sitamarhi, Bihar, India"]);
    const [url, init] = request.mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places:autocomplete");
    expect(init.headers["X-Goog-Api-Key"]).toBe("test-key");
    expect(init.cache).toBe("no-store");
    expect(JSON.parse(init.body)).toMatchObject({ input: "sitamarhi", includedRegionCodes: ["in"] });
  });
  it("stops before an external request when the key is missing", async () => {
    const request = vi.fn();
    await expect(autocompletePlaces("sitamarhi", request, "")).rejects.toMatchObject({ status: 503 });
    expect(request).not.toHaveBeenCalled();
  });
  it("handles empty results and keeps provider errors private", async () => {
    expect(await autocompletePlaces("unknown", vi.fn().mockResolvedValue(Response.json({})), "key")).toEqual([]);
    await expect(autocompletePlaces("sitamarhi", vi.fn().mockResolvedValue(new Response("private upstream diagnostic", { status: 403 })), "key")).rejects.toMatchObject({ status: 503 });
  });
  it("rejects malformed API inputs", () => {
    for (const input of ["s", "x".repeat(161), "Sitamarhi\u0000"]) expect(placesInput.safeParse({ input }).success).toBe(false);
    expect(placesInput.parse({ input: " Sitamarhi " })).toEqual({ input: "Sitamarhi" });
  });
});
