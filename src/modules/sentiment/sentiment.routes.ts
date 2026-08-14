import { Router } from "express";

import { authenticate } from "../auth/auth.middleware";
import { sentimentRangeQuerySchema, sentimentSyncBodySchema } from "./sentiment.schemas";
import {
  getSentimentDashboard,
  listSentimentSearches,
  syncSentimentData
} from "./sentiment.service";

const sentimentRouter = Router();

sentimentRouter.use(authenticate);

sentimentRouter.get("/", async (req, res, next) => {
  try {
    const query = sentimentRangeQuerySchema.parse(req.query);
    const data = await getSentimentDashboard(query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

sentimentRouter.get("/daily", async (req, res, next) => {
  try {
    const query = sentimentRangeQuerySchema.parse(req.query);
    const data = await getSentimentDashboard(query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

sentimentRouter.get("/aggregate", async (req, res, next) => {
  try {
    const query = sentimentRangeQuerySchema.parse(req.query);
    const dashboard = await getSentimentDashboard(query);
    res.status(200).json({
      success: true,
      data: {
        timezone: dashboard.timezone,
        range: dashboard.range,
        ...dashboard.totals
      }
    });
  } catch (error) {
    next(error);
  }
});

sentimentRouter.get("/searches", async (_req, res, next) => {
  try {
    const data = await listSentimentSearches();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

sentimentRouter.post("/sync", async (req, res, next) => {
  try {
    const payload = sentimentSyncBodySchema.parse(req.body ?? {});
    const data = await syncSentimentData(payload);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export { sentimentRouter };
