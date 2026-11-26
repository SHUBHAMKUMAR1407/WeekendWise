import { z } from "zod";
import records from "../../data/destinations.json";
import { addDays, todayIST } from "../utils/dates";

export const destinationId = z.string().max(64).refine(
  (id) => records.some((d) => d.id === id), "Choose a supported destination.",
);
const text = (max: number) => z.string().max(max * 3).transform((s) =>
  s.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ").trim(),
).pipe(z.string().max(max));
export const updateSchema = z.object({
  anonId: z.string().uuid(),
  name: text(40).default(""),
  visitedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((day) => {
    const date = new Date(day + "T12:00:00Z");
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day &&
      day >= addDays(todayIST(), -6) && day <= todayIST();
  }, "Share a visit from the last seven days, including today."),
  weather: z.enum(["sunny", "cloudy", "rainy", "snowy", "foggy"]),
  crowd: z.enum(["quiet", "moderate", "busy", "packed"]),
  experience: z.enum(["go", "caution", "skip"]),
  note: text(280).default(""),
  visited: z.literal(true),
}).strict();
export type UpdateInput = z.infer<typeof updateSchema>;
