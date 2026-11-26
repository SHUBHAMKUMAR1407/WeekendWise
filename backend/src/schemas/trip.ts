import { z } from "zod";
import { EVENTS, START_CITIES, MAX_VIBES } from "../types/index";
import { todayIST, daysBetween } from "../utils/dates";
export const roomId = z.string().regex(/^[\w-]{10}$/);
export const fullName = z
  .string()
  .max(128)
  .transform((s) =>
    s
      .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "")
      .trim(),
  )
  .pipe(z.string().min(1).max(80));
const budget = z.number().int().positive().safe();
const vibes = z
  .array(z.string().max(120).transform(value => value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim().replace(/\s+/g, " ")).pipe(z.string().min(1).max(40)))
  .min(1, "Choose at least one vibe.")
  .max(MAX_VIBES)
  .refine(v => new Set(v.map(value => value.toLowerCase())).size === v.length, "Choose different vibes.");
const iso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const t = Date.parse(s + "T12:00:00Z");
    return Number.isFinite(t) && new Date(t).toISOString().startsWith(s);
  });
const identity = {
  anonId: z.string().uuid(),
  internal: z.boolean().optional(),
  source: z
    .string()
    .regex(/^[a-zA-Z0-9._-]{1,64}$/)
    .optional(),
};
export const joinSchema = z
  .object({ ...identity, name: fullName, vibes, comfortBudget: budget })
  .strict();
export const createSchema = z
  .object({
    ...identity,
    mode: z.enum(["solo", "group"]),
    startCity: z.enum(START_CITIES),
    startDate: iso,
    endDate: iso,
    maxBudgetPerPerson: budget,
    solo: z.object({ name: fullName, vibes }).strict().optional(),
  })
  .strict()
  .refine((v) => (v.mode === "solo" ? !!v.solo : !v.solo))
  .refine(
    (v) =>
      v.startDate >= todayIST() &&
      daysBetween(v.startDate, v.endDate) >= 0 &&
      daysBetween(v.startDate, v.endDate) <= 6,
    "Choose a trip of one to seven days starting today or later.",
  );
export const eventSchema = z
  .object({
    ...identity,
    name: z.enum(EVENTS),
    ts: z.number().int().nonnegative().safe().optional(),
    roomId: roomId.optional(),
    meta: z
      .object({
        destination: z
          .string()
          .regex(/^[a-zA-Z0-9 -]{1,64}$/)
          .optional(),
        mode: z
          .enum([
            "bus_volvo",
            "bus_sleeper",
            "train",
            "flight",
            "cab_self_drive",
          ])
          .optional(),
        kind: z.enum(["trip", "parent"]).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const cardQuery = z
  .object({
    dest: z
      .string()
      .regex(/^[\w-]{1,64}$/)
      .optional(),
    option: z.string().max(140).optional(),
    strictness: z.enum(["chill", "moderate", "high"]).default("moderate"),
    worry: z
      .enum(["solo_safety", "budget", "company", "weather_crowd"])
      .default("solo_safety"),
    lang: z.enum(["hinglish", "english"]).default("english").transform(() => "english" as const),
  })
  .strict();
