import { describe, expect, it, vi } from "vitest";
import type { Destination, Room, TransportOption } from "../src/types/index";
import { START_CITIES } from "../src/types/index";
import { costSplit, transportAdvisor } from "../src/services/transport";
import { crowd, DESTINATIONS, recommend, smartSwap } from "../src/services/planner";
import { forecastVerdict, seasonalWeather, weather } from "../src/services/weather";
import type { WeatherResult } from "../src/services/weather";

const dates = { startDate: "2026-11-27", endDate: "2026-11-29" };
const room: Room = {
  id: "abcdefghij",
  ...dates,
  createdAt: "2026-11-26T00:00:00Z",
  mode: "group",
  startCity: "Delhi NCR",
  maxBudgetPerPerson: 8000,
  participants: [
    {
      id: "p1",
      name: "Mira",
      comfortBudget: 5000,
      vibes: ["peace_cafes", "trek_adventure", "workation"],
      joinedAt: "2026-11-26T02:00:00Z",
    },
    {
      id: "p2",
      name: "Aman",
      comfortBudget: 7000,
      vibes: ["peace_cafes", "heritage_streets", "workation"],
      joinedAt: "2026-11-26T04:00:00Z",
    },
  ],
};
const bus: TransportOption = {
  mode: "bus_volvo",
  gatewayId: "bus",
  hoursOnVehicle: 8,
  costRoundTripINR: [800, 1200],
  typicalDepartureWindow: "21:00-22:00",
  typicalArrivalWindow: "05:00-06:00",
  overnight: true,
  changes: 0,
  bookingHint: "Check the operator.",
  weatherSensitivity: "high",
  available: true,
};
const train: TransportOption = {
  ...bus,
  mode: "train",
  gatewayId: "rail",
  typicalDepartureWindow: "06:00-07:00",
  typicalArrivalWindow: "13:00-14:00",
  costRoundTripINR: [1000, 1200],
  overnight: false,
  weatherSensitivity: "low",
};
const dest: Destination = {
  id: "ridge",
  name: "Ridge",
  state: "Uttarakhand",
  lat: 30,
  lon: 78,
  vibes: ["peace_cafes", "trek_adventure", "workation"],
  routes: { "Delhi NCR": [bus, train] },
  gateways: [
    {
      id: "bus",
      name: "Ridge bus stand",
      type: "bus",
      distanceKmToDest: 2,
      lastMile: { minutes: 15, costINR: [50, 100], options: ["auto"] },
      lateNightSafe: false,
    },
    {
      id: "rail",
      name: "Valley Junction",
      type: "train",
      distanceKmToDest: 30,
      lastMile: {
        minutes: 60,
        costINR: [100, 200],
        options: ["local_bus", "taxi"],
      },
      lateNightSafe: false,
    },
  ],
  nearestAirport: "Valley",
  nearestRailhead: "Valley Junction",
  weekendCities: ["Delhi NCR"],
  crowdByMonth: Array(12).fill(2),
  crowdNotes: [],
  monsoonRisk: [7, 8],
  costPerDay: { stay: [400, 600], food: [150, 250], local: [50, 150] },
  bestTime: "October to March",
  localTips: ["Bring cash", "Walk", "Start early"],
  itineraryTemplate: {
    fridayNight: "Arrive",
    saturday: "Explore",
    sunday: "Return",
  },
  hasGoSTOPS: false,
  confidence: "estimated",
  lastVerified: null,
};
const clear: WeatherResult = {
  available: true,
  verdict: "GO",
  reasons: ["Mostly dry."],
  rainProbability: 5,
  minC: 14,
  maxC: 25,
  fog: false,
  thunderstorm: false,
};
function rank(
  options: TransportOption[],
  mode: Room["mode"] = "group",
  window = dates,
) {
  return transportAdvisor(
    { ...dest, routes: { "Delhi NCR": options } },
    room.startCity,
    window,
    { ...room, mode },
    clear,
    { level: 2 },
  );
}

describe("door-to-door transport and selected costs", () => {
  it("favours a lower-cost overnight bus arriving before 7am over a day train", () => {
    const result = rank([train, bus]);
    expect(result.options[0].mode).toBe("bus_volvo");
    expect(result.options[0].badges).toEqual([
      "Best overall",
      "Cheapest",
      "Fastest",
    ]);
    expect(result.reason).toContain("saving a night");
  });
  it("penalises a window crossing 23:00 and penalises it more for a solo arrival", () => {
    const late = { ...bus, typicalArrivalWindow: "22:30-00:30" };
    const loss = (mode: Room["mode"]) =>
      rank([bus], mode).options[0].score - rank([late], mode).options[0].score;
    expect(loss("group")).toBeGreaterThan(0.15);
    expect(loss("solo")).toBeGreaterThan(loss("group"));
    expect(rank([late]).options[0].warnings.join(" ")).toContain(
      "limited onward",
    );
    expect(
      rank([{ ...bus, typicalArrivalWindow: "05:00-05:30" }]).options[0]
        .lateNightArrival,
    ).toBe(false);
  });
  it.each(["bus_volvo", "cab_self_drive"] as const)(
    "downgrades %s in monsoon even without rain today",
    (mode) => {
      const route = { ...bus, mode };
      const monsoon = rank([route], "group", {
        startDate: "2027-07-09",
        endDate: "2027-07-11",
      }).options[0];
      expect(monsoon.score).toBeLessThan(rank([route]).options[0].score);
      expect(monsoon.warnings.join(" ")).toContain("Monsoon");
    },
  );
  it("exposes a railhead transfer with round-trip last mile, buffers, return risk and repeatable ranking", () => {
    const routes = [
      { ...train, changes: 1 },
      { ...bus, available: false },
    ];
    const a = rank(routes);
    expect(a).toEqual(rank(routes));
    expect(a.options).toHaveLength(1);
    expect(a.options[0]).toMatchObject({
      gateway: { name: "Valley Junction" },
      doorToDoorMinutes: 570,
      costRange: [1200, 1600],
    });
    expect(a.options[0].warnings.join(" ")).toContain(
      "Continue to Ridge by road",
    );
    expect(a.returnPlan).toContain("Only one");
  });
  it("takes the chosen route, counts an overnight saving once, and recomputes the full range", () => {
    const { options } = rank([bus, train]);
    expect(costSplit(dest, dates, options)).toMatchObject({
      nights: 1,
      days: 3,
      total: 2550,
      range: [1900, 3200],
    });
    expect(costSplit(dest, dates, options, options[1].id)).toMatchObject({
      nights: 2,
      days: 3,
      total: 3300,
      range: [2600, 4000],
    });
  });
  it("does not take a lodging saving on a same-day trip", () => {
    expect(
      costSplit(
        dest,
        { ...dates, endDate: dates.startDate },
        rank([bus]).options,
      ).nights,
    ).toBe(0);
  });
  it("incorporates North India winter fog for trains", () => {
    expect(
      rank([train], "solo", {
        startDate: "2027-01-01",
        endDate: "2027-01-02",
      }).options[0].warnings.join(" "),
    ).toContain("Fog-delay");
  });
});

describe("weather", () => {
  const daily = {
    time: ["2026-11-27", "2026-11-28", "2026-11-29"],
    precipitation_probability_max: [0, 10, 20],
    weather_code: [0, 1, 2],
    temperature_2m_min: [14, 16, 18],
    temperature_2m_max: [22, 25, 26],
  };
  const now = new Date("2026-11-26T23:00:00+05:30");
  it.each([45, 48])("detects WMO fog %i and checks all days", (code) => {
    expect(
      forecastVerdict(
        { daily: { ...daily, weather_code: [0, code, 0] } },
        dates,
      ),
    ).toMatchObject({
      verdict: "CARRY_RAINCOAT",
      fog: true,
      minC: 14,
      maxC: 26,
    });
  });
  it("classifies thunderstorms, wet conditions, and a dry window", () => {
    expect(
      forecastVerdict({ daily: { ...daily, weather_code: [1, 2, 95] } }, dates)
        ?.verdict,
    ).toBe("SKIP");
    expect(
      forecastVerdict(
        { daily: { ...daily, precipitation_probability_max: [1, 65, 1] } },
        dates,
      )?.verdict,
    ).toBe("CARRY_RAINCOAT");
    expect(forecastVerdict({ daily }, dates)?.verdict).toBe("GO");
  });
  it("skips calls at or beyond the 16-day horizon and falls back on timeout, HTTP failure or partial data", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const future = { startDate: "2026-12-12", endDate: "2026-12-13" };
    expect((await weather(dest, future, now, fetcher)).available).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    fetcher
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(
        Response.json({
          daily: { ...daily, temperature_2m_min: [null, null, 2] },
        }),
      );
    for (let i = 0; i < 3; i++)
      expect(await weather(dest, dates, now, fetcher)).toEqual(
        seasonalWeather(dest),
      );
  });
  it("requests exact IST dates and enables three-hour fetch caching", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ daily }));
    expect((await weather(dest, dates, now, fetcher)).verdict).toBe("GO");
    const [url, options] = fetcher.mock.calls[0];
    expect(new URL(String(url)).searchParams.get("timezone")).toBe(
      "Asia/Kolkata",
    );
    expect(options).toMatchObject({ next: { revalidate: 10800 } });
  });
});

describe("crowd, recommendations, and swaps", () => {
  it("produces usable options, finite totals and two distinct choices across all ten seeded cities at the upper budget", () => {
    expect(DESTINATIONS.length).toBeGreaterThanOrEqual(25);
    for (const startCity of START_CITIES) {
      const trip = {
        ...room,
        startCity,
        participants: [{ ...room.participants[0], comfortBudget: 8000 }],
      };
      const result = recommend(trip);
      expect(result.picks, startCity).toHaveLength(2);
      for (const pick of result.picks) {
        expect(pick.cost.total).toBeGreaterThan(0);
        expect(pick.cost.total).toBeLessThanOrEqual(8000 * 1.15);
        expect(pick.transport.options[0].badges).toContain("Best overall");
        expect(Number.isFinite(pick.match)).toBe(true);
      }
    }
  });
  it("uses full date span, one regional holiday increment, one weekend increment, capped at five", () => {
    const regional = {
      name: "Local break",
      startDate: "2026-11-29",
      endDate: "2026-12-02",
      states: [dest.state],
    };
    expect(crowd(dest, dates, "Delhi NCR", [regional, regional])).toMatchObject(
      { level: 4, label: "High" },
    );
    expect(
      crowd(dest, dates, "Mumbai", [{ ...regional, states: ["Goa"] }]).level,
    ).toBe(2);
    expect(
      crowd({ ...dest, crowdByMonth: Array(12).fill(4) }, dates, "Delhi NCR", [
        regional,
      ]).level,
    ).toBe(5);
  });
  it("uses the tightest comfort budget, vote totals, and a meaningfully different second pick", () => {
    const clone = { ...dest, id: "same-vibes" };
    const other = {
      ...dest,
      id: "west",
      state: "Gujarat",
      vibes: ["heritage_streets" as const],
    };
    const out = recommend(room, {}, [
      dest,
      clone,
      other,
      { ...dest, id: "unreachable", routes: {} },
    ]);
    expect(out.budget).toBe(5000);
    expect(out.votes).toMatchObject({
      peace_cafes: 2,
      party_bonfire: 0,
      heritage_streets: 1,
    });
    expect(out.picks.map((p) => p.destination.id)).toEqual(["ridge", "west"]);
    expect(out.picks[0].weather.available).toBe(false);
    expect(out.swap).toBeNull();
  });
  it("drops destinations beyond 115% of the lowest comfort budget", () => {
    const result = recommend(
      {
        ...room,
        participants: [{ ...room.participants[0], comfortBudget: 2000 }],
      },
      {},
      [dest],
    );
    expect(result.picks).toHaveLength(0);
    expect(result.reason).toContain("higher budget");
    expect(recommend(room, {}, [])).toMatchObject({
      picks: [],
      reason: expect.stringContaining("No routes"),
    });
  });
  it("keeps an exactly-on-the-limit trip and drops it just beyond the limit", () => {
    const solo = {
      ...room,
      participants: [{ ...room.participants[0], comfortBudget: 2000 }],
    };
    const priced = {
      ...dest,
      costPerDay: { ...dest.costPerDay, stay: [250, 250] as [number, number] },
    };
    expect(recommend(solo, {}, [priced]).picks).toHaveLength(1);
    expect(
      recommend(solo, {}, [
        { ...priced, costPerDay: { ...priced.costPerDay, stay: [251, 251] } },
      ]).picks,
    ).toHaveLength(0);
  });
  it("offers a less sensitive mode in rain, and another destination or date for a SKIP", () => {
    const [pick] = recommend(room, { ridge: clear }, [dest]).picks;
    const wet = {
      ...pick,
      weather: { ...clear, verdict: "CARRY_RAINCOAT" as const },
    };
    expect(smartSwap([wet])).toContain("via Valley Junction");
    const storm = { ...pick, weather: { ...clear, verdict: "SKIP" as const } };
    expect(smartSwap([storm])).toContain("Shift your departure");
    expect(
      smartSwap([storm, { ...pick, destination: { ...dest, name: "Lake" } }]),
    ).toContain("Lake");
  });
});
