import { z } from "zod";

export const GRIP_NAME_MIN = 2;
export const GRIP_NAME_MAX = 40;
export const GRIP_KG_MIN = 5;
export const GRIP_KG_MAX = 200;

/** One row of the grip-strength leaderboard (data/grip/entries.json). */
export const gripEntrySchema = z.object({
  /** Lowercase alnum id, generated server-side (also the photo filename stem). */
  id: z.string().regex(/^[a-z0-9]{6,24}$/, "id must be 6-24 lowercase alnum chars"),
  name: z.string().min(GRIP_NAME_MIN).max(GRIP_NAME_MAX),
  kg: z.number().min(GRIP_KG_MIN).max(GRIP_KG_MAX),
  /** Repo-relative path of the dynamometer photo, when one was uploaded. */
  photoPath: z
    .string()
    .regex(/^data\/grip\/photos\/[a-z0-9]{6,24}\.jpg$/, "photoPath must live under data/grip/photos/")
    .optional(),
  createdAt: z.string().datetime(),
  source: z.enum(["photo-ai", "manual"]),
});

export const gripEntriesSchema = z.array(gripEntrySchema);
export type GripEntry = z.infer<typeof gripEntrySchema>;

/** Request body of POST /api/grip/submit (photo is a client-resized JPEG data URL). */
export const gripSubmitSchema = z.object({
  name: z.string().min(GRIP_NAME_MIN).max(GRIP_NAME_MAX),
  kg: z.number().min(GRIP_KG_MIN).max(GRIP_KG_MAX),
  photoBase64: z
    .string()
    .startsWith("data:image/jpeg;base64,", "photo must be a JPEG data URL")
    .max(800_000, "photo is too large")
    .optional(),
});
export type GripSubmit = z.infer<typeof gripSubmitSchema>;
