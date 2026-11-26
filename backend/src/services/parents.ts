import { formatDates } from "../utils/dates";
import type { PickResult } from "./planner";
import { costSplit } from "./transport";
import type { RankedOption } from "./transport";
import { money } from "../types/index";
import type { Room, StartCity } from "../types/index";
export type Strictness = "chill" | "moderate" | "high";
export type Worry = "solo_safety" | "budget" | "company" | "weather_crowd";
export type Language = "hinglish" | "english";
export interface ParentPackInput {
  room: Room;
  pick: PickResult;
  option: RankedOption;
  strictness: Strictness;
  worry: Worry;
  lang: Language;
}
export interface ParentPackOutput {
  message: string;
  pitch: string;
  checklist: string[];
  brief: {
    stay: string;
    checkIns: string;
    location: string;
    arrival: string;
    transport: string;
    returnPlan: string;
    conditions: string;
    emergency: string;
  };
  resistance: {
    level: number;
    label: string;
  };
}
// Each entry is a prompt to discuss a real planning decision with the family.
const prompts: Record<"english", Record<Strictness, Record<Worry, string>>> = {
  english: {
    chill: {
      solo_safety: "Can we agree on my arrival call before I book?",
      budget: "Would you like to review the costs with me over tea?",
      company: "I’ll introduce you to the people I’ll be in touch with.",
      weather_crowd: "I’ll take one last look at the forecast before leaving.",
    },
    moderate: {
      solo_safety:
        "Let’s agree on the pickup point and what to do if I miss a check-in.",
      budget: "Let’s agree on a spending cap and leave room for the ride home.",
      company:
        "Let’s choose a family contact and agree who can be called on the trip.",
      weather_crowd:
        "Let’s look at the busiest times and pick a backup date together.",
    },
    high: {
      solo_safety:
        "Let’s review the pickup, reception hours and backup contact together before I book.",
      budget:
        "I’ll show you the actual fares and stay quote. We can approve the total together.",
      company:
        "Before booking, let’s go through who knows my itinerary and how you can reach me.",
      weather_crowd:
        "If the forecast worsens or the return route looks uncertain, we can move the trip.",
    },
  },
};
const cityCoordinates: Record<StartCity, [number, number]> = {
  "Delhi NCR": [28.61, 77.21],
  Mumbai: [19.08, 72.88],
  Pune: [18.52, 73.86],
  Bengaluru: [12.97, 77.59],
  Hyderabad: [17.39, 78.49],
  Chandigarh: [30.73, 76.78],
  Kolkata: [22.57, 88.36],
  Chennai: [13.08, 80.27],
  Ahmedabad: [23.02, 72.57],
  Jaipur: [26.91, 75.79],
};
const levelLabels: Record<"english", string[]> = {
  english: [
    "Send a postcard",
    "One quick chat",
    "Share the dates",
    "Expect a follow-up",
    "Bring the budget sheet",
    "Family Q&A incoming",
    "Needs the full dossier",
    "Get the backup plan",
    "Call a family meeting",
    "Prepare for every question",
  ],
};
export function parentResistanceScore({
  room,
  pick,
  option,
  worry,
  strictness,
  lang,
}: ParentPackInput) {
  const [lat, lon] = cityCoordinates[room.startCity];
  const radians = Math.PI / 180;
  const deltaLat = (pick.destination.lat - lat) * radians;
  const deltaLon = (pick.destination.lon - lon) * radians;
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat * radians) *
      Math.cos(pick.destination.lat * radians) *
      Math.sin(deltaLon / 2) ** 2;
  const km = 12742 * Math.asin(Math.sqrt(Math.min(1, h)));
  const groupIsSolo = room.mode === "solo";
  const weatherRisk =
    pick.weather.verdict === "SKIP"
      ? 2
      : pick.weather.verdict === "CARRY_RAINCOAT"
        ? 0.6
        : 0;
  const crowdRisk = Math.max(0, pick.crowd.level - 3) * 0.5;
  const worryWeight = {
    solo_safety: groupIsSolo ? 1 : 0.3,
    budget: 0.6,
    company: groupIsSolo ? 0.8 : 0.3,
    weather_crowd: weatherRisk + crowdRisk > 0 ? 1 : 0.2,
  }[worry];
  const risk =
    { chill: 1, moderate: 2.5, high: 4 }[strictness] +
    worryWeight +
    Number(groupIsSolo) +
    Number(option.overnight) * 0.8 +
    Math.min(2, option.changes) * 0.5 +
    (option.lateNightArrival ? (option.gateway.lateNightSafe ? 0.5 : 1.5) : 0) +
    (km >= 500 ? 1 : km >= 250 ? 0.5 : 0) +
    weatherRisk +
    crowdRisk;
  const level = Math.min(10, Math.max(1, Math.round(risk)));
  return { level, label: `Level ${level}: ${levelLabels.english[level - 1]}` };
}
const lastMileLabels: Record<
  RankedOption["gateway"]["lastMile"]["options"][number],
  string
> = {
  shared_cab: "shared cab",
  taxi: "taxi",
  local_bus: "local bus",
  auto: "auto",
  app_cab: "app cab",
  walk: "walk",
};
function lateArrivalPlan({ pick, option }: ParentPackInput): string {
  if (!option.lateNightArrival || option.gateway.lateNightSafe) return "";
  const alt = pick.transport.options.find((other) => {
    const start = Number(other.typicalArrivalWindow.slice(0, 2));
    const end = Number(other.typicalArrivalWindow.slice(6, 8));
    return (
      other.id !== option.id &&
      !other.lateNightArrival &&
      start >= 7 &&
      end <= 18
    );
  });
  return alt
    ? `Late-night pickups may be limited. I’ll check the ${alt.modeLabel.toLowerCase()} arriving at ${alt.gateway.name} around ${alt.typicalArrivalWindow} instead.`
    : "Late-night pickups may be limited. I’ll choose a daytime arrival before booking.";
}
export function parentPack(input: ParentPackInput): ParentPackOutput {
  const { pick, room, option, strictness, worry } = input;

  const solo = room.mode === "solo";
  const dest = pick.destination;
  const gateway = option.gateway;
  const lm = gateway.lastMile;
  const ride = lm.options.map((m) => lastMileLabels[m]).join(" or ");
  const transport = `${option.modeLabel} · ${room.startCity} · ${option.typicalDepartureWindow} IST`;
  const arrival = `${gateway.name} (${option.typicalArrivalWindow} IST). ${gateway.distanceKmToDest} km, ${ride}, ~${lm.minutes} min, ${money(lm.costINR[0])}–${money(lm.costINR[1])}.`;
  const alternative = lateArrivalPlan(input);
  const dates = formatDates(room.startDate, room.endDate);
  const cost = costSplit(dest, room, pick.transport.options, option.id);
  const amount = `${money(cost.range[0])}–${money(cost.range[1])}`;
  const weather = pick.weather.available
    ? {
        GO: "mostly dry",
        CARRY_RAINCOAT: "pack a rain layer",
        SKIP: "shift dates",
      }[pick.weather.verdict]
    : "forecast unavailable";
  const conditions = `Weather: ${weather}. Estimated crowd level: ${pick.crowd.label}.`;
  const company = solo ? "a solo trip" : room.mode === "family" ? "a trip with family" : "a trip with friends";
  const prompt = prompts.english[strictness][worry];
  const returnPlan = pick.transport.returnPlan;
  const brief = {
    stay: "Planned hostel or guesthouse. Check reception hours and recent guest reviews before booking.",
    checkIns: "Morning, on arrival, evening and before sleep.",
    location:
      "Share WhatsApp live location with family during transfers. Use Google Maps sharing as backup.",
    transport,
    arrival: alternative ? arrival + " " + alternative : arrival,
    returnPlan,
    conditions,
    emergency: "Family contact: ______   Stay reception: ______",
  };
  const message = [
    `I’m planning ${company} to ${dest.name} (${dates}). ${prompt}`,
    `Travel plan: ${transport}. Arrival and onward ride: ${brief.arrival}`,
    `Estimated cost per person: ${amount}. ${conditions}`,
    `I’ll check in: ${brief.checkIns} ${brief.location}`,
    returnPlan,
  ].join("\n\n");
  const lastMilePitch =
    alternative || "I’ll confirm the pickup before leaving.";
  const pitch = `I’m planning ${company} to ${dest.name} on ${dates}. The ${option.modeLabel.toLowerCase()} leaves around ${option.typicalDepartureWindow}. From ${gateway.name}, it’s about ${lm.minutes} minutes by ${ride}. ${lastMilePitch} My estimate is ${amount} each. I’ll send the ticket, check in on arrival and confirm the return ride. ${prompt}`;
  const checklist = [
    "Share your ticket and arrival time with a family member.",
    "Confirm reception hours, the stay address and the last-mile pickup.",
    "Save the stay reception and family contact numbers offline.",
    "Agree on check-in times and what to do if a call is missed.",
    "Charge your phone and test live-location sharing before departure.",
    "Recheck weather, return timings and your backup fare.",
  ];
  return {
    message,
    pitch,
    brief,
    checklist,
    resistance: parentResistanceScore(input),
  };
}
