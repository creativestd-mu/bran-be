import { Router } from "express";
import multer from "multer";

import { HttpError } from "../../utils/httpError";
import { param } from "../../utils/param";
import { authenticate } from "../auth/auth.middleware";
import { MAX_REVIEW_FILE_BYTES } from "./review.constants";
import {
  createReviewSchema,
  listReviewsQuerySchema,
  respondReviewSchema,
  updateReminderPreferencesSchema
} from "./review.schemas";
import {
  createReview,
  getMyReminderPreferences,
  getReview,
  listMyReviews,
  resolveReviewFileStream,
  respondToReviewRequest,
  updateMyReminderPreferences
} from "./review.service";

const reviewRouter = Router();

reviewRouter.use(authenticate);

const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_REVIEW_FILE_BYTES }
});

reviewRouter.get("/reminders/preferences", async (req, res, next) => {
  try {
    const data = await getMyReminderPreferences(req.user!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

reviewRouter.put("/reminders/preferences", async (req, res, next) => {
  try {
    const payload = updateReminderPreferencesSchema.parse(req.body);
    const data = await updateMyReminderPreferences(req.user!.userId, payload);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

reviewRouter.get("/", async (req, res, next) => {
  try {
    const query = listReviewsQuerySchema.parse(req.query);
    const data = await listMyReviews(req.user!.userId, query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

reviewRouter.post("/", fileUpload.single("file"), async (req, res, next) => {
  try {
    const body = {
      requestedToId: req.body?.requestedToId,
      context: req.body?.context,
      fileUrl: req.body?.fileUrl || undefined
    };
    // Empty string from multipart → treat as absent
    if (body.fileUrl === "") {
      body.fileUrl = undefined;
    }
    const payload = createReviewSchema.parse(body);
    const data = await createReview(req.user!.userId, payload, req.file);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

reviewRouter.get("/:id", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    const data = await getReview(req.user!.userId, id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

reviewRouter.get("/:id/file", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    const { stream, fileName, contentType } = await resolveReviewFileStream(
      req.user!.userId,
      id
    );
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName.replace(/"/g, "")}"`
    );
    stream.on("error", (error) => next(error));
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

reviewRouter.post("/:id/respond", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    const payload = respondReviewSchema.parse(req.body);
    const data = await respondToReviewRequest(req.user!.userId, id, payload);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Catch multer size errors as 400s
reviewRouter.use((error: unknown, _req: unknown, _res: unknown, next: (err?: unknown) => void) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    next(new HttpError(400, "File exceeds 25 MB limit"));
    return;
  }
  next(error);
});

export { reviewRouter };
