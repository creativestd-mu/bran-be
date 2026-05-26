import { Router } from "express";
import { z } from "zod";

import { HttpError } from "../../utils/httpError";
import {
  aggregateInstagramPerformanceData,
  getInstagramPerformanceRecords,
  syncInstagramPerformanceData
} from "./instagram.service";

const syncBodySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  keyword: z.string().min(1).optional()
});

const rangeQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional()
});

const instagramRouter = Router();

instagramRouter.post("/sync", async (req, res) => {
  const language = req.language;
  if (!language) {
    throw new HttpError(400, "Language not provided");
  }

  const payload = syncBodySchema.parse(req.body ?? {});
  const result = await syncInstagramPerformanceData({
    language,
    from: payload.from,
    to: payload.to,
    keyword: payload.keyword
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

instagramRouter.get("/aggregate", async (req, res) => {
  const language = req.language;
  if (!language) {
    throw new HttpError(400, "Language not provided");
  }

  const query = rangeQuerySchema.parse(req.query);
  const result = await aggregateInstagramPerformanceData({
    language,
    from: query.from,
    to: query.to
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

instagramRouter.get("/records", async (req, res) => {
  const language = req.language;
  if (!language) {
    throw new HttpError(400, "Language not provided");
  }

  const query = rangeQuerySchema.parse(req.query);
  const records = await getInstagramPerformanceRecords({
    language,
    from: query.from,
    to: query.to,
    page: query.page,
    pageSize: query.pageSize
  });

  res.status(200).json({
    success: true,
    data: records
  });
});

export { instagramRouter };
