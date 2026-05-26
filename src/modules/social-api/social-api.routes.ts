import { Router } from "express";
import { z } from "zod";

import { param } from "../../utils/param";
import { authenticate } from "../auth/auth.middleware";
import {
  getAccountStats,
  getRecentContent,
  getContentItemStats
} from "./social-api.service";

const socialApiRouter = Router();

socialApiRouter.use(authenticate);

const platformParam = z.enum(["youtube", "instagram"]);

socialApiRouter.get("/:platform/:accountId/stats", async (req, res, next) => {
  try {
    const platform = platformParam.parse(param(req.params.platform).toLowerCase());
    const stats = await getAccountStats(platform, param(req.params.accountId));
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

socialApiRouter.get("/:platform/:accountId/content", async (req, res, next) => {
  try {
    const platform = platformParam.parse(param(req.params.platform).toLowerCase());
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const content = await getRecentContent(platform, param(req.params.accountId), limit);
    res.status(200).json({ success: true, data: content });
  } catch (error) {
    next(error);
  }
});

socialApiRouter.get("/:platform/content/:contentId/stats", async (req, res, next) => {
  try {
    const platform = platformParam.parse(param(req.params.platform).toLowerCase());
    const item = await getContentItemStats(platform, param(req.params.contentId));
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

export { socialApiRouter };
