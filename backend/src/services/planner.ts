import records from "../../data/destinations.json";
import holidayRecords from "../../data/holidays.json";
import { addDays } from "../utils/dates";
import {
  costSplit,
  groupBudget,
  transportAdvisor,
  tripMonths,
} from "./transport";
import type { CostSplit, TransportAdvice } from "./transport";
import { VIBE_NAMES, VIBE_TAGS } from "../types/index";
import type { DateRange, Destination, Room, StartCity, Vibe } from "../types/index";
import { seasonalWeather } from "./weather";
import type { WeatherResult } from "./weather";

export { costSplit } from "./transport";
export const DESTINATIONS = records as Destination[];
export const RECOMMEND_WEIGHTS = {
  vibeMatch: 0.4,
  budgetFit: 0.25,
  weather: 0.2,
  crowd: 0.15,
} as const;

export interface Holiday {
  name: string;
  startDate: string;
  endDate: string;
  states?: string[];
}
export interface CrowdResult {
  level: number;
  label: "Low" | "Medium" | "High" | "Avoid";
  reasons: string[];
  tip: string;
}
export interface PickResult {
  destination: Destination;
  match: number;
  weather: WeatherResult;
  crowd: CrowdResult;
  transport: TransportAdvice;
  cost: CostSplit;
}
export interface Recommendation {
  votes: Record<string, number>;
  budget: number;
  picks: PickResult[];
  reason: string | null;
  swap: string | null;
}

export function crowd(
  dest: Destination,
  dates: DateRange,
  startCity?: StartCity,
  holidays: Holiday[] = holidayRecords as Holiday[],
): CrowdResult {
  const months = tripMonths(dates);
  let level = Math.max(...months.map((month) => dest.crowdByMonth[month - 1]));
  const reasons = [
    `Seasonal baseline ${level}/5 for the travel month${months.length > 1 ? "s" : ""}.`,
  ];
  if (dest.crowdNotes.length) reasons.push(...dest.crowdNotes);
  if (
    startCity
      ? dest.weekendCities.includes(startCity)
      : dest.weekendCities.length > 0
  ) {
    for (
      let date = dates.startDate;
      date <= dates.endDate;
      date = addDays(date, 1)
    ) {
      const day = new Date(date + "T12:00:00Z").getUTCDay();
      if (day === 0 || day === 6) {
        level++;
        reasons.push(
          startCity
            ? `Weekend travellers from ${startCity}.`
            : "Popular weekend getaway.",
        );
        break;
      }
    }
  }
  const overlapping = holidays.filter(
    (h) =>
      h.startDate <= dates.endDate &&
      h.endDate >= dates.startDate &&
      (!h.states?.length || h.states.includes(dest.state)),
  );
  if (overlapping.length) {
    level++;
    reasons.push(
      overlapping.map((h) => h.name).join(" / ") + " overlaps this trip.",
    );
  }
  level = Math.min(5, level);
  const label =
    level <= 2
      ? "Low"
      : level === 3
        ? "Medium"
        : level === 4
          ? "High"
          : "Avoid";
  return {
    level,
    label,
    reasons,
    tip:
      level >= 4
        ? "Aim for an early start and confirm your return seat before setting out."
        : "Keep the busiest stop for the morning and leave the afternoon flexible.",
  };
}

function differentExperience(first: Destination, next: Destination): boolean {
  return (
    first.state !== next.state ||
    first.vibes.length !== next.vibes.length ||
    first.vibes.some((vibe) => !next.vibes.includes(vibe))
  );
}

export function smartSwap(picks: PickResult[]): string | null {
  const first = picks[0];
  if (!first) return null;
  const route = first.transport.options[0];
  const badWeather = first.weather.available && first.weather.verdict !== "GO";
  if (route?.weatherSensitivity === "high" && badWeather) {
    const lowerRisk = first.transport.options.find(
      (option) =>
        option.weatherSensitivity !== "high" &&
        !(option.lateNightArrival && !option.gateway.lateNightSafe),
    );
    if (lowerRisk && first.weather.verdict !== "SKIP") {
      return `Weather could slow the ${route.modeLabel.toLowerCase()}. Try the ${lowerRisk.modeLabel.toLowerCase()} via ${lowerRisk.gateway.name}.`;
    }
  }
  if (
    first.weather.verdict === "SKIP" ||
    first.crowd.label === "Avoid" ||
    (route?.weatherSensitivity === "high" && badWeather)
  ) {
    const other = picks
      .slice(1)
      .find(
        (p) =>
          p.weather.verdict !== "SKIP" &&
          p.crowd.label !== "Avoid" &&
          !(
            p.transport.options[0]?.weatherSensitivity === "high" &&
            p.weather.available &&
            p.weather.verdict !== "GO"
          ),
      );
    if (other)
      return `Try ${other.destination.name} instead. Its estimated crowd level is ${other.crowd.label.toLowerCase()}${other.weather.available ? " and it has a more workable travel window." : ". Check the forecast before departure."}`;
    if (first.weather.verdict === "SKIP" || badWeather)
      return "Shift your departure to a clearer forecast window and check conditions again before setting out.";
    return "Try arriving Friday evening or shift to a quieter weekend. Confirm your last-mile ride first.";
  }
  return null;
}

const CUSTOM_VIBE_KEYWORDS: Record<string, string[]> = {
  photography: ["photography", "photograph", "viewpoint", "sunrise", "sunset"],
  beach: ["beach", "coast", "seaside"],
  hiking: ["hike", "hiking", "trek", "trail"],
  history: ["heritage", "history", "fort", "museum"],
  food: ["food", "cafe", "cafes", "street food"],
};
const searchable = (value: string) => value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function matchesVibe(destination: Destination, vibe: string): boolean {
  if (VIBE_TAGS.includes(vibe as Vibe)) return destination.vibes.includes(vibe as Vibe);
  const text = " " + searchable([
    destination.name, destination.bestTime, ...destination.localTips,
    ...Object.values(destination.itineraryTemplate),
    ...destination.vibes.map(tag => VIBE_NAMES[tag]),
  ].join(" ")) + " ";
  const query = searchable(vibe);
  if (!query) return false;
  if (text.includes(" " + query + " ")) return true;
  const words = query.split(" ").filter(word => word.length >= 3 && !["and", "with", "the", "for"].includes(word));
  return words.some(word => (Object.hasOwn(CUSTOM_VIBE_KEYWORDS, word) ? CUSTOM_VIBE_KEYWORDS[word] : [word]).some(term => text.includes(" " + term + " ")));
}

export function recommend(
  room: Room,
  forecasts: Record<string, WeatherResult> = {},
  destinations: Destination[] = DESTINATIONS,
): Recommendation {
  const budget = groupBudget(room);
  const votes: Record<string, number> = Object.assign(Object.create(null), Object.fromEntries(
    VIBE_TAGS.map((vibe) => [vibe, 0]),
  ));
  for (const person of room.participants)
    for (const vibe of person.vibes) {
      const key = vibe.toLowerCase();
      votes[key] = (votes[key] ?? 0) + 1;
    }
  const voteCount = Object.values(votes).reduce((sum, n) => sum + n, 0);
  const candidates: { score: number; pick: PickResult }[] = [];
  let reachable = 0;
  for (const destination of destinations) {
    if (!destination.routes[room.startCity]?.some((route) => route.available))
      continue;
    const weather = forecasts[destination.id] ?? seasonalWeather(destination);
    const crowdEstimate = crowd(destination, room, room.startCity);
    const transport = transportAdvisor(
      destination,
      room.startCity,
      room,
      room,
      weather,
      crowdEstimate,
    );
    if (!transport.options.length) continue;
    reachable++;
    const best = transport.options[0];
    const cost = costSplit(destination, room, transport.options, best.id);
    if (cost.total > budget * 1.15) continue;
    const vibeMatch = voteCount
      ? Object.entries(votes).reduce((sum, [vibe, count]) => sum + (matchesVibe(destination, vibe) ? count : 0), 0) /
        voteCount
      : 0;
    // Include the winning route's usable time in the trip-value subscore.
    const budgetFit =
      0.8 * Math.max(0, 1 - cost.total / (budget * 1.15)) + 0.2 * best.timeFit;
    const weatherScore = weather.available
      ? { GO: 1, CARRY_RAINCOAT: 0.55, SKIP: 0 }[weather.verdict]
      : 0.5;
    const crowdPenalty = (crowdEstimate.level - 1) / 4;
    const w = RECOMMEND_WEIGHTS;
    const score =
      w.vibeMatch * vibeMatch +
      w.budgetFit * budgetFit +
      w.weather * weatherScore +
      w.crowd * (1 - crowdPenalty);
    candidates.push({
      score,
      pick: {
        destination,
        match: Math.round(score * 100),
        weather,
        crowd: crowdEstimate,
        transport,
        cost,
      },
    });
  }
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.pick.cost.total - b.pick.cost.total ||
      a.pick.destination.id.localeCompare(b.pick.destination.id),
  );
  const picks = candidates.length ? [candidates[0].pick] : [];
  const second = candidates
    .slice(1)
    .find(({ pick }) =>
      differentExperience(picks[0].destination, pick.destination),
    );
  if (second) picks.push(second.pick);
  let reason: string | null = null;
  if (!reachable)
    reason = "No routes are listed from this starting city. Try another city.";
  else if (!picks.length)
    reason =
      "Every reachable trip is over the 15% budget buffer. Try a higher budget or a shorter stay.";
  else if (picks.length === 1)
    reason =
      "Only one distinct trip fits this route and budget. Try raising the budget for another option.";
  return { votes, budget, picks, reason, swap: smartSwap(picks) };
}
