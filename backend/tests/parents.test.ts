import { describe, expect, it } from "vitest";
import { DESTINATIONS, recommend } from "../src/services/planner";
import { parentPack, parentResistanceScore } from "../src/services/parents";
import type { Language, ParentPackInput, Strictness, Worry } from "../src/services/parents";
import { costSplit } from "../src/services/transport";
import { money } from "../src/types/index";
import type { Room } from "../src/types/index";
import { cardQuery } from "../src/schemas/trip";

const room: Room = {
  id: "abcdefghij",
  mode: "group",
  startCity: "Delhi NCR",
  startDate: "2026-11-27",
  endDate: "2026-11-29",
  createdAt: "2026-11-26T12:00:00Z",
  maxBudgetPerPerson: 8000,
  participants: [],
};
const dest = DESTINATIONS.find((d) => d.id === "rishikesh")!;
const [pick] = recommend(room, {}, [dest]).picks;
const base: ParentPackInput = {
  room,
  pick,
  option: pick.transport.options[0],
  lang: "english",
  strictness: "chill",
  worry: "company",
};
const strictnesses: Strictness[] = ["chill", "moderate", "high"];
const worries: Worry[] = ["solo_safety", "budget", "company", "weather_crowd"];

describe("Parent Pack", () => {
  it("uses English for defaults and older shared language parameters", () => {
    expect(cardQuery.parse({}).lang).toBe("english");
    expect(cardQuery.parse({ lang: "hinglish" }).lang).toBe("english");
    expect(parentPack({ ...base, lang: "hinglish" })).toEqual(parentPack({ ...base, lang: "english" }));
    expect(parentResistanceScore({ ...base, lang: "hinglish" }).label).toBe(parentResistanceScore(base).label);
  });
  it.each(["english", "hinglish"] as Language[])(
    "builds distinct messages and spoken pitches for all 12 %s preferences",
    (lang) => {
      const messages = new Set<string>();
      const pitches = new Set<string>();
      for (const strictness of strictnesses)
        for (const worry of worries) {
          const pack = parentPack({ ...base, lang, strictness, worry });
          expect(pack.checklist).toHaveLength(6);
          expect(pack.message).toContain(dest.name);
          expect(pack.message).toContain(base.option.gateway.name);
          expect(pack.brief.location).toContain("WhatsApp");
          expect(pack.brief.location).toContain("Google Maps");
          expect(pack.brief.checkIns.split(",").length).toBeGreaterThanOrEqual(
            3,
          );
          expect(pack.brief.emergency).toContain("______");
          expect(pack.checklist[0]).toMatch(/ticket/i);
          expect(pack.brief.conditions).toContain("Estimated crowd level");
          expect(pack.message).not.toMatch(
            /undefined|100% safe|verified hostel/i,
          );
          messages.add(pack.message);
          pitches.add(pack.pitch);
        }
      expect(messages.size).toBe(12);
      expect(pitches.size).toBe(12);
    },
  );
  it("uses the selected option for the arrival plan, departure and trip cost", () => {
    const train = pick.transport.options.find((o) => o.mode === "train")!;
    const pack = parentPack({ ...base, option: train });
    expect(pack.brief.transport).toContain(train.modeLabel);
    expect(pack.brief.transport).toContain(train.typicalDepartureWindow);
    expect(pack.brief.arrival).toContain(train.gateway.name);
    expect(pack.message).toContain(`${train.gateway.lastMile.minutes} min`);
    const [min, max] = costSplit(
      dest,
      room,
      pick.transport.options,
      train.id,
    ).range;
    expect(pack.message).toContain(`${money(min)}–${money(max)}`);
    expect(pack.brief.returnPlan).toBe(pick.transport.returnPlan);
  });
  it("suggests a specific daytime alternative or a changed departure for limited late-night arrivals", () => {
    const option = {
      ...base.option,
      lateNightArrival: true,
      typicalArrivalWindow: "02:00-03:00",
      gateway: { ...base.option.gateway, lateNightSafe: false },
    };
    const alt = {
      ...pick.transport.options[1],
      id: "daytime-rail",
      typicalArrivalWindow: "10:00-11:00",
      lateNightArrival: false,
    };
    const input = {
      ...base,
      option,
      pick: {
        ...pick,
        transport: { ...pick.transport, options: [option, alt] },
      },
    };
    const pack = parentPack(input);
    expect(pack.brief.arrival).toContain("Late-night");
    expect(pack.pitch).toContain(alt.typicalArrivalWindow);
    expect(pack.brief.arrival).toContain(alt.gateway.name);
    for (const lang of ["english", "hinglish"] as const) {
      const soloOption = parentPack({
        ...input,
        lang,
        pick: { ...pick, transport: { ...pick.transport, options: [option] } },
      });
      expect(soloOption.brief.arrival).toMatch(/daytime arrival|din mein/);
    }
  });
  it("resistance scoring is repeatable, bounded and responds to the selected journey", () => {
    const easy = {
      ...base,
      option: {
        ...base.option,
        changes: 0,
        overnight: false,
        lateNightArrival: false,
      },
    };
    const score = parentResistanceScore(easy);
    expect(parentResistanceScore(easy)).toEqual(score);
    expect(score.level).toBeGreaterThanOrEqual(1);
    const difficult = {
      ...easy,
      strictness: "high" as const,
      worry: "solo_safety" as const,
      room: { ...room, mode: "solo" as const },
      option: {
        ...easy.option,
        overnight: true,
        lateNightArrival: true,
        changes: 2,
        gateway: { ...easy.option.gateway, lateNightSafe: false },
      },
    };
    expect(parentResistanceScore(difficult).level).toBeGreaterThan(score.level);
    expect(parentResistanceScore(difficult).level).toBeLessThanOrEqual(10);
    expect(
      parentResistanceScore({ ...easy, option: { ...easy.option, changes: 2 } })
        .level,
    ).toBeGreaterThan(score.level);
    expect(
      parentResistanceScore({
        ...easy,
        option: { ...easy.option, overnight: true },
      }).level,
    ).toBeGreaterThan(score.level);
    const late = parentResistanceScore({
      ...easy,
      option: {
        ...easy.option,
        lateNightArrival: true,
        gateway: { ...easy.option.gateway, lateNightSafe: false },
      },
    });
    expect(late.level).toBeGreaterThan(score.level);
    const forecastRisk = parentResistanceScore({
      ...easy,
      pick: {
        ...pick,
        weather: { ...pick.weather, available: true, verdict: "SKIP" },
      },
    });
    expect(forecastRisk.level).toBeGreaterThan(score.level);
    expect(parentResistanceScore({ ...easy, lang: "hinglish" }).level).toEqual(
      score.level,
    );
    expect(late.label).toMatch(new RegExp("^Level " + late.level));
  });
});
