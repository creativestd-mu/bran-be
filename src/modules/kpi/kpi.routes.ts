import { Router } from "express";

import { param } from "../../utils/param";
import { authenticate } from "../auth/auth.middleware";
import {
  createUserKpiSchema,
  listUserKpisQuerySchema,
  updateUserKpiSchema
} from "./kpi.schemas";
import {
  assertCanManageUserKpis,
  assertCanViewUserKpi,
  createUserKpi,
  getUserKpiById,
  listUserKpis,
  removeUserKpi,
  updateUserKpi
} from "./kpi.service";

const kpiRouter = Router();

kpiRouter.use(authenticate);

kpiRouter.post("/", async (req, res, next) => {
  try {
    assertCanManageUserKpis(req.user!.roleName);
    const payload = createUserKpiSchema.parse(req.body);
    const kpi = await createUserKpi(req.user!.userId, payload);
    res.status(201).json({ success: true, data: kpi });
  } catch (error) {
    next(error);
  }
});

kpiRouter.get("/", async (req, res, next) => {
  try {
    const query = listUserKpisQuerySchema.parse(req.query);
    const result = await listUserKpis({
      viewerUserId: req.user!.userId,
      viewerRole: req.user!.roleName,
      userId: query.userId,
      isActive: query.isActive,
      page: query.page,
      pageSize: query.pageSize
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

kpiRouter.get("/:id", async (req, res, next) => {
  try {
    const kpi = await getUserKpiById(param(req.params.id));
    assertCanViewUserKpi(kpi, req.user!.userId, req.user!.roleName);
    res.status(200).json({ success: true, data: kpi });
  } catch (error) {
    next(error);
  }
});

kpiRouter.put("/:id", async (req, res, next) => {
  try {
    assertCanManageUserKpis(req.user!.roleName);
    const payload = updateUserKpiSchema.parse(req.body);
    const kpi = await updateUserKpi(param(req.params.id), payload);
    res.status(200).json({ success: true, data: kpi });
  } catch (error) {
    next(error);
  }
});

kpiRouter.delete("/:id", async (req, res, next) => {
  try {
    assertCanManageUserKpis(req.user!.roleName);
    await removeUserKpi(param(req.params.id));
    res.status(200).json({ success: true, message: "KPI deleted" });
  } catch (error) {
    next(error);
  }
});

export { kpiRouter };
