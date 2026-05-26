import { Router } from "express";
import { z } from "zod";

import { param } from "../../utils/param";
import { requirePermission } from "../auth/auth.guard";
import { authenticate } from "../auth/auth.middleware";
import {
  addMemberToProject,
  addPhaseToProject,
  createTemporaryProject,
  getTemporaryProject,
  listTemporaryProjects,
  removeMemberFromProject,
  removeProjectPhaseById,
  removeTemporaryProject,
  updateProjectPhaseDetails,
  updateProjectMemberHierarchy,
  updateTemporaryProject
} from "./projects.service";

const projectsRouter = Router();

projectsRouter.use(authenticate);
projectsRouter.use(requirePermission("manage_projects"));

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  objectives: z.string().optional(),
  finalLink: z.string().url().optional(),
  verticalId: z.string().uuid(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  status: z.string().optional()
});

projectsRouter.post("/", async (req, res, next) => {
  try {
    const payload = createProjectSchema.parse(req.body);
    const project = await createTemporaryProject({ ...payload, createdById: req.user?.userId });
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get("/", async (_req, res, next) => {
  try {
    const projects = await listTemporaryProjects();
    res.status(200).json({ success: true, data: projects });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get("/:id", async (req, res, next) => {
  try {
    const project = await getTemporaryProject(param(req.params.id));
    res.status(200).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  objectives: z.string().nullable().optional(),
  finalLink: z.string().url().nullable().optional(),
  verticalId: z.string().uuid().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  status: z.string().optional()
});

projectsRouter.put("/:id", async (req, res, next) => {
  try {
    const payload = updateProjectSchema.parse(req.body);
    const project = await updateTemporaryProject(param(req.params.id), payload);
    res.status(200).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
});

projectsRouter.delete("/:id", async (req, res, next) => {
  try {
    await removeTemporaryProject(param(req.params.id));
    res.status(200).json({ success: true, message: "Project deleted" });
  } catch (error) {
    next(error);
  }
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  memberRole: z.string().optional(),
  reportsToUserId: z.string().uuid().optional()
});

projectsRouter.post("/:id/members", async (req, res, next) => {
  try {
    const payload = addMemberSchema.parse(req.body);
    const member = await addMemberToProject({
      projectId: param(req.params.id),
      ...payload
    });
    res.status(201).json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
});

const updateMemberSchema = z.object({
  memberRole: z.string().optional(),
  reportsToUserId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional()
});

projectsRouter.put("/members/:memberId", async (req, res, next) => {
  try {
    const payload = updateMemberSchema.parse(req.body);
    const member = await updateProjectMemberHierarchy(param(req.params.memberId), payload);
    res.status(200).json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
});

projectsRouter.delete("/members/:memberId", async (req, res, next) => {
  try {
    await removeMemberFromProject(param(req.params.memberId));
    res.status(200).json({ success: true, message: "Project member removed" });
  } catch (error) {
    next(error);
  }
});

const createPhaseSchema = z.object({
  name: z.string().min(1),
  objectives: z.string().optional(),
  deadline: z.string().datetime().optional(),
  status: z.string().optional(),
  orderIndex: z.number().int().min(0).optional()
});

projectsRouter.post("/:id/phases", async (req, res, next) => {
  try {
    const payload = createPhaseSchema.parse(req.body);
    const phase = await addPhaseToProject({
      projectId: param(req.params.id),
      ...payload
    });
    res.status(201).json({ success: true, data: phase });
  } catch (error) {
    next(error);
  }
});

const updatePhaseSchema = z.object({
  name: z.string().min(1).optional(),
  objectives: z.string().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  status: z.string().optional(),
  orderIndex: z.number().int().min(0).optional()
});

projectsRouter.put("/phases/:phaseId", async (req, res, next) => {
  try {
    const payload = updatePhaseSchema.parse(req.body);
    const phase = await updateProjectPhaseDetails(param(req.params.phaseId), payload);
    res.status(200).json({ success: true, data: phase });
  } catch (error) {
    next(error);
  }
});

projectsRouter.delete("/phases/:phaseId", async (req, res, next) => {
  try {
    await removeProjectPhaseById(param(req.params.phaseId));
    res.status(200).json({ success: true, message: "Project phase removed" });
  } catch (error) {
    next(error);
  }
});

export { projectsRouter };
