import { Router } from "express";
import multer from "multer";

import { HttpError } from "../../../utils/httpError";
import { param } from "../../../utils/param";
import { requirePermission } from "../../auth/auth.guard";
import { authenticate } from "../../auth/auth.middleware";
import {
  MAX_THUMBNAIL_FILE_BYTES,
  REQUIRED_REFERENCE_COUNT,
  isSupportedThumbnailMime
} from "./thumbnail-generator.constants";
import { generateThumbnailBodySchema, listThumbnailGenerationsQuerySchema } from "./thumbnail-generator.schemas";
import {
  generateThumbnailPlan,
  getThumbnailGeneration,
  listMyThumbnailGenerations,
  resolveGeneratedThumbnailDownload
} from "./thumbnail-generator.service";

const thumbnailGeneratorRouter = Router();

thumbnailGeneratorRouter.use(authenticate);
thumbnailGeneratorRouter.use(requirePermission("query_ai"));

const referenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_THUMBNAIL_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isSupportedThumbnailMime(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new HttpError(400, `Unsupported image format: ${file.mimetype}`));
    }
  }
});

thumbnailGeneratorRouter.post(
  "/generate",
  referenceUpload.array("references", REQUIRED_REFERENCE_COUNT),
  async (req, res, next) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length !== REQUIRED_REFERENCE_COUNT) {
        throw new HttpError(
          400,
          `Exactly ${REQUIRED_REFERENCE_COUNT} reference thumbnails are required in form field "references".`
        );
      }

      const payload = generateThumbnailBodySchema.parse(req.body);
      const result = await generateThumbnailPlan(req.user!.userId, {
        title: payload.title,
        description: payload.description,
        context: payload.context,
        referenceFiles: files.map((file) => ({
          buffer: file.buffer,
          mimetype: file.mimetype,
          originalname: file.originalname
        }))
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

thumbnailGeneratorRouter.get("/", async (req, res, next) => {
  try {
    const query = listThumbnailGenerationsQuerySchema.parse(req.query);
    const result = await listMyThumbnailGenerations({
      userId: req.user!.userId,
      page: query.page,
      pageSize: query.pageSize
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

thumbnailGeneratorRouter.get("/:id/image", async (req, res, next) => {
  try {
    const { stream, mimeType } = await resolveGeneratedThumbnailDownload(
      param(req.params.id),
      req.user!.userId
    );
    res.setHeader("Content-Type", mimeType);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

thumbnailGeneratorRouter.get("/:id", async (req, res, next) => {
  try {
    const result = await getThumbnailGeneration(param(req.params.id), req.user!.userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export { thumbnailGeneratorRouter };
