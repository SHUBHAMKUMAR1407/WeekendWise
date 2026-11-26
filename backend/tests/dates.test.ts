import { describe, expect, it } from "vitest";
import { todayIST, weekend } from "../src/utils/dates";
import { createSchema, fullName } from "../src/schemas/trip";
describe("IST weekends", () => {
  it.each([
    ["2026-11-26T12:00Z", "2026-11-27", "2026-11-29"],
    ["2026-11-27T12:00Z", "2026-11-27", "2026-11-29"],
    ["2026-11-28T12:00Z", "2026-11-28", "2026-11-29"],
    ["2026-11-29T12:00Z", "2026-11-29", "2026-11-29"],
  ])("uses remaining weekend for %s", (now, startDate, endDate) => {
    expect(weekend("this", new Date(now))).toEqual({ startDate, endDate });
    expect(weekend("next", new Date(now)).startDate).toBe("2026-12-04");
  });
  it("rolls over at IST midnight", () =>
    expect(todayIST(new Date("2026-11-26T18:30Z"))).toBe("2026-11-27"));
  it("cleans names and rejects invalid calendar dates", () => {
    expect(fullName.parse(" A\u0000sha ")).toBe("Asha");
    expect(
      createSchema.safeParse({
        anonId: crypto.randomUUID(),
        mode: "group",
        startCity: "Delhi NCR",
        maxBudgetPerPerson: 4000,
        startDate: "2030-02-30",
        endDate: "2030-03-03",
      }).success,
    ).toBe(false);
  });
});
