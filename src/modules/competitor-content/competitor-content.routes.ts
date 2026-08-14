import { Router } from "express";

import { authenticate } from "../auth/auth.middleware";
import {
  competitorContentQuerySchema,
  syncCompetitorContentBodySchema
} from "./competitor-content.schemas";
import {
  getCompetitorContentImpact,
  syncCompetitorContent
} from "./competitor-content.service";

const competitorContentRouter = Router();

competitorContentRouter.use(authenticate);

competitorContentRouter.get("/", async (req, res, next) => {
  try {
    const query = competitorContentQuerySchema.parse(req.query);
    const data = await getCompetitorContentImpact(query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

competitorContentRouter.post("/sync", async (req, res, next) => {
  try {
    const payload = syncCompetitorContentBodySchema.parse(req.body ?? {});
    const data = await syncCompetitorContent(payload);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export { competitorContentRouter };
