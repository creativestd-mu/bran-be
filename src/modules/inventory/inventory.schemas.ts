import { z } from "zod";

import { INVENTORY_ITEM_STATUSES } from "./inventory.constants";

export const createInventoryItemSchema = z.object({
  name: z.string().trim().min(1).max(500),
  description: z.string().trim().max(8000).optional(),
  category: z.string().trim().max(200).optional(),
  serialNumber: z.string().trim().max(200).optional(),
  status: z.enum(INVENTORY_ITEM_STATUSES).optional(),
  isActive: z.boolean().optional(),
  teamIds: z.array(z.string().uuid()).optional(),
  primaryTeamId: z.string().uuid().optional()
});

export const updateInventoryItemSchema = z.object({
  name: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(8000).nullable().optional(),
  category: z.string().trim().max(200).nullable().optional(),
  serialNumber: z.string().trim().max(200).nullable().optional(),
  status: z.enum(INVENTORY_ITEM_STATUSES).optional(),
  isActive: z.boolean().optional(),
  teamIds: z.array(z.string().uuid()).optional(),
  primaryTeamId: z.string().uuid().nullable().optional()
});

export const assignTeamsSchema = z.object({
  teamIds: z.array(z.string().uuid()).min(1),
  primaryTeamId: z.string().uuid().optional()
});

export const listInventoryQuerySchema = z.object({
  teamId: z.string().uuid().optional(),
  category: z.string().trim().optional(),
  status: z.enum(INVENTORY_ITEM_STATUSES).optional(),
  isActive: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  availableOn: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional()
});

export const listReservationsQuerySchema = z.object({
  inventoryItemId: z.string().uuid().optional(),
  contentNodeId: z.string().uuid().optional(),
  status: z.enum(["ACTIVE", "RETURNED", "OVERDUE", "CANCELLED"]).optional(),
  overdueOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional()
});

export const returnReservationSchema = z.object({
  notes: z.string().trim().max(2000).optional()
});
