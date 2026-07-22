import { Router } from "express";

import { authenticate } from "../auth/auth.middleware";
import { param } from "../../utils/param";
import {
  addOrgEventNoteSchema,
  attachOrgEventSourceSchema,
  createOrgEventSchema,
  detectOrgEventsBodySchema,
  listOrgEventsQuerySchema,
  listUnattachedSourcesQuerySchema,
  updateOrgEventSchema
} from "./events.schemas";
import {
  addEventNote,
  attachSourceToEvent,
  createManualEvent,
  detectEventsFromSources,
  getEventDetail,
  listEvents,
  listUnattachedSources,
  patchEvent,
  removeEvent
} from "./events.service";

const eventsRouter = Router();

eventsRouter.use(authenticate);

/** GET /events — list org events */
eventsRouter.get("/", async (req, res, next) => {
  try {
    const query = listOrgEventsQuerySchema.parse(req.query);
    const data = await listEvents(query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** GET /events/sources/unattached — candidates available to attach / detect */
eventsRouter.get("/sources/unattached", async (req, res, next) => {
  try {
    const query = listUnattachedSourcesQuerySchema.parse(req.query);
    const data = await listUnattachedSources(query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** POST /events/detect — AI-cluster unattached sources into AUTO events */
eventsRouter.post("/detect", async (req, res, next) => {
  try {
    const body = detectOrgEventsBodySchema.parse(req.body ?? {});
    // User-triggered detection always runs (bypasses the change-detection gate).
    const data = await detectEventsFromSources({ ...body, force: true });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** POST /events — create a MANUAL org event */
eventsRouter.post("/", async (req, res, next) => {
  try {
    const body = createOrgEventSchema.parse(req.body);
    const data = await createManualEvent(req.user!.userId, body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** GET /events/:id — detail + full timeline */
eventsRouter.get("/:id", async (req, res, next) => {
  try {
    const data = await getEventDetail(param(req.params.id));
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** PATCH /events/:id — update metadata/status */
eventsRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = updateOrgEventSchema.parse(req.body);
    const data = await patchEvent(param(req.params.id), body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** DELETE /events/:id */
eventsRouter.delete("/:id", async (req, res, next) => {
  try {
    const data = await removeEvent(param(req.params.id));
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** POST /events/:id/attach — attach a source item to this event */
eventsRouter.post("/:id/attach", async (req, res, next) => {
  try {
    const body = attachOrgEventSourceSchema.parse(req.body);
    const data = await attachSourceToEvent(param(req.params.id), body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** POST /events/:id/notes — manual timeline note */
eventsRouter.post("/:id/notes", async (req, res, next) => {
  try {
    const body = addOrgEventNoteSchema.parse(req.body);
    const data = await addEventNote(
      param(req.params.id),
      {
        userId: req.user!.userId,
        email: req.user!.email
      },
      body
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export { eventsRouter };
