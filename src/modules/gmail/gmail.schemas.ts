import { z } from "zod";

export const listGmailMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().trim().max(500).optional()
});
