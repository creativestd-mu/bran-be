import { z } from "zod";

import { ESCALATION_PRIORITIES, ESCALATION_STATUSES } from "./escalation.constants";

export const listEscalationsQuerySchema = z.object({
  status: z.enum(ESCALATION_STATUSES).optional(),
  priority: z.enum(ESCALATION_PRIORITIES).optional(),
  activeOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true"),
  search: z.string().max(200).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional()
});

export const syncEscalationsBodySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(30)
});

export const updateEscalationStatusSchema = z.object({
  status: z.enum(ESCALATION_STATUSES),
  note: z.string().max(5000).optional()
});

export const addEscalationNoteSchema = z.object({
  body: z.string().min(1).max(5000)
});
