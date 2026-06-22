import { Router } from "express";
import multer from "multer";

import { HttpError } from "../../utils/httpError";
import { param } from "../../utils/param";
import { authenticate } from "../auth/auth.middleware";
import { MAX_VISION_FILE_BYTES, isSupportedVisionMime } from "./vision.constants";
import {
  createVisionBodySchema,
  listVisionsQuerySchema,
  updateVisionBodySchema
} from "./vision.schemas";
import {
  assertCanManageVisions,
  assertCanViewVision,
  createVision,
  getVisionById,
  listVisions,
  removeVision,
  resolveVisionDocumentForDownload,
  updateVision
} from "./vision.service";

const visionRouter = Router();

visionRouter.use(authenticate);

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VISION_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isSupportedVisionMime(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError(400, `Unsupported document format: ${file.mimetype}`));
    }
  }
});

visionRouter.post("/", documentUpload.single("file"), async (req, res, next) => {
  try {
    assertCanManageVisions(req.user!.roleName);
    if (!req.file) {
      throw new HttpError(400, 'Document file is required. Send it as form-data field "file".');
    }

    const payload = createVisionBodySchema.parse(req.body);
    const vision = await createVision(req.user!.userId, req.file, payload);
    res.status(201).json({ success: true, data: vision });
  } catch (error) {
    next(error);
  }
});

visionRouter.get("/", async (req, res, next) => {
  try {
    const query = listVisionsQuerySchema.parse(req.query);
    const result = await listVisions({
      viewerUserId: req.user!.userId,
      viewerRole: req.user!.roleName,
      horizon: query.horizon,
      scope: query.scope,
      teamId: query.teamId,
      userId: query.userId,
      page: query.page,
      pageSize: query.pageSize
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

visionRouter.get("/:id/document", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    await assertCanViewVision(id, req.user!.userId, req.user!.roleName);
    const { vision, stream } = await resolveVisionDocumentForDownload(id);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${vision.originalFilename.replace(/"/g, "")}"`
    );
    res.setHeader("Content-Type", vision.mimeType);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

visionRouter.get("/:id", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    await assertCanViewVision(id, req.user!.userId, req.user!.roleName);
    const vision = await getVisionById(id);
    res.status(200).json({ success: true, data: vision });
  } catch (error) {
    next(error);
  }
});

visionRouter.put("/:id", documentUpload.single("file"), async (req, res, next) => {
  try {
    assertCanManageVisions(req.user!.roleName);
    const payload = updateVisionBodySchema.parse(req.body);
    const vision = await updateVision(
      param(req.params.id),
      payload,
      req.file ?? undefined
    );
    res.status(200).json({ success: true, data: vision });
  } catch (error) {
    next(error);
  }
});

visionRouter.delete("/:id", async (req, res, next) => {
  try {
    assertCanManageVisions(req.user!.roleName);
    await removeVision(param(req.params.id));
    res.status(200).json({ success: true, message: "Vision deleted" });
  } catch (error) {
    next(error);
  }
});

export { visionRouter };
