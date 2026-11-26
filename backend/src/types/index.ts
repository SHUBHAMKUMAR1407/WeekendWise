export const BUILDER_NAME = "Shubham Kumar";
export const FOOTER = `Built by ${BUILDER_NAME} for the goSTOPS Build Sprint. Not an official goSTOPS product.`;
export const PRIVACY =
  "We store only your name and trip choices for 30 days. No login, no tracking.";
export const START_CITIES = [
  "Delhi NCR",
  "Mumbai",
  "Pune",
  "Bengaluru",
  "Hyderabad",
  "Chandigarh",
  "Kolkata",
  "Chennai",
  "Ahmedabad",
  "Jaipur",
] as const;
export const VIBE_TAGS = [
  "peace_cafes",
  "party_bonfire",
  "trek_adventure",
  "workation",
  "heritage_streets",
] as const;
export type StartCity = (typeof START_CITIES)[number];
export type Vibe = (typeof VIBE_TAGS)[number];
export const MAX_VIBES = 10;
export const VIBE_NAMES: Record<Vibe, string> = {
  peace_cafes: "Peace & cafés",
  party_bonfire: "Party & bonfire",
  trek_adventure: "Trek & adventure",
  workation: "Workation",
  heritage_streets: "Heritage streets",
};
export type Range = [number, number];
export interface DateRange {
  startDate: string;
  endDate: string;
}
export interface Participant {
  id: string;
  name: string;
  vibes: string[];
  comfortBudget: number;
  joinedAt: string;
}
export interface Room extends DateRange {
  id: string;
  createdAt: string;
  hostName?: string;
  revealed?: boolean;
  mode: "solo" | "group" | "family";
  startCity: StartCity;
  maxBudgetPerPerson: number;
  participants: Participant[];
}
export type TransportMode =
  "bus_volvo" | "bus_sleeper" | "train" | "flight" | "cab_self_drive";
export interface Gateway {
  id: string;
  type: "bus" | "train" | "airport";
  name: string;
  code?: string;
  distanceKmToDest: number;
  lastMile: {
    options: (
      "shared_cab" | "taxi" | "local_bus" | "auto" | "app_cab" | "walk"
    )[];
    costINR: Range;
    minutes: number;
    note?: string;
  };
  lateNightSafe: boolean;
}
export interface TransportOption {
  mode: TransportMode;
  gatewayId: string;
  hoursOnVehicle: number;
  typicalDepartureWindow: string;
  typicalArrivalWindow: string;
  costRoundTripINR: Range;
  overnight: boolean;
  changes: number;
  bookingHint: string;
  weatherSensitivity: "low" | "medium" | "high";
  available: boolean;
}
export interface Destination {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  vibes: Vibe[];
  gateways: Gateway[];
  routes: Partial<Record<StartCity, TransportOption[]>>;
  nearestRailhead: string;
  nearestAirport: string;
  costPerDay: { stay: Range; food: Range; local: Range };
  crowdByMonth: number[];
  monsoonRisk: number[];
  crowdNotes: string[];
  weekendCities: StartCity[];
  bestTime: string;
  localTips: string[];
  itineraryTemplate: { fridayNight: string; saturday: string; sunday: string };
  hasGoSTOPS: boolean;
  confidence: "estimated";
  lastVerified: string | null;
}
export const EVENTS = [
  "page_view",
  "room_created",
  "link_shared",
  "vote_submitted",
  "reveal_viewed",
  "trip_check_run",
  "parent_pack_generated",
  "card_generated",
  "card_shared",
  "gostops_clicked",
  "transport_option_selected",
  "maps_link_clicked",
  "booking_link_clicked",
] as const;
export type EventName = (typeof EVENTS)[number];
export interface Event {
  name: EventName;
  anonId: string;
  roomId?: string;
  ts: number;
  meta?: Record<string, string>;
}
export const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
