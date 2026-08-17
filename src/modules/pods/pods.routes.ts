import { Router } from "express";

import { param } from "../../utils/param";
import { requirePermission } from "../auth/auth.guard";
import { authenticate } from "../auth/auth.middleware";
import {
  addPodAccountService,
  createPodService,
  deactivatePodService,
  getPodService,
  listPodAccountsService,
  listPodPostsService,
  listPodsService,
  removePodAccountService,
  syncPodAccountService,
  updatePodAccountService,
  updatePodService
} from "./pods.service";
import {
  createPodAccountSchema,
  createPodSchema,
  listPodAccountsQuerySchema,
  listPodPostsQuerySchema,
  updatePodAccountSchema,
  updatePodSchema
} from "./pods.schemas";

const podsRouter = Router();

podsRouter.use(authenticate);

podsRouter.post("/", requirePermission("manage_pods"), async (req, res, next) => {
  try {
    const payload = createPodSchema.parse(req.body);
    const pod = await createPodService(payload);
    res.status(201).json({ success: true, data: pod });
  } catch (error) {
    next(error);
  }
});

podsRouter.get("/", async (req, res, next) => {
  try {
    const verticalId =
      typeof req.query.verticalId === "string" ? req.query.verticalId : undefined;
    const isActive =
      typeof req.query.isActive === "string"
        ? req.query.isActive === "true"
          ? true
          : req.query.isActive === "false"
            ? false
            : undefined
        : undefined;
    const pods = await listPodsService({ verticalId, isActive });
    res.status(200).json({ success: true, data: pods });
  } catch (error) {
    next(error);
  }
});

podsRouter.get("/:id", async (req, res, next) => {
  try {
    const pod = await getPodService(param(req.params.id));
    res.status(200).json({ success: true, data: pod });
  } catch (error) {
    next(error);
  }
});

podsRouter.put("/:id", requirePermission("manage_pods"), async (req, res, next) => {
  try {
    const payload = updatePodSchema.parse(req.body);
    const pod = await updatePodService(param(req.params.id), payload);
    res.status(200).json({ success: true, data: pod });
  } catch (error) {
    next(error);
  }
});

podsRouter.delete("/:id", requirePermission("manage_pods"), async (req, res, next) => {
  try {
    const pod = await deactivatePodService(param(req.params.id));
    res.status(200).json({ success: true, data: pod, message: "Pod deactivated" });
  } catch (error) {
    next(error);
  }
});

podsRouter.post("/:id/accounts", requirePermission("manage_pods"), async (req, res, next) => {
  try {
    const payload = createPodAccountSchema.parse(req.body);
    const account = await addPodAccountService(param(req.params.id), payload);
    res.status(201).json({ success: true, data: account });
  } catch (error) {
    next(error);
  }
});

podsRouter.get("/:id/accounts", async (req, res, next) => {
  try {
    const query = listPodAccountsQuerySchema.parse(req.query);
    const accounts = await listPodAccountsService(param(req.params.id), query);
    res.status(200).json({ success: true, data: accounts });
  } catch (error) {
    next(error);
  }
});

podsRouter.put(
  "/accounts/:accountId",
  requirePermission("manage_pods"),
  async (req, res, next) => {
    try {
      const payload = updatePodAccountSchema.parse(req.body);
      const account = await updatePodAccountService(param(req.params.accountId), payload);
      res.status(200).json({ success: true, data: account });
    } catch (error) {
      next(error);
    }
  }
);

podsRouter.delete(
  "/accounts/:accountId",
  requirePermission("manage_pods"),
  async (req, res, next) => {
    try {
      await removePodAccountService(param(req.params.accountId));
      res.status(200).json({ success: true, message: "Pod social account deleted" });
    } catch (error) {
      next(error);
    }
  }
);

podsRouter.post(
  "/accounts/:accountId/sync",
  requirePermission("manage_pods"),
  async (req, res, next) => {
    try {
      const result = await syncPodAccountService(param(req.params.accountId));
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

podsRouter.get("/:id/posts", async (req, res, next) => {
  try {
    const query = listPodPostsQuerySchema.parse(req.query);
    const posts = await listPodPostsService(param(req.params.id), query);
    res.status(200).json({ success: true, data: posts });
  } catch (error) {
    next(error);
  }
});

export { podsRouter };
