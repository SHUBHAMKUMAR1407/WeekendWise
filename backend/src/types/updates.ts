export const WEATHER_OPTIONS = {
  sunny: "Sunny", cloudy: "Cloudy", rainy: "Rainy", snowy: "Snowy", foggy: "Foggy",
} as const;
export const CROWD_OPTIONS = {
  quiet: "Quiet", moderate: "Moderate", busy: "Busy", packed: "Very crowded",
} as const;
export const EXPERIENCE_OPTIONS = {
  go: "Worth visiting", caution: "Go with some planning", skip: "Consider another day",
} as const;
export interface TravellerUpdate {
  id: string;
  destinationId: string;
  name: string;
  visitedOn: string;
  weather: keyof typeof WEATHER_OPTIONS;
  crowd: keyof typeof CROWD_OPTIONS;
  experience: keyof typeof EXPERIENCE_OPTIONS;
  note: string;
  updatedAt: string;
}
export interface TravellerUpdates {
  reports: TravellerUpdate[];
  summary: {
    count: number;
    weather: Partial<Record<TravellerUpdate["weather"], number>>;
    crowd: Partial<Record<TravellerUpdate["crowd"], number>>;
    experience: Partial<Record<TravellerUpdate["experience"], number>>;
  };
}
