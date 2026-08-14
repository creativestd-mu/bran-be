import { Router } from "express";

import { authenticate } from "../auth/auth.middleware";
import {
  earnedRangeQuerySchema,
  syncEarnedBodySchema
} from "./meltwater-earned.schemas";
import {
  getEarnedAggregate,
  getEarnedDaily,
  getEarnedSearches,
  syncEarnedMentions
} from "./meltwater-earned.service";

const meltwaterEarnedRouter = Router();

meltwaterEarnedRouter.use(authenticate);

meltwaterEarnedRouter.get("/searches", async (_req, res, next) => {
  try {
    const data = await getEarnedSearches();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

meltwaterEarnedRouter.post("/sync", async (req, res, next) => {
  try {
    const payload = syncEarnedBodySchema.parse(req.body ?? {});
    const data = await syncEarnedMentions(payload);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

meltwaterEarnedRouter.get("/daily", async (req, res, next) => {
  try {
    const query = earnedRangeQuerySchema.parse(req.query);
    const data = await getEarnedDaily(query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

meltwaterEarnedRouter.get("/aggregate", async (req, res, next) => {
  try {
    const query = earnedRangeQuerySchema.parse(req.query);
    const data = await getEarnedAggregate(query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export { meltwaterEarnedRouter };
