import { z } from "zod";

import {
  ORG_EVENT_KINDS,
  ORG_EVENT_STATUSES
} from "./events.constants";

// MEETING is allowed only when the call has a processed transcript (see events.sources).
const ATTACHABLE_SOURCE_TYPES = [
  "GMAIL",
  "MEETING",
  "ESCALATION",
  "ATTENDANCE",
  "WORK_UNIT"
] as const;

export const listOrgEventsQuerySchema = z.object({
  status: z.enum(ORG_EVENT_STATUSES).optional(),
  kind: z.enum(ORG_EVENT_KINDS).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

export const createOrgEventSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(10_000).optional().nullable(),
  status: z.enum(ORG_EVENT_STATUSES).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable()
});

export const updateOrgEventSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(10_000).optional().nullable(),
  status: z.enum(ORG_EVENT_STATUSES).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable()
});

export const attachOrgEventSourceSchema = z.object({
  sourceType: z.enum(ATTACHABLE_SOURCE_TYPES),
  sourceId: z.string().trim().min(1).max(200)
});

export const addOrgEventNoteSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  title: z.string().trim().max(500).optional()
});

export const detectOrgEventsBodySchema = z.object({
  days: z.coerce.number().int().min(1).max(60).optional(),
  maxCandidates: z.coerce.number().int().min(10).max(200).optional()
});

export const listUnattachedSourcesQuerySchema = z.object({
  sourceType: z.enum(ATTACHABLE_SOURCE_TYPES).optional(),
  days: z.coerce.number().int().min(1).max(60).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});
