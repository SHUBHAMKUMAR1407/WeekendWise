import { describe, expect, it } from "vitest";
import { createSchema, joinSchema } from "../src/schemas/trip";
import { addDays, todayIST } from "../src/utils/dates";
import { DESTINATIONS, matchesVibe, recommend } from "../src/services/planner";
import { VIBE_TAGS, type Room } from "../src/types";

const identity = { anonId: "d6676c9b-b0b5-45ee-988e-1f4703538403" };
const trip = {
  ...identity, mode: "solo", startCity: "Delhi NCR", maxBudgetPerPerson: 8000,
  startDate: addDays(todayIST(), 21), endDate: addDays(todayIST(), 23),
};

describe("preset and custom vibes", () => {
  it("accepts family trips with member preferences collected through the trip link", () => {
    expect(createSchema.safeParse({ ...trip, mode: "family" }).success).toBe(true);
    expect(createSchema.safeParse({ ...trip, mode: "family", solo: { name: "Asha", vibes: ["Photography"] } }).success).toBe(false);
  });
  it.each([["peace_cafes"], ["Photography"], ["peace_cafes", "Beach hopping"], [...VIBE_TAGS]])("accepts at least one vibe, including custom-only choices", (...vibes) => {
    expect(createSchema.safeParse({ ...trip, solo: { name: "Asha", vibes } }).success).toBe(true);
    expect(joinSchema.safeParse({ ...identity, name: "Asha", comfortBudget: 8000, vibes }).success).toBe(true);
  });
  it("rejects empty, duplicate, oversized and blank custom choices", () => {
    for (const vibes of [[], ["  "], ["Beach", "beach"], ["x".repeat(41)], Array.from({length:11}, (_,i) => "Vibe "+i)]) {
      expect(joinSchema.safeParse({ ...identity, name: "Asha", comfortBudget: 8000, vibes }).success).toBe(false);
    }
  });
  it("sanitizes user text before storing it", () => {
    const result = joinSchema.parse({ ...identity, name: "Asha", comfortBudget: 8000, vibes: ["  Beach\u0000   hopping  "] });
    expect(result.vibes).toEqual(["Beach hopping"]);
  });
  it("matches custom keywords in destination descriptions", () => {
    const destination = { ...DESTINATIONS[0], localTips: ["Visit the quiet beach for sunrise photography."] };
    expect(matchesVibe(destination, "beach hopping")).toBe(true);
    expect(matchesVibe(destination, "photography")).toBe(true);
    expect(matchesVibe(destination, "unicorn convention")).toBe(false);
  });
  it("keeps scores finite for custom-only and object-property-like choices", () => {
    const room: Room = { id:"testvibes1", createdAt:new Date().toISOString(), mode:"solo", startCity:"Delhi NCR", startDate:trip.startDate, endDate:trip.endDate, maxBudgetPerPerson:8000,
      participants:[{id:"one", name:"Asha", comfortBudget:8000, joinedAt:new Date().toISOString(), vibes:["Photography", "__proto__", "constructor"]}] };
    const result = recommend(room);
    expect(result.picks.length).toBeGreaterThan(0);
    expect(result.votes.photography).toBe(1);
    expect(result.votes.__proto__).toBe(1);
    result.picks.forEach(pick => expect(Number.isFinite(pick.match)).toBe(true));
  });
});
