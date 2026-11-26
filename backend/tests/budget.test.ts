import { describe, expect, it } from "vitest";
import { createSchema, joinSchema } from "../src/schemas/trip";
import { addDays, todayIST } from "../src/utils/dates";

const identity = { anonId: "d6676c9b-b0b5-45ee-988e-1f4703538403" };
const trip = {
  ...identity, mode: "group", startCity: "Delhi NCR",
  startDate: addDays(todayIST(), 1), endDate: addDays(todayIST(), 3),
};
const vote = {
  ...identity, name: "Asha", vibes: ["peace_cafes", "workation", "trek_adventure"],
};

describe("manual trip budgets", () => {
  it.each([1, 1250, 5275, 12000])("accepts custom whole-rupee budgets of %s for creation and voting", budget => {
    expect(createSchema.safeParse({ ...trip, maxBudgetPerPerson: budget }).success).toBe(true);
    expect(joinSchema.safeParse({ ...vote, comfortBudget: budget }).success).toBe(true);
  });
  it.each([0, -1, 2500.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, "", null])("rejects invalid budget %s", budget => {
    expect(createSchema.safeParse({ ...trip, maxBudgetPerPerson: budget }).success).toBe(false);
    expect(joinSchema.safeParse({ ...vote, comfortBudget: budget }).success).toBe(false);
  });
});
