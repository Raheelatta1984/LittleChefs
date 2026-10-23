import { z } from "zod";
import { ROLE_ORDER, MEAL_OCCASIONS } from "../../shared/types.js";
import { ApiError } from "./errors.js";

const imageUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => value === "" || /^(https?:\/\/|\/uploads\/|data:image\/)/i.test(value), {
    message: "Images must be an http(s) link or an uploaded image.",
  })
  .nullable()
  .optional();

export const ingredientSchema = z.object({
  position: z.number().int().min(0).optional(),
  quantity: z.number().finite().nullable().optional(),
  unit: z.string().max(40).nullable().optional(),
  item: z.string().trim().min(1).max(160),
  prepNote: z.string().max(200).nullable().optional(),
  groupName: z.string().max(80).nullable().optional(),
  scalable: z.boolean().optional(),
  rawText: z.string().max(400).nullable().optional(),
});

export const stepSchema = z.object({
  position: z.number().int().min(0).optional(),
  instruction: z.string().trim().min(1).max(2000),
  durationSeconds: z.number().int().min(0).max(86_400).nullable().optional(),
  temperatureC: z.number().int().min(-50).max(500).nullable().optional(),
  imageUrl,
  tip: z.string().max(400).nullable().optional(),
});

export const draftSchema = z.object({
  title: z.string().trim().min(1).max(140),
  cuisine: z.string().max(80).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  difficulty: z.string().max(40).nullable().optional(),
  baseServings: z.number().int().min(1).max(100),
  totalMinutes: z.number().int().min(1).max(2880).nullable().optional(),
  heroImageUrl: imageUrl,
  sourceType: z.enum(["builtin", "web", "youtube", "manual", "ai"]).optional(),
  sourceUrl: z.string().max(2048).nullable().optional(),
  sourceVideoId: z.string().max(40).nullable().optional(),
  sourceChannel: z.string().max(120).nullable().optional(),
  sourceAuthor: z.string().max(120).nullable().optional(),
  ingredients: z.array(ingredientSchema).max(80).default([]),
  steps: z.array(stepSchema).max(60).default([]),
});

export const createChefSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  role: z.enum(ROLE_ORDER as [string, ...string[]]),
  avatar: z.string().max(120).nullable().optional(),
  pin: z.string().regex(/^\d{4}$/).nullish(),
});

export const signInSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  role: z.enum(ROLE_ORDER as [string, ...string[]]),
  pin: z.string().regex(/^\d{4}$/).nullish(),
});

export const onboardingSchema = z.object({
  servings: z.number().int().min(1).max(100),
  mealOccasion: z.enum(MEAL_OCCASIONS.map((m) => m.id) as [string, ...string[]]),
  dietary: z.array(z.string().max(40)).max(10).optional(),
  pantry: z.array(z.string().max(80)).max(60).optional(),
});

export const importSchema = z.object({
  inputValue: z.string().trim().min(2).max(20_000),
  inputType: z.enum(["url", "youtube", "text", "dish"]).optional(),
});

export const confirmImportSchema = z.object({
  draft: draftSchema.optional(),
  notes: z.string().max(2000).nullable().optional(),
  share: z.boolean().optional(),
});

export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new ApiError(
      400,
      "validation_error",
      first?.message ?? "Invalid request.",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return result.data;
}
