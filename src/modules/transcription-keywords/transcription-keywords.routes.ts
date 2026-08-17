import { Router } from "express";

import { param } from "../../utils/param";
import { authenticate } from "../auth/auth.middleware";
import {
  createTranscriptionKeywordService,
  deleteTranscriptionKeywordService,
  listTranscriptionKeywordsService,
  updateTranscriptionKeywordService
} from "./transcription-keywords.service";
import {
  transcriptionKeywordCreateSchema,
  transcriptionKeywordListQuerySchema,
  transcriptionKeywordUpdateSchema
} from "./transcription-keywords.schemas";

const transcriptionKeywordsRouter = Router();

transcriptionKeywordsRouter.use(authenticate);

transcriptionKeywordsRouter.get("/", async (req, res, next) => {
  try {
    const query = transcriptionKeywordListQuerySchema.parse(req.query);
    const rows = await listTranscriptionKeywordsService({
      roleName: req.user!.roleName,
      isActive: query.isActive
    });
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

transcriptionKeywordsRouter.post("/", async (req, res, next) => {
  try {
    const body = transcriptionKeywordCreateSchema.parse(req.body);
    const row = await createTranscriptionKeywordService({
      roleName: req.user!.roleName,
      userId: req.user!.userId,
      phrase: body.phrase,
      notes: body.notes
    });
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
});

transcriptionKeywordsRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = transcriptionKeywordUpdateSchema.parse(req.body);
    const row = await updateTranscriptionKeywordService({
      roleName: req.user!.roleName,
      id: param(req.params.id),
      phrase: body.phrase,
      notes: body.notes,
      isActive: body.isActive
    });
    res.status(200).json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
});

transcriptionKeywordsRouter.delete("/:id", async (req, res, next) => {
  try {
    const result = await deleteTranscriptionKeywordService({
      roleName: req.user!.roleName,
      id: param(req.params.id)
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export { transcriptionKeywordsRouter };
