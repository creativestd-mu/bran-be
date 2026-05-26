import { Router } from "express";
import { z } from "zod";

import { param } from "../../utils/param";
import { requirePermission } from "../auth/auth.guard";
import { authenticate } from "../auth/auth.middleware";
import {
  changeVerticalOwner,
  getVertical,
  listAllVerticals,
  updateVerticalDetails
} from "./verticals.service";

const verticalsRouter = Router();

verticalsRouter.use(authenticate);

verticalsRouter.get("/", async (_req, res, next) => {
  try {
    const verticals = await listAllVerticals();
    res.status(200).json({ success: true, data: verticals });
  } catch (error) {
    next(error);
  }
});

verticalsRouter.get("/:id", async (req, res, next) => {
  try {
    const vertical = await getVertical(param(req.params.id));
    res.status(200).json({ success: true, data: vertical });
  } catch (error) {
    next(error);
  }
});

const updateVerticalSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional()
});

verticalsRouter.put(
  "/:id",
  requirePermission("manage_verticals"),
  async (req, res, next) => {
    try {
      const payload = updateVerticalSchema.parse(req.body);
      const vertical = await updateVerticalDetails(param(req.params.id), payload);
      res.status(200).json({ success: true, data: vertical });
    } catch (error) {
      next(error);
    }
  }
);

const changeOwnerSchema = z.object({
  ownerUserId: z.string().uuid()
});

// Reassigning the owner of a vertical is restricted to users with
// `manage_verticals` permission (granted only to the superadmin role).
verticalsRouter.put(
  "/:id/owner",
  requirePermission("manage_verticals"),
  async (req, res, next) => {
    try {
      const { ownerUserId } = changeOwnerSchema.parse(req.body);
      const vertical = await changeVerticalOwner(param(req.params.id), ownerUserId);
      res.status(200).json({ success: true, data: vertical });
    } catch (error) {
      next(error);
    }
  }
);

export { verticalsRouter };
