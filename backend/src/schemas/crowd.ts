import { z } from "zod";
import { addDays, daysBetween, todayIST } from "../utils/dates";

export const crowdDates = z.object({
  startDate: z.string().date(), endDate: z.string().date(),
}).strict().refine((v) => v.startDate >= todayIST() && v.endDate <= addDays(todayIST(), 365) &&
  daysBetween(v.startDate, v.endDate) >= 0 && daysBetween(v.startDate, v.endDate) <= 6,
"Choose a future trip of one to seven days within the next year.");

export const crowdSignal = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("checkin"), anonId: z.string().uuid(), consent: z.literal(true),
    crowd: z.enum(["quiet", "moderate", "busy", "packed"]),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    accuracy: z.number().finite().positive().max(2000),
    timestamp: z.number().finite().refine((v) => v >= Date.now() - 300000 && v <= Date.now() + 60000,
      "Request a fresh location and try again."),
  }).strict(),
  z.object({
    kind: z.literal("interest"), anonId: z.string().uuid(), interested: z.boolean(),
    startDate: z.string().date(), endDate: z.string().date(),
  }).strict(),
]).superRefine((v, ctx) => {
  if (v.kind === "interest" && !crowdDates.safeParse({ startDate: v.startDate, endDate: v.endDate }).success)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Choose valid trip dates." });
});
export type CrowdSignalInput = z.infer<typeof crowdSignal>;
