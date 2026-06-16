import { z } from "zod";

export const generateThumbnailBodySchema = z.object({
  title: z.string().trim().min(1, "title is required").max(500),
  description: z.string().trim().min(1, "description is required").max(8000),
  context: z.string().trim().max(8000).optional()
});

export const listThumbnailGenerationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional()
});

export const thumbnailAssetSchema = z.object({
  name: z.string(),
  type: z.enum([
    "photo",
    "illustration",
    "icon",
    "logo",
    "text",
    "background",
    "overlay",
    "other"
  ]),
  description: z.string(),
  placement: z.string().optional(),
  sourcingNotes: z.string().optional()
});

export const thumbnailAiOutputSchema = z.object({
  title: z.string(),
  textDescription: z.string(),
  context: z.string(),
  assets: z.array(thumbnailAssetSchema),
  designBrief: z.string(),
  styleFromReferences: z.string()
});
