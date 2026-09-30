import { z } from "zod";

export const createIdeaSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().min(1).max(8000),
  tags: z.array(z.string().trim().min(1).max(100)).max(20).optional()
});

export const updateIdeaSchema = createIdeaSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one idea field must be provided"
  });

export const listIdeasQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional()
});

export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;
export type UpdateIdeaInput = z.infer<typeof updateIdeaSchema>;
