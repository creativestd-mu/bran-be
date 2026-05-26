import { Router } from "express";
import { z } from "zod";

import { param } from "../../utils/param";
import { authenticate } from "../auth/auth.middleware";
import { requirePermission } from "../auth/auth.guard";
import {
  createTask,
  getTaskById,
  listTasks,
  updateTask,
  removeTask
} from "./tasks.service";

const tasksRouter = Router();

tasksRouter.use(authenticate);

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(4000).optional(),
  type: z.string().optional(),
  platform: z.string().optional(),
  contentUrl: z.string().url().optional(),
  metadata: z.string().optional(),
  dueDate: z.string().datetime().optional()
});

tasksRouter.post("/", requirePermission("create_tasks"), async (req, res, next) => {
  try {
    const data = createTaskSchema.parse(req.body);
    const task = await createTask(req.user!.userId, data);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

function qStr(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return String(val[0]);
  return undefined;
}

tasksRouter.get("/", async (req, res, next) => {
  try {
    const canViewAll = req.user!.roleName === "admin" || req.user!.roleName === "manager";
    const userId = canViewAll ? qStr(req.query.userId) : req.user!.userId;

    const result = await listTasks({
      userId,
      status: qStr(req.query.status),
      type: qStr(req.query.type),
      platform: qStr(req.query.platform),
      from: qStr(req.query.from),
      to: qStr(req.query.to),
      page: Number(req.query.page) || undefined,
      pageSize: Number(req.query.pageSize) || undefined
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

tasksRouter.get("/:id", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    const task = await getTaskById(id);
    const canViewAll = req.user!.roleName === "admin" || req.user!.roleName === "manager";
    if (!canViewAll && task.userId !== req.user!.userId) {
      res.status(403).json({ success: false, error: "Not authorized to view this task" });
      return;
    }
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(4000).optional(),
  type: z.string().optional(),
  platform: z.string().optional(),
  contentUrl: z.string().url().optional(),
  status: z.string().optional(),
  metadata: z.string().optional(),
  dueDate: z.string().datetime().nullable().optional()
});

tasksRouter.put("/:id", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    const existing = await getTaskById(id);
    const canManage = req.user!.roleName === "admin" || req.user!.roleName === "manager";
    if (!canManage && existing.userId !== req.user!.userId) {
      res.status(403).json({ success: false, error: "Not authorized to update this task" });
      return;
    }

    const data = updateTaskSchema.parse(req.body);
    const task = await updateTask(id, data);
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

tasksRouter.delete("/:id", requirePermission("manage_tasks"), async (req, res, next) => {
  try {
    await removeTask(param(req.params.id));
    res.status(200).json({ success: true, message: "Task deleted" });
  } catch (error) {
    next(error);
  }
});

export { tasksRouter };
