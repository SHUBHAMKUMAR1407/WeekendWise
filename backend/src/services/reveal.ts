import { unstable_cache } from "next/cache";
import { recommend, DESTINATIONS } from "./planner";
import { weather } from "./weather";
import { ApiError, getRoom } from "../db/redis";
import type { Room } from "../types/index";
const cached = unstable_cache(
  async (
    planning: Pick<
      Room,
      "startCity" | "startDate" | "endDate" | "maxBudgetPerPerson" | "mode"
    >,
    votes: {
      vibes: Room["participants"][number]["vibes"];
      comfortBudget: number;
    }[],
  ) => {
    const room: Room = {
      ...planning,
      id: "",
      createdAt: "",
      participants: votes.map((v, i) => ({
        ...v,
        id: String(i),
        name: "",
        joinedAt: "",
      })),
    };
    const reachable = DESTINATIONS.filter((d) =>
      d.routes[room.startCity]?.some((o) => o.available),
    );
    const forecasts = await Promise.all(
      reachable.map(async (d) => [d.id, await weather(d, room)] as const),
    );
    return recommend(room, Object.fromEntries(forecasts), reachable);
  },
  ["weekendwise-reveal-custom-vibes-v2"],
  { revalidate: 10800 },
);
export function report(room: Room) {
  const { startCity, startDate, endDate, maxBudgetPerPerson, mode } = room;
  return cached(
    { startCity, startDate, endDate, maxBudgetPerPerson, mode },
    room.participants.map(({ vibes, comfortBudget }) => ({
      vibes,
      comfortBudget,
    })),
  );
}
export async function requireRoom(id: string) {
  const room = await getRoom(id);
  if (!room) throw new ApiError(404, "This room expired. Make a new one.");
  return room;
}
export async function chosen(room: Room, dest?: string, option?: string) {
  const result = await report(room);
  const pick = dest
    ? result.picks.find((p) => p.destination.id === dest)
    : result.picks[0];
  if (!pick) return null;
  const route = option
    ? pick.transport.options.find((o) => o.id === option)
    : pick.transport.options[0];
  return route ? { pick, option: route } : null;
}
