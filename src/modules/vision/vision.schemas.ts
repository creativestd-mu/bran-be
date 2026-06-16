import { z } from "zod";

import {
  MAX_VISION_DURATION_MONTHS,
  MIN_VISION_DURATION_MONTHS,
  VISION_HORIZONS,
  VISION_SCOPES
} from "./vision.constants";

function parseUuidArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
}

const uuidArraySchema = z
  .preprocess(parseUuidArray, z.array(z.string().uuid()))
  .optional()
  .default([]);

const uuidArrayOptionalSchema = z.preprocess(parseUuidArray, z.array(z.string().uuid())).optional();

const visionFieldsSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(8000).optional(),
  horizon: z.enum(VISION_HORIZONS),
  durationMonths: z.coerce
    .number()
    .int()
    .min(MIN_VISION_DURATION_MONTHS)
    .max(MAX_VISION_DURATION_MONTHS),
  startsAt: z.string().datetime().optional(),
  scope: z.enum(VISION_SCOPES),
  teamIds: uuidArraySchema,
  userIds: uuidArraySchema
});

function validateScopeInvolvement(
  data: { scope: string; teamIds: string[]; userIds: string[] },
  ctx: z.RefinementCtx
) {
  if (data.scope === "ALL") return;
  if (data.teamIds.length === 0 && data.userIds.length === 0) {
    ctx.addIssue({
      code: "custom",
      message: "At least one team or user is required when scope is SPECIFIC",
      path: ["teamIds"]
    });
  }
}

export const createVisionBodySchema = visionFieldsSchema.superRefine(validateScopeInvolvement);

export const updateVisionBodySchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(8000).nullable().optional(),
    horizon: z.enum(VISION_HORIZONS).optional(),
    durationMonths: z.coerce
      .number()
      .int()
      .min(MIN_VISION_DURATION_MONTHS)
      .max(MAX_VISION_DURATION_MONTHS)
      .optional(),
    startsAt: z.string().datetime().optional(),
    scope: z.enum(VISION_SCOPES).optional(),
    teamIds: uuidArrayOptionalSchema,
    userIds: uuidArrayOptionalSchema
  })
  .superRefine((data, ctx) => {
    if (data.scope === undefined) return;
    validateScopeInvolvement(
      {
        scope: data.scope,
        teamIds: data.teamIds ?? [],
        userIds: data.userIds ?? []
      },
      ctx
    );
  });

export const listVisionsQuerySchema = z.object({
  horizon: z.enum(VISION_HORIZONS).optional(),
  scope: z.enum(VISION_SCOPES).optional(),
  teamId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional()
});
