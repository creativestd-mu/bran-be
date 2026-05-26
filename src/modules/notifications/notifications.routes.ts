import { Router } from "express";
import { z } from "zod";

import { param } from "../../utils/param";
import { authenticate } from "../auth/auth.middleware";
import {
  getMyUnreadCount,
  listMyNotifications,
  markAllRead,
  markRead
} from "./notifications.service";

const notificationsRouter = Router();

notificationsRouter.use(authenticate);

const listQuerySchema = z.object({
  unreadOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true"),
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional()
});

notificationsRouter.get("/", async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await listMyNotifications({
      userId: req.user!.userId,
      unreadOnly: query.unreadOnly,
      take: query.take,
      skip: query.skip
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.get("/unread-count", async (req, res, next) => {
  try {
    const count = await getMyUnreadCount(req.user!.userId);
    res.status(200).json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch("/:id/read", async (req, res, next) => {
  try {
    const result = await markRead(param(req.params.id), req.user!.userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post("/read-all", async (req, res, next) => {
  try {
    const result = await markAllRead(req.user!.userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export { notificationsRouter };
