import { z } from "zod";

import { MAX_NAV_PATH_LENGTH, MAX_NAV_QUERY_LENGTH } from "./navigation.constants";

const navPathSchema = z
  .string()
  .trim()
  .min(1, "path is required")
  .max(MAX_NAV_PATH_LENGTH)
  .refine((value) => value.startsWith("/"), "path must start with /");

export const logNavSearchSchema = z.object({
  query: z.string().trim().min(1, "query is required").max(MAX_NAV_QUERY_LENGTH),
  selectedPath: navPathSchema.optional()
});

export const recordPageVisitSchema = z.object({
  path: navPathSchema
});
