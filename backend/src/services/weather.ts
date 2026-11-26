import { z } from "zod";
import { addDays, daysBetween, todayIST } from "../utils/dates";
import type { Destination } from "../types/index";

export type TripDates = { startDate: string; endDate: string };
export type WeatherVerdict = "GO" | "CARRY_RAINCOAT" | "SKIP";

interface ForecastSummary {
  reasons: string[];
  minC: number | null;
  maxC: number | null;
  rainProbability: number | null;
  fog: boolean;
  thunderstorm: boolean;
}

export type WeatherResult = ForecastSummary &
  (
    | { available: true; verdict: WeatherVerdict }
    | { available: false; verdict: null }
  );

export function seasonalWeather(
  dest: Pick<Destination, "bestTime">,
): WeatherResult {
  return {
    available: false,
    verdict: null,
    minC: null,
    maxC: null,
    rainProbability: null,
    fog: false,
    thunderstorm: false,
    reasons: [
      `Forecast unavailable for these dates. Seasonal guide: ${dest.bestTime}.`,
    ],
  };
}

const dailySchema = z.object({
  time: z.array(z.string().date()).nonempty(),
  precipitation_probability_max: z.array(z.number().min(0).max(100)),
  weather_code: z.array(z.number().int().min(0).max(99)),
  temperature_2m_min: z.array(z.number().finite()),
  temperature_2m_max: z.array(z.number().finite()),
});

/** Covers every requested day; incomplete forecasts cannot earn a favourable verdict. */
export function forecastVerdict(
  payload: unknown,
  dates: TripDates,
): WeatherResult | null {
  const parsed = z.object({ daily: dailySchema }).safeParse(payload);
  if (!parsed.success) return null;
  const d = parsed.data.daily;
  const count = daysBetween(dates.startDate, dates.endDate) + 1;
  if (Object.values(d).some((values) => values.length !== count)) return null;
  if (d.time.some((day, i) => day !== addDays(dates.startDate, i))) return null;
  const rainProbability = Math.max(...d.precipitation_probability_max);
  const fog = d.weather_code.some((code) => code === 45 || code === 48);
  const thunderstorm = d.weather_code.some((code) => code >= 95);
  const heavy = d.weather_code.some((code) =>
    [65, 67, 75, 82, 86].includes(code),
  );
  const wet = d.weather_code.some((code) => code >= 51);
  const reasons: string[] = [];
  if (thunderstorm)
    reasons.push("Thunderstorms are forecast. Consider shifting your dates.");
  if (heavy) reasons.push("Heavy precipitation could disrupt outdoor plans.");
  if (fog) reasons.push("Fog may reduce visibility. Leave extra travel time.");
  if (wet || rainProbability >= 40)
    reasons.push(
      `Peak daily precipitation chance is ${rainProbability}%. Keep a rain layer handy.`,
    );
  if (!reasons.length)
    reasons.push("Mostly dry conditions are forecast for this window.");
  const verdict =
    thunderstorm || heavy
      ? "SKIP"
      : wet || fog || rainProbability >= 40
        ? "CARRY_RAINCOAT"
        : "GO";
  return {
    available: true,
    verdict,
    reasons,
    fog,
    thunderstorm,
    rainProbability,
    minC: Math.round(Math.min(...d.temperature_2m_min)),
    maxC: Math.round(Math.max(...d.temperature_2m_max)),
  };
}

export async function weather(
  dest: Pick<Destination, "lat" | "lon" | "bestTime">,
  dates: TripDates,
  now = new Date(),
  request: typeof fetch = fetch,
): Promise<WeatherResult> {
  const fallback = seasonalWeather(dest);
  const today = todayIST(now);
  const ahead = daysBetween(today, dates.endDate);
  if (dates.startDate < today || dates.endDate < dates.startDate || ahead >= 16)
    return fallback;
  const query = new URLSearchParams({
    latitude: String(dest.lat),
    longitude: String(dest.lon),
    timezone: "Asia/Kolkata",
    start_date: dates.startDate,
    end_date: dates.endDate,
    daily:
      "precipitation_probability_max,temperature_2m_max,temperature_2m_min,weather_code",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await request(
      `https://api.open-meteo.com/v1/forecast?${query.toString()}`,
      {
        signal: controller.signal,
        next: { revalidate: 10800 },
      },
    );
    if (!response.ok) return fallback;
    return forecastVerdict(await response.json(), dates) ?? fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
