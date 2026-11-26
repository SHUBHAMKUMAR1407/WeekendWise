import type { CrowdDay, CrowdObservation } from "../types/crowd";
import { CROWD_SCORES } from "../types/crowd";
import { addDays } from "../utils/dates";

export interface Observation {
  subject: string; date: string; crowd: CrowdObservation; updatedAt: string; checkin: boolean;
}
export function distanceKm(lat: number, lon: number, targetLat: number, targetLon: number) {
  const rad = Math.PI / 180;
  const a = Math.sin((lat - targetLat) * rad / 2) ** 2 +
    Math.cos(lat * rad) * Math.cos(targetLat * rad) * Math.sin((lon - targetLon) * rad / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function crowdDay(date: string, samples: number, total: number, checkins: number): CrowdDay {
  const level = samples >= 3 ? Math.round(total / samples * 10) / 10 : null;
  return { date, level, samples, checkins, reports: samples - checkins,
    confidence: samples < 3 ? "Insufficient" : samples < 10 ? "Limited" : "Moderate",
    label: level === null ? "Not enough reports" : level <= 2 ? "Low" : level <= 3 ? "Medium" : level <= 4 ? "High" : "Very crowded" };
}

export function summarizeObservations(observations: Observation[], today: string): CrowdDay[] {
  const unique = new Map<string, Observation>();
  for (const observation of observations) {
    if (observation.date < addDays(today, -4) || observation.date > today) continue;
    const key = observation.subject + ":" + observation.date;
    const old = unique.get(key);
    if (!old) unique.set(key, observation);
    else {
      const latest = observation.updatedAt > old.updatedAt ||
        (observation.updatedAt === old.updatedAt && observation.checkin) ? observation : old;
      unique.set(key, { ...latest, checkin: old.checkin || observation.checkin });
    }
  }
  return Array.from({ length: 5 }, (_, i) => {
    const date = addDays(today, i - 4), rows = [...unique.values()].filter((o) => o.date === date);
    return crowdDay(date, rows.length, rows.reduce((sum, o) => sum + CROWD_SCORES[o.crowd], 0), rows.filter((o) => o.checkin).length);
  });
}

export function crowdDirection(days: CrowdDay[]) {
  // Compare the two newest calendar days; never bridge missing observations.
  const previous = days[3]?.level, current = days[4]?.level;
  if (previous == null || current == null) return "Not enough data" as const;
  return current - previous >= 0.5 ? "Rising" as const : previous - current >= 0.5 ? "Falling" as const : "Similar" as const;
}
