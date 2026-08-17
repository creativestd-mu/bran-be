import { z } from "zod";

export const transcriptionKeywordCreateSchema = z.object({
  phrase: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(500).optional().nullable()
});

export const transcriptionKeywordUpdateSchema = z.object({
  phrase: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional()
});

export const transcriptionKeywordListQuerySchema = z.object({
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true"))
});
