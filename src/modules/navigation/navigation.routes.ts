import { Router } from "express";

import { authenticate } from "../auth/auth.middleware";
import { logNavSearchSchema, recordPageVisitSchema } from "./navigation.schemas";
import { getMostVisitedPages, logNavSearch, recordPageVisit } from "./navigation.service";

const navigationRouter = Router();

navigationRouter.use(authenticate);

navigationRouter.post("/search-logs", async (req, res, next) => {
  try {
    const payload = logNavSearchSchema.parse(req.body);
    const entry = await logNavSearch(req.user!.userId, payload);
    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    next(error);
  }
});

navigationRouter.post("/page-visits", async (req, res, next) => {
  try {
    const { path } = recordPageVisitSchema.parse(req.body);
    const visit = await recordPageVisit(req.user!.userId, path);
    res.status(200).json({ success: true, data: visit });
  } catch (error) {
    next(error);
  }
});

navigationRouter.get("/page-visits", async (req, res, next) => {
  try {
    const pages = await getMostVisitedPages(req.user!.userId);
    res.status(200).json({ success: true, data: pages });
  } catch (error) {
    next(error);
  }
});

export { navigationRouter };
