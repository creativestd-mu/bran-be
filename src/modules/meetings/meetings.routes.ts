import { Router } from "express";

import { authenticate } from "../auth/auth.middleware";
import { joinMeetingSchema, listMeetingsQuerySchema } from "./meetings.schemas";
import {
  disconnectCalendar,
  getCalendarStatus,
  joinMeetingManually,
  listMeetings,
  startCalendarConnect
} from "./meetings.service";

const meetingsRouter = Router();

meetingsRouter.use(authenticate);

meetingsRouter.post("/calendar/connect", async (req, res, next) => {
  try {
    const result = await startCalendarConnect(req.user!.userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

meetingsRouter.get("/calendar/status", async (req, res, next) => {
  try {
    const result = await getCalendarStatus(req.user!.userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

meetingsRouter.delete("/calendar", async (req, res, next) => {
  try {
    const result = await disconnectCalendar(req.user!.userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

meetingsRouter.get("/", async (req, res, next) => {
  try {
    const query = listMeetingsQuerySchema.parse(req.query);
    const result = await listMeetings(req.user!.userId, query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

meetingsRouter.post("/join", async (req, res, next) => {
  try {
    const payload = joinMeetingSchema.parse(req.body);
    const result = await joinMeetingManually(req.user!.userId, payload);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export { meetingsRouter };
