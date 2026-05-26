import { Router } from "express";

import { requirePermission } from "../auth/auth.guard";
import { authenticate } from "../auth/auth.middleware";
import { createIdeaSchema, listIdeasQuerySchema } from "./ideation.schemas";
import {
  createIdeaAndRecommendations,
  listMyIdeas,
  listMyRecommendations
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
