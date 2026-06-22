import { Router } from "express";

import { param } from "../../utils/param";
import { authenticate } from "../auth/auth.middleware";
import { listVoiceRecordingsQuerySchema } from "./voice-recording.schemas";
import {
  assertCanAccessRecording,
  getVoiceRecordingById,
  listVoiceRecordingsForViewer,
  openVoiceRecordingFileStream
} from "./voice-recording.service";

const voiceRecordingRouter = Router();

voiceRecordingRouter.use(authenticate);

voiceRecordingRouter.get("/", async (req, res, next) => {
  try {
    const query = listVoiceRecordingsQuerySchema.parse(req.query);
    const result = await listVoiceRecordingsForViewer({
      viewerUserId: req.user!.userId,
      viewerRole: req.user!.roleName,
      userId: query.userId,
      source: query.source,
      page: query.page,
      pageSize: query.pageSize
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

voiceRecordingRouter.get("/:id", async (req, res, next) => {
  try {
    const recording = await getVoiceRecordingById(param(req.params.id));
    assertCanAccessRecording(recording, req.user!.userId, req.user!.roleName);
    res.status(200).json({ success: true, data: recording });
  } catch (error) {
    next(error);
  }
});

voiceRecordingRouter.get("/:id/audio", async (req, res, next) => {
  try {
    const recording = await getVoiceRecordingById(param(req.params.id));
    assertCanAccessRecording(recording, req.user!.userId, req.user!.roleName);

    const stream = await openVoiceRecordingFileStream(recording.storagePath);
    res.setHeader("Content-Type", recording.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${recording.originalFilename.replace(/"/g, "")}"`
    );
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

export { voiceRecordingRouter };
