import { Router } from "express";
import { z } from "zod";

import { param } from "../../utils/param";
import { authenticate } from "../auth/auth.middleware";
import {
  listUnsupportedSlackQueriesService,
  updateUnsupportedSlackQueryStatusService
} from "./slack-unsupported.service";

const unsupportedSlackRouter = Router();

unsupportedSlackRouter.use(authenticate);

unsupportedSlackRouter.get("/", async (req, res, next) => {
  try {
    const query = z
      .object({
        status: z.enum(["NEW", "REVIEWED", "DISMISSED"]).optional(),
        limit: z.coerce.number().int().positive().max(200).optional()
      })
      .parse(req.query);

    const rows = await listUnsupportedSlackQueriesService({
      roleName: req.user!.roleName,
      status: query.status,
      limit: query.limit
    });
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

unsupportedSlackRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const body = z
      .object({
        status: z.enum(["NEW", "REVIEWED", "DISMISSED"])
      })
      .parse(req.body);

    const row = await updateUnsupportedSlackQueryStatusService({
      roleName: req.user!.roleName,
      id: param(req.params.id),
      status: body.status
    });
    res.status(200).json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
});

export { unsupportedSlackRouter };
