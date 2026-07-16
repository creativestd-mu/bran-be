import { Router } from "express";

import { param } from "../../utils/param";
import {
  addEscalationNoteSchema,
  listEscalationsQuerySchema,
  syncEscalationsBodySchema,
  updateEscalationStatusSchema
} from "./escalation.schemas";
import {
  addEscalationNote,
  analyzeEscalationById,
  getEscalationDetail,
  listEscalationTracker,
  setEscalationStatus,
  syncEscalationsFromSlack
} from "./escalation.service";

const escalationRouter = Router();

/** GET /escalations — tracker list with latest context + status */
escalationRouter.get("/", async (req, res, next) => {
  try {
    const query = listEscalationsQuerySchema.parse(req.query);
    const data = await listEscalationTracker(query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** POST /escalations/sync — backfill from Slack escalation group/channel */
escalationRouter.post("/sync", async (req, res, next) => {
  try {
    const body = syncEscalationsBodySchema.parse(req.body ?? {});
    const data = await syncEscalationsFromSlack(body.days);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** POST /escalations/:id/analyze — re-run LLM analysis for summary */
escalationRouter.post("/:id/analyze", async (req, res, next) => {
  try {
    const data = await analyzeEscalationById(param(req.params.id));
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** GET /escalations/:id — full timeline + where it stands */
escalationRouter.get("/:id", async (req, res, next) => {
  try {
    const data = await getEscalationDetail(param(req.params.id));
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** PATCH /escalations/:id/status — manual status update */
escalationRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const body = updateEscalationStatusSchema.parse(req.body);
    const data = await setEscalationStatus({
      id: param(req.params.id),
      status: body.status,
      note: body.note,
      actorName: req.user?.email ?? null
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** POST /escalations/:id/notes — manual admin update */
escalationRouter.post("/:id/notes", async (req, res, next) => {
  try {
    const body = addEscalationNoteSchema.parse(req.body);
    const data = await addEscalationNote({
      id: param(req.params.id),
      body: body.body,
      actorName: req.user?.email ?? null
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export { escalationRouter };
