import { addDays, daysBetween } from "../utils/dates";
import type {
  DateRange,
  Destination,
  Gateway,
  Range,
  Room,
  StartCity,
  TransportMode,
  TransportOption,
} from "../types/index";
import type { WeatherResult } from "./weather";
import type { CrowdResult } from "./planner";

export const TRANSPORT_WEIGHTS = {
  timeFit: 0.3,
  budgetFit: 0.25,
  comfortSafety: 0.2,
  weatherReliability: 0.15,
  nightBonus: 0.1,
  soloSafetyShift: 0.1,
} as const;

export const MODE_LABELS: Record<TransportMode, string> = {
  bus_volvo: "Volvo bus",
  bus_sleeper: "Sleeper bus",
  train: "Train",
  flight: "Flight",
  cab_self_drive: "Cab / self-drive",
};
export interface RankedOption extends TransportOption {
  id: string;
  modeLabel: string;
  gateway: Gateway;
  doorToDoorMinutes: number;
  totalCost: number;
  costRange: Range;
  timeFit: number;
  score: number;
  lateNightArrival: boolean;
  warnings: string[];
  badges: string[];
}
export interface TransportAdvice {
  options: RankedOption[];
  reason: string;
  returnPlan: string;
}
export interface CostSplit {
  total: number;
  range: Range;
  transport: number;
  stay: number;
  food: number;
  local: number;
  nights: number;
  days: number;
}

const midpoint = (range: Range) => (range[0] + range[1]) / 2;
const clamp = (n: number) => Math.min(1, Math.max(0, n));
const northOrigins: StartCity[] = ["Delhi NCR", "Chandigarh", "Jaipur"];
export const groupBudget = (room: Room) =>
  room.participants.length
    ? Math.min(...room.participants.map((person) => person.comfortBudget))
    : room.maxBudgetPerPerson;

function arrivalMinutes(range: string): { end: number; late: boolean } {
  const [start, end] = range.split("-").map((clock) => {
    const [h, m] = clock.trim().split(":").map(Number);
    return h * 60 + m;
  });
  return {
    end,
    late:
      start < 300 || end < 300 || start >= 1380 || end >= 1380 || end < start,
  };
}

export function tripMonths(dates: DateRange): number[] {
  const months = new Set<number>();
  for (
    let date = dates.startDate;
    date <= dates.endDate;
    date = addDays(date, 1)
  ) {
    months.add(Number(date.slice(5, 7)));
  }
  return Array.from(months);
}

function weatherReliability(
  route: TransportOption,
  startCity: StartCity,
  dest: Destination,
  months: number[],
  forecast: WeatherResult,
  warnings: string[],
) {
  const sensitivity = { low: 0.25, medium: 0.55, high: 0.9 }[
    route.weatherSensitivity
  ];
  const road = route.mode.startsWith("bus") || route.mode === "cab_self_drive";
  let risk = 0;
  if (forecast.thunderstorm || forecast.verdict === "SKIP")
    risk += sensitivity * 0.8;
  else if ((forecast.rainProbability ?? 0) >= 40) risk += sensitivity * 0.4;
  if (road && months.some((m) => dest.monsoonRisk.includes(m))) {
    risk += sensitivity * 0.55;
    warnings.push("Monsoon road risk. Check road status before departure.");
  }
  const winterFog =
    northOrigins.includes(startCity) && months.some((m) => m === 12 || m === 1);
  if (
    (route.mode === "train" || route.mode === "flight") &&
    (winterFog || forecast.fog)
  ) {
    risk += 0.25;
    warnings.push("Fog-delay risk. Leave slack for your onward connection.");
  } else if (forecast.fog && road) {
    risk += sensitivity * 0.4;
    warnings.push("Fog is forecast. Allow extra road time.");
  }
  return clamp(1 - risk);
}

export function transportAdvisor(
  dest: Destination,
  startCity: StartCity,
  dates: DateRange,
  room: Room,
  forecast: WeatherResult,
  crowd: Pick<CrowdResult, "level">,
): TransportAdvice {
  const budget = groupBudget(room);
  const months = tripMonths(dates);
  const options: RankedOption[] = [];
  for (const [index, route] of (dest.routes[startCity] ?? []).entries()) {
    if (!route.available) continue;
    const gateway = dest.gateways.find((g) => g.id === route.gatewayId);
    if (!gateway) continue;
    const lastMile = gateway.lastMile;
    const costRange: Range = [
      route.costRoundTripINR[0] + 2 * lastMile.costINR[0],
      route.costRoundTripINR[1] + 2 * lastMile.costINR[1],
    ];
    const totalCost = midpoint(costRange);
    const doorToDoorMinutes = Math.round(
      route.hoursOnVehicle * 60 + lastMile.minutes + 30 * route.changes,
    );
    const arrival = arrivalMinutes(route.typicalArrivalWindow);
    // Use the later end of the window to avoid rewarding an optimistic connection.
    const arrivalAtStay = arrival.end + lastMile.minutes;
    const timeFit = clamp(1 - Math.max(0, arrivalAtStay - 9 * 60) / (11 * 60));
    const warnings: string[] = [];
    const limitedPickup = arrival.late && !gateway.lateNightSafe;
    if (limitedPickup)
      warnings.push(
        "Late-night arrival with limited onward transport. Choose daylight or arrange a pickup in advance.",
      );
    else if (arrival.late)
      warnings.push(
        "Late-night arrival. Confirm your pickup and reception hours.",
      );
    if (route.changes)
      warnings.push(
        `${route.changes} change${route.changes === 1 ? "" : "s"} on this journey. Allow transfer time.`,
      );
    if (
      route.mode === "train" &&
      gateway.distanceKmToDest > 0 &&
      lastMile.options.some((mode) => mode !== "walk")
    ) {
      warnings.push(
        `Alight at ${gateway.name}. Continue to ${dest.name} by road.`,
      );
    }
    const reliability = weatherReliability(
      route,
      startCity,
      dest,
      months,
      forecast,
      warnings,
    );
    const connectionRisk = route.changes * (crowd.level >= 4 ? 0.16 : 0.1);
    const comfortSafety = clamp(
      1 - (limitedPickup ? 0.95 : 0) - connectionRisk,
    );
    const nightsSaved =
      route.overnight && dates.endDate > dates.startDate ? 1 : 0;
    const netCost = Math.max(
      0,
      totalCost - nightsSaved * midpoint(dest.costPerDay.stay),
    );
    const budgetFit = clamp(1 - netCost / Math.max(1, budget));
    const w = TRANSPORT_WEIGHTS;
    const shift = room.mode === "solo" ? w.soloSafetyShift : 0;
    const score =
      w.timeFit * timeFit +
      (w.budgetFit - shift) * budgetFit +
      (w.comfortSafety + shift) * comfortSafety +
      w.weatherReliability * reliability +
      w.nightBonus * nightsSaved;
    options.push({
      ...route,
      id: `${route.mode}-${gateway.id}-${index}`,
      modeLabel: MODE_LABELS[route.mode],
      gateway,
      doorToDoorMinutes,
      totalCost,
      costRange,
      score,
      timeFit,
      lateNightArrival: arrival.late,
      warnings,
      badges: [],
    });
  }
  options.sort(
    (a, b) =>
      b.score - a.score ||
      a.totalCost - b.totalCost ||
      a.id.localeCompare(b.id),
  );
  const best = options[0];
  if (!best)
    return {
      options,
      reason: "No route is available from this city.",
      returnPlan: "Check a different departure city or weekend.",
    };
  const cheapest = Math.min(...options.map((o) => o.totalCost));
  const fastest = Math.min(...options.map((o) => o.doorToDoorMinutes));
  for (const option of options) {
    if (option === best) option.badges.push("Best overall");
    if (option.totalCost === cheapest) option.badges.push("Cheapest");
    if (option.doorToDoorMinutes === fastest) option.badges.push("Fastest");
  }
  const stayNote =
    best.overnight && dates.startDate < dates.endDate
      ? ", saving a night of stay"
      : "";
  const reason = `${best.modeLabel} reaches ${best.gateway.name} around ${best.typicalArrivalWindow}${stayNote}. Budget about ₹${(Math.round(best.totalCost / 50) * 50).toLocaleString("en-IN")} return including the last mile.`;
  const returnPlan =
    options.length === 1
      ? "Only one practical route is listed. Confirm the last return service and reserve your ride back before leaving."
      : "Check the final Sunday bus or train and its last-mile connection before leaving. Keep an earlier return as backup.";
  return { options, reason, returnPlan };
}

export function costSplit(
  dest: Destination,
  dates: DateRange,
  options: RankedOption[],
  chosenOptionId?: string,
): CostSplit {
  const chosen =
    options.find((option) => option.id === chosenOptionId) ?? options[0];
  if (!chosen)
    throw new Error("Choose an available route to estimate this trip.");
  const elapsed = daysBetween(dates.startDate, dates.endDate);
  const days = elapsed + 1;
  const nights = Math.max(0, elapsed - Number(chosen.overnight));
  const daily = dest.costPerDay;
  const estimate = (index: 0 | 1) =>
    chosen.costRange[index] +
    nights * daily.stay[index] +
    days * (daily.food[index] + daily.local[index]);
  const range: Range = [estimate(0), estimate(1)];
  return {
    total: midpoint(range),
    range,
    transport: chosen.totalCost,
    nights,
    days,
    stay: nights * midpoint(daily.stay),
    food: days * midpoint(daily.food),
    local: days * midpoint(daily.local),
  };
}
