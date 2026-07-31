import { Router } from "express";
import multer from "multer";

import { HttpError } from "../../utils/httpError";
import { param } from "../../utils/param";
import { authenticate } from "../auth/auth.middleware";
import {
  MAX_VIDEO_BYTES,
  isSupportedPrereadMediaMime,
  maxBytesForMime
} from "./preread.constants";
import {
  createCommentSchema,
  createNodeSchema,
  createPrereadSchema,
  replaceMembersSchema,
  updateNodeSchema,
  updatePrereadSchema
} from "./preread.schemas";
import {
  createNode,
  createNodeComment,
  createPreread,
  deleteNode,
  deleteNodeComment,
  deleteNodeMedia,
  deletePreread,
  getPrereadDetail,
  listNodeComments,
  listPrereads,
  replaceMembers,
  resolveNodeMediaStream,
  updateNode,
  updatePreread,
  uploadNodeMedia
} from "./preread.service";

const prereadRouter = Router();

prereadRouter.use(authenticate);

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isSupportedPrereadMediaMime(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError(400, `Unsupported media format: ${file.mimetype}`));
    }
  }
});

prereadRouter.get("/", async (req, res, next) => {
  try {
    const data = await listPrereads(req.user!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

prereadRouter.post("/", async (req, res, next) => {
  try {
    const payload = createPrereadSchema.parse(req.body);
    const data = await createPreread(req.user!.userId, payload);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

prereadRouter.get("/:id", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    const data = await getPrereadDetail(id, req.user!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

prereadRouter.patch("/:id", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    const payload = updatePrereadSchema.parse(req.body);
    const data = await updatePreread(id, req.user!.userId, payload);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

prereadRouter.delete("/:id", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    await deletePreread(id, req.user!.userId);
    res.status(200).json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

prereadRouter.put("/:id/members", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    const payload = replaceMembersSchema.parse(req.body);
    const data = await replaceMembers(id, req.user!.userId, payload.userIds);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

prereadRouter.post("/:id/nodes", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    const payload = createNodeSchema.parse(req.body);
    const data = await createNode(id, req.user!.userId, payload);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

prereadRouter.patch("/:id/nodes/:nodeId", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    const nodeId = param(req.params.nodeId);
    const payload = updateNodeSchema.parse(req.body);
    const data = await updateNode(id, nodeId, req.user!.userId, payload);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

prereadRouter.delete("/:id/nodes/:nodeId", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    const nodeId = param(req.params.nodeId);
    await deleteNode(id, nodeId, req.user!.userId);
    res.status(200).json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

prereadRouter.get("/:id/nodes/:nodeId/comments", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    const nodeId = param(req.params.nodeId);
    const data = await listNodeComments(id, nodeId, req.user!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

prereadRouter.post("/:id/nodes/:nodeId/comments", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    const nodeId = param(req.params.nodeId);
    const payload = createCommentSchema.parse(req.body);
    const data = await createNodeComment(id, nodeId, req.user!.userId, payload.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

prereadRouter.delete("/:id/nodes/:nodeId/comments/:commentId", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    const nodeId = param(req.params.nodeId);
    const commentId = param(req.params.commentId);
    await deleteNodeComment(id, nodeId, commentId, req.user!.userId);
    res.status(200).json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

prereadRouter.post(
  "/:id/nodes/:nodeId/media",
  mediaUpload.single("file"),
  async (req, res, next) => {
    try {
      const id = param(req.params.id);
      const nodeId = param(req.params.nodeId);
      if (!req.file) {
        throw new HttpError(400, 'Media file is required. Send it as form-data field "file".');
      }
      const limit = maxBytesForMime(req.file.mimetype);
      if (req.file.size > limit) {
        throw new HttpError(400, `File exceeds size limit (${limit} bytes).`);
      }
      const data = await uploadNodeMedia(id, nodeId, req.user!.userId, req.file);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

prereadRouter.get("/:id/nodes/:nodeId/media/:mediaId", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    const nodeId = param(req.params.nodeId);
    const mediaId = param(req.params.mediaId);
    const { media, stream } = await resolveNodeMediaStream(
      id,
      nodeId,
      mediaId,
      req.user!.userId
    );
    res.setHeader("Content-Type", media.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${media.filename.replace(/"/g, "")}"`
    );
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

prereadRouter.delete("/:id/nodes/:nodeId/media/:mediaId", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    const nodeId = param(req.params.nodeId);
    const mediaId = param(req.params.mediaId);
    await deleteNodeMedia(id, nodeId, mediaId, req.user!.userId);
    res.status(200).json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

export { prereadRouter };
