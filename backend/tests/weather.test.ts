import { afterEach, describe, expect, it, vi } from "vitest";
import { weather, weatherApiVerdict } from "../src/services/weather";

const dates = { startDate: "2026-11-27", endDate: "2026-11-29" };
const dest = { lat: 30, lon: 78, bestTime: "October to March" };
const now = new Date("2026-11-26T12:00:00+05:30");
const payload = (code = 1000) => ({ forecast: { forecastday:
  ["2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"].map((date) => ({
    date, day: { mintemp_c: 12, maxtemp_c: 23, daily_chance_of_rain: "10", condition: { code } },
  })),
} });

afterEach(() => vi.unstubAllEnvs());

describe("WeatherAPI integration", () => {
  it.each([
    [1000, "GO"], [1135, "CARRY_RAINCOAT"], [1183, "CARRY_RAINCOAT"],
    [1195, "SKIP"], [1276, "SKIP"],
  ])("converts condition %i and selects only trip dates", (code, verdict) => {
    expect(weatherApiVerdict(payload(Number(code)), dates)).toMatchObject({
      available: true, verdict, minC: 12, maxC: 23, rainProbability: 10,
    });
  });

  it("rejects partial coverage, malformed data and unknown conditions", () => {
    const partial = payload();
    partial.forecast.forecastday.pop();
    expect(weatherApiVerdict(partial, dates)).toBeNull();
    expect(weatherApiVerdict({}, dates)).toBeNull();
    expect(weatherApiVerdict(payload(9999), dates)).toBeNull();
  });

  it("uses the server key and destination coordinates with caching", async () => {
    vi.stubEnv("WEATHER_API_KEY", "test-key");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(payload()));
    expect((await weather(dest, dates, now, fetcher)).verdict).toBe("GO");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.hostname).toBe("api.weatherapi.com");
    expect(parsed.searchParams.get("key")).toBe("test-key");
    expect(parsed.searchParams.get("q")).toBe("30,78");
    expect(parsed.searchParams.get("days")).toBe("4");
    expect(options).toMatchObject({ next: { revalidate: 10800 } });
  });

  it.each(["http", "partial", "network"])("falls back to Open-Meteo on %s failure", async (failure) => {
    vi.stubEnv("WEATHER_API_KEY", "test-key");
    const fetcher = vi.fn<typeof fetch>();
    if (failure === "network") fetcher.mockRejectedValueOnce(new Error("offline"));
    else fetcher.mockResolvedValueOnce(failure === "http"
      ? new Response("", { status: 403 }) : Response.json({ forecast: { forecastday: [] } }));
    fetcher.mockResolvedValueOnce(Response.json({ daily: {
      time: [dates.startDate, "2026-11-28", dates.endDate],
      precipitation_probability_max: [0, 0, 0], weather_code: [0, 0, 0],
      temperature_2m_min: [12, 12, 12], temperature_2m_max: [23, 23, 23],
    } }));
    expect((await weather(dest, dates, now, fetcher)).verdict).toBe("GO");
    expect(new URL(String(fetcher.mock.calls[1][0])).hostname).toBe("api.open-meteo.com");
  });
});
