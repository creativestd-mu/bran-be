import { Router } from "express";
import { z } from "zod";

import { param } from "../../utils/param";
import { requirePermission } from "../auth/auth.guard";
import { authenticate } from "../auth/auth.middleware";
import {
  APPROVAL_STATES,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  MANAGE_PERMISSION,
  NODE_KINDS,
  NODE_STATUSES,
  RESOURCE_APPROVAL_STATES,
  RESOURCE_SOURCE_TYPES,
  TEAM_ROLES
} from "./content.constants";
import {
  addNodeTeamMemberService,
  createContentService,
  createNodeService,
  createOutputService,
  createResourceService,
  deleteContentService,
  deleteNodeService,
  deleteOutputService,
  deleteResourceService,
  dispatchBuildAssignService,
  dispatchEditAssignService,
  dispatchShootBriefService,
  getContentService,
  listContentsService,
  removeNodeTeamMemberService,
  reviewOutputService,
  reviewResourceService,
  updateContentService,
  updateNodeService,
  updateNodeStatusService,
  updateOutputService,
  updateResourceService
} from "./content.service";

const contentRouter = Router();

contentRouter.use(authenticate);

const writeGuard = requirePermission(MANAGE_PERMISSION);

// ── Schemas ───────────────────────────────────────────────

const createContentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(CONTENT_TYPES),
  status: z.enum(CONTENT_STATUSES).optional(),
  teamId: z.string().uuid(),
  projectId: z.string().uuid()
});

const updateContentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  type: z.enum(CONTENT_TYPES).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  teamId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional()
});

const createNodeSchema = z.object({
  kind: z.enum(NODE_KINDS),
  name: z.string().min(1),
  orderIndex: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  startsAt: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional()
});

const updateNodeSchema = z.object({
  kind: z.enum(NODE_KINDS).optional(),
  name: z.string().min(1).optional(),
  orderIndex: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional()
});

const updateNodeStatusSchema = z.object({
  status: z.enum(NODE_STATUSES)
});

const addTeamMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(TEAM_ROLES)
});

const createOutputSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  notes: z.string().optional()
});

const updateOutputSchema = z.object({
  label: z.string().min(1).optional(),
  url: z.string().url().optional(),
  notes: z.string().nullable().optional()
});

const reviewOutputSchema = z.object({
  approvalState: z.enum(APPROVAL_STATES),
  reviewNote: z.string().nullable().optional()
});

const reviewResourceSchema = z.object({
  approvalState: z.enum(RESOURCE_APPROVAL_STATES),
  reviewNote: z.string().nullable().optional()
});

const createResourceSchema = z
  .object({
    name: z.string().min(1),
    sourceType: z.enum(RESOURCE_SOURCE_TYPES).optional(),
    inventoryItemId: z.string().uuid().optional(),
    cost: z.number().nonnegative().nullable().optional(),
    quantity: z.number().int().positive().optional(),
    currency: z.string().min(1).max(8).nullable().optional(),
    notes: z.string().optional()
  })
  .refine(
    (val) => val.sourceType !== "RENTAL" || (val.cost !== undefined && val.cost !== null),
    { message: "cost is required when sourceType is RENTAL", path: ["cost"] }
  );

const updateResourceSchema = z.object({
  name: z.string().min(1).optional(),
  sourceType: z.enum(RESOURCE_SOURCE_TYPES).optional(),
  inventoryItemId: z.string().uuid().nullable().optional(),
  cost: z.number().nonnegative().nullable().optional(),
  quantity: z.number().int().positive().optional(),
  currency: z.string().min(1).max(8).nullable().optional(),
  notes: z.string().nullable().optional()
});

const listQuerySchema = z.object({
  type: z.enum(CONTENT_TYPES).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  teamId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  verticalId: z.string().uuid().optional(),
  mine: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true")
});

const shootBriefSchema = z.object({
  location: z.string().min(1),
  callTime: z.string().datetime(),
  wrapTime: z.string().datetime().nullable().optional(),
  people: z.array(z.string().uuid()).min(1),
  equipment: z.array(z.string().min(1)).optional(),
  scriptLink: z.string().url().nullable().optional(),
  scenes: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

const editAssignSchema = z.object({
  editorUserId: z.string().uuid(),
  deadline: z.string().datetime(),
  footage: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

const buildAssignSchema = z.object({
  projectName: z.string().min(1),
  builderUserIds: z.array(z.string().uuid()).min(1),
  deadline: z.string().datetime(),
  phase: z.string().nullable().optional(),
  materials: z.string().nullable().optional(),
  files: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

// ── Content ───────────────────────────────────────────────

contentRouter.post("/", writeGuard, async (req, res, next) => {
  try {
    const payload = createContentSchema.parse(req.body);
    const content = await createContentService({
      ...payload,
      createdById: req.user?.userId
    });
    res.status(201).json({ success: true, data: content });
  } catch (error) {
    next(error);
  }
});

contentRouter.get("/", async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const contents = await listContentsService({
      type: query.type,
      status: query.status,
      teamId: query.teamId,
      projectId: query.projectId,
      verticalId: query.verticalId,
      createdById: query.mine ? req.user?.userId : undefined
    });
    res.status(200).json({ success: true, data: contents });
  } catch (error) {
    next(error);
  }
});

contentRouter.get("/:id", async (req, res, next) => {
  try {
    const content = await getContentService(param(req.params.id));
    res.status(200).json({ success: true, data: content });
  } catch (error) {
    next(error);
  }
});

contentRouter.put("/:id", writeGuard, async (req, res, next) => {
  try {
    const payload = updateContentSchema.parse(req.body);
    const content = await updateContentService(param(req.params.id), payload);
    res.status(200).json({ success: true, data: content });
  } catch (error) {
    next(error);
  }
});

contentRouter.delete("/:id", writeGuard, async (req, res, next) => {
  try {
    await deleteContentService(param(req.params.id));
    res.status(200).json({ success: true, message: "Content deleted" });
  } catch (error) {
    next(error);
  }
});

// ── Nodes ─────────────────────────────────────────────────

contentRouter.post("/:id/nodes", writeGuard, async (req, res, next) => {
  try {
    const payload = createNodeSchema.parse(req.body);
    const node = await createNodeService({
      contentId: param(req.params.id),
      ...payload
    });
    res.status(201).json({ success: true, data: node });
  } catch (error) {
    next(error);
  }
});

contentRouter.put("/nodes/:nodeId", writeGuard, async (req, res, next) => {
  try {
    const payload = updateNodeSchema.parse(req.body);
    const node = await updateNodeService(param(req.params.nodeId), payload);
    res.status(200).json({ success: true, data: node });
  } catch (error) {
    next(error);
  }
});

contentRouter.patch("/nodes/:nodeId/status", writeGuard, async (req, res, next) => {
  try {
    const payload = updateNodeStatusSchema.parse(req.body);
    const node = await updateNodeStatusService(param(req.params.nodeId), payload.status);
    res.status(200).json({ success: true, data: node });
  } catch (error) {
    next(error);
  }
});

contentRouter.delete("/nodes/:nodeId", writeGuard, async (req, res, next) => {
  try {
    await deleteNodeService(param(req.params.nodeId));
    res.status(200).json({ success: true, message: "Node deleted" });
  } catch (error) {
    next(error);
  }
});

// ── Ops hub (content creator only) ────────────────────────

contentRouter.post("/nodes/:nodeId/ops/shoot-brief", async (req, res, next) => {
  try {
    if (!req.user) throw new Error("Authentication required");
    const payload = shootBriefSchema.parse(req.body);
    const node = await dispatchShootBriefService(
      param(req.params.nodeId),
      payload,
      { userId: req.user.userId, roleId: req.user.roleId }
    );
    res.status(200).json({ success: true, data: node });
  } catch (error) {
    next(error);
  }
});

contentRouter.post("/nodes/:nodeId/ops/assign-edit", async (req, res, next) => {
  try {
    if (!req.user) throw new Error("Authentication required");
    const payload = editAssignSchema.parse(req.body);
    const node = await dispatchEditAssignService(
      param(req.params.nodeId),
      payload,
      { userId: req.user.userId, roleId: req.user.roleId }
    );
    res.status(200).json({ success: true, data: node });
  } catch (error) {
    next(error);
  }
});

contentRouter.post("/nodes/:nodeId/ops/assign-build", async (req, res, next) => {
  try {
    if (!req.user) throw new Error("Authentication required");
    const payload = buildAssignSchema.parse(req.body);
    const node = await dispatchBuildAssignService(
      param(req.params.nodeId),
      payload,
      { userId: req.user.userId, roleId: req.user.roleId }
    );
    res.status(200).json({ success: true, data: node });
  } catch (error) {
    next(error);
  }
});

// ── Team ──────────────────────────────────────────────────

contentRouter.post("/nodes/:nodeId/team", writeGuard, async (req, res, next) => {
  try {
    const payload = addTeamMemberSchema.parse(req.body);
    const member = await addNodeTeamMemberService({
      nodeId: param(req.params.nodeId),
      ...payload
    });
    res.status(201).json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
});

contentRouter.delete("/team/:teamMemberId", writeGuard, async (req, res, next) => {
  try {
    await removeNodeTeamMemberService(param(req.params.teamMemberId));
    res.status(200).json({ success: true, message: "Team member removed" });
  } catch (error) {
    next(error);
  }
});

// ── Outputs ───────────────────────────────────────────────

contentRouter.post("/nodes/:nodeId/outputs", writeGuard, async (req, res, next) => {
  try {
    const payload = createOutputSchema.parse(req.body);
    const output = await createOutputService({
      nodeId: param(req.params.nodeId),
      submittedByUserId: req.user?.userId,
      ...payload
    });
    res.status(201).json({ success: true, data: output });
  } catch (error) {
    next(error);
  }
});

contentRouter.put("/outputs/:outputId", writeGuard, async (req, res, next) => {
  try {
    const payload = updateOutputSchema.parse(req.body);
    const output = await updateOutputService(param(req.params.outputId), payload);
    res.status(200).json({ success: true, data: output });
  } catch (error) {
    next(error);
  }
});

contentRouter.delete("/outputs/:outputId", writeGuard, async (req, res, next) => {
  try {
    await deleteOutputService(param(req.params.outputId));
    res.status(200).json({ success: true, message: "Output deleted" });
  } catch (error) {
    next(error);
  }
});

/**
 * Review an output. Authorization is owner-or-approve_resources, enforced
 * inside the service rather than via requirePermission middleware so that
 * the Content owner can always review their own outputs.
 */
contentRouter.post("/outputs/:outputId/review", async (req, res, next) => {
  try {
    if (!req.user) throw new Error("Authentication required");
    const payload = reviewOutputSchema.parse(req.body);
    const output = await reviewOutputService(
      param(req.params.outputId),
      payload,
      { userId: req.user.userId, roleId: req.user.roleId }
    );
    res.status(200).json({ success: true, data: output });
  } catch (error) {
    next(error);
  }
});

// ── Resources ─────────────────────────────────────────────

contentRouter.post("/nodes/:nodeId/resources", writeGuard, async (req, res, next) => {
  try {
    const payload = createResourceSchema.parse(req.body);
    const resource = await createResourceService({
      nodeId: param(req.params.nodeId),
      requestedByUserId: req.user?.userId,
      ...payload
    });
    res.status(201).json({ success: true, data: resource });
  } catch (error) {
    next(error);
  }
});

contentRouter.put("/resources/:resourceId", writeGuard, async (req, res, next) => {
  try {
    const payload = updateResourceSchema.parse(req.body);
    const resource = await updateResourceService(param(req.params.resourceId), payload);
    res.status(200).json({ success: true, data: resource });
  } catch (error) {
    next(error);
  }
});

contentRouter.delete("/resources/:resourceId", writeGuard, async (req, res, next) => {
  try {
    await deleteResourceService(param(req.params.resourceId));
    res.status(200).json({ success: true, message: "Resource deleted" });
  } catch (error) {
    next(error);
  }
});

/**
 * Approve / reject a RENTAL resource request. Authorization is
 * vertical-owner-or-approve_rental_resources, enforced inside the service so
 * vertical heads can always act on their own vertical's requests.
 */
contentRouter.post("/resources/:resourceId/review", async (req, res, next) => {
  try {
    if (!req.user) throw new Error("Authentication required");
    const payload = reviewResourceSchema.parse(req.body);
    const resource = await reviewResourceService(
      param(req.params.resourceId),
      payload,
      { userId: req.user.userId, roleId: req.user.roleId }
    );
    res.status(200).json({ success: true, data: resource });
  } catch (error) {
    next(error);
  }
});

export { contentRouter };
