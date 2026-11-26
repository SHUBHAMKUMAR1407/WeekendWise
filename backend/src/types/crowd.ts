export const CROWD_SCORES = { quiet: 1, moderate: 2, busy: 4, packed: 5 } as const;
export type CrowdObservation = keyof typeof CROWD_SCORES;
export interface CrowdDay {
  date: string;
  level: number | null;
  label: string;
  samples: number;
  reports: number;
  checkins: number;
  confidence: "Insufficient" | "Limited" | "Moderate";
}
export interface CrowdInsights {
  destinationId: string;
  updatedAt: string;
  days: CrowdDay[];
  direction: "Rising" | "Falling" | "Similar" | "Not enough data";
  planning: number;
  tripDates: { startDate: string; endDate: string };
}
