import { Router } from "express";
import { z } from "zod";

import { param } from "../../utils/param";
import { requirePermission } from "../auth/auth.guard";
import { authenticate } from "../auth/auth.middleware";
import {
  addMemberToTeam,
  createPermanentTeam,
  getPermanentTeam,
  listPermanentTeams,
  removeMemberFromTeam,
  removePermanentTeam,
  upsertPermanentTeamHierarchy,
  updatePermanentTeam,
  updateTeamMemberHierarchy
} from "./teams.service";

const teamsRouter = Router();

teamsRouter.use(authenticate);
teamsRouter.use(requirePermission("manage_teams"));

const createTeamSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  verticalId: z.string().uuid()
});

const createTeamHierarchySchema = z.object({
  teamId: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  verticalId: z.string().uuid().optional(),
  members: z.array(
    z.object({
      userId: z.string().uuid(),
      memberRole: z.string().optional(),
      reportsToUserId: z.string().uuid().nullable().optional()
    })
  )
});

teamsRouter.post("/", async (req, res, next) => {
  try {
    const payload = createTeamSchema.parse(req.body);
    const team = await createPermanentTeam({ ...payload, createdById: req.user?.userId });
    res.status(201).json({ success: true, data: team });
  } catch (error) {
    next(error);
  }
});

teamsRouter.post("/hierarchy", async (req, res, next) => {
  try {
    const payload = createTeamHierarchySchema.parse(req.body);
    const result = await upsertPermanentTeamHierarchy({
      ...payload,
      createdById: req.user?.userId
    });
    res.status(result.created ? 201 : 200).json({ success: true, data: result.team });
  } catch (error) {
    next(error);
  }
});

teamsRouter.get("/", async (_req, res, next) => {
  try {
    const teams = await listPermanentTeams();
    res.status(200).json({ success: true, data: teams });
  } catch (error) {
    next(error);
  }
});

teamsRouter.get("/:id", async (req, res, next) => {
  try {
    const team = await getPermanentTeam(param(req.params.id));
    res.status(200).json({ success: true, data: team });
  } catch (error) {
    next(error);
  }
});

const updateTeamSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  verticalId: z.string().uuid().optional(),
  isActive: z.boolean().optional()
});

teamsRouter.put("/:id", async (req, res, next) => {
  try {
    const payload = updateTeamSchema.parse(req.body);
    const team = await updatePermanentTeam(param(req.params.id), payload);
    res.status(200).json({ success: true, data: team });
  } catch (error) {
    next(error);
  }
});

teamsRouter.delete("/:id", async (req, res, next) => {
  try {
    await removePermanentTeam(param(req.params.id));
    res.status(200).json({ success: true, message: "Team deleted" });
  } catch (error) {
    next(error);
  }
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  memberRole: z.string().optional(),
  reportsToUserId: z.string().uuid().optional()
});

teamsRouter.post("/:id/members", async (req, res, next) => {
  try {
    const payload = addMemberSchema.parse(req.body);
    const member = await addMemberToTeam({
      teamId: param(req.params.id),
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

teamsRouter.put("/members/:memberId", async (req, res, next) => {
  try {
    const payload = updateMemberSchema.parse(req.body);
    const member = await updateTeamMemberHierarchy(param(req.params.memberId), payload);
    res.status(200).json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
});

teamsRouter.delete("/members/:memberId", async (req, res, next) => {
  try {
    await removeMemberFromTeam(param(req.params.memberId));
    res.status(200).json({ success: true, message: "Team member removed" });
  } catch (error) {
    next(error);
  }
});

export { teamsRouter };
