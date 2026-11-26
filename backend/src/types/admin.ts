import type { Room, Participant } from "./index";
import type { TravellerUpdate } from "./updates";
export interface AdminTrip {
  id: string; createdAt: string; expiresAt: string; startDate: string; endDate: string;
  startCity: Room["startCity"]; mode: Room["mode"]; maxBudgetPerPerson: number;
  participantCount: number; revealed: boolean;
  matches: Pick<Participant, "name" | "vibes" | "comfortBudget" | "joinedAt">[];
  hostName?: string;
}
export interface AdminSearchResult {
  name: string; match: "exact" | "contains"; page: number; pageSize: number;
  trips: AdminTrip[];
  reports: TravellerUpdate[];
  tripCount: number; reportCount: number; hasMore: boolean;
}
