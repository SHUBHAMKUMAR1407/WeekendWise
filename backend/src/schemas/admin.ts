import { z } from "zod";
export const adminLogin = z.object({ key: z.string().min(1).max(512) }).strict();
export const adminSearch = z.object({
  name: z.string().max(240).transform((name) => name.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim())
    .pipe(z.string().min(2).max(80)),
  match: z.enum(["contains", "exact"]).default("contains"),
  page: z.number().int().min(1).max(5000).default(1),
}).strict();
export type AdminSearchInput = z.infer<typeof adminSearch>;
