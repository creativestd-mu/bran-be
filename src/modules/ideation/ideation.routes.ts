import { Router } from "express";

import { param } from "../../utils/param";
import { requirePermission } from "../auth/auth.guard";
import { authenticate } from "../auth/auth.middleware";
import { createIdeaSchema, listIdeasQuerySchema, updateIdeaSchema } from "./ideation.schemas";
import {
  createIdeaAndRecommendations,
  deleteMyIdea,
  listMyIdeas,
  listMyRecommendations,
  updateMyIdea
} from "./ideation.service";

const ideationRouter = Router();

ideationRouter.use(authenticate);

ideationRouter.post("/ideas", requirePermission("manage_ideation"), async (req, res, next) => {
  try {
    const payload = createIdeaSchema.parse(req.body);
    const idea = await createIdeaAndRecommendations({
      userId: req.user!.userId,
      title: payload.title,
      description: payload.description,
      tags: payload.tags
    });
    res.status(201).json({ success: true, data: idea });
  } catch (error) {
    next(error);
  }
});

ideationRouter.get("/ideas/me", requirePermission("manage_ideation"), async (req, res, next) => {
  try {
    const query = listIdeasQuerySchema.parse(req.query);
    const ideas = await listMyIdeas({
      userId: req.user!.userId,
      take: query.take,
      skip: query.skip
    });
    res.status(200).json({ success: true, data: ideas });
  } catch (error) {
    next(error);
  }
});

ideationRouter.patch(
  "/ideas/:ideaId",
  requirePermission("manage_ideation"),
  async (req, res, next) => {
    try {
      const payload = updateIdeaSchema.parse(req.body);
      const idea = await updateMyIdea({
        userId: req.user!.userId,
        ideaId: param(req.params.ideaId),
        ...payload
      });
      res.status(200).json({ success: true, data: idea });
    } catch (error) {
      next(error);
    }
  }
);

ideationRouter.delete(
  "/ideas/:ideaId",
  requirePermission("manage_ideation"),
  async (req, res, next) => {
    try {
      await deleteMyIdea({
        userId: req.user!.userId,
        ideaId: param(req.params.ideaId)
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

ideationRouter.get(
  "/recommendations/me",
  requirePermission("manage_ideation"),
  async (req, res, next) => {
    try {
      const query = listIdeasQuerySchema.parse(req.query);
      const recommendations = await listMyRecommendations({
        userId: req.user!.userId,
        take: query.take,
        skip: query.skip
      });
      res.status(200).json({ success: true, data: recommendations });
    } catch (error) {
      next(error);
    }
  }
);

export { ideationRouter };
