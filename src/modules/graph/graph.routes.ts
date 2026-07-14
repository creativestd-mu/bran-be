import { Router } from "express";

import { authenticate } from "../auth/auth.middleware";
import { brainGraphQuerySchema } from "./graph.schemas";
import { getBrainGraph } from "./graph.service";

const graphRouter = Router();

graphRouter.use(authenticate);

graphRouter.get("/brain", async (req, res, next) => {
  try {
    const query = brainGraphQuerySchema.parse(req.query);
    const data = await getBrainGraph(req.user!.userId, req.user!.roleName, query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

graphRouter.post("/brain/rebuild", async (req, res, next) => {
  try {
    const query = brainGraphQuerySchema.parse(req.query);
    const data = await getBrainGraph(req.user!.userId, req.user!.roleName, query, {
      forceRebuild: true
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export { graphRouter };
