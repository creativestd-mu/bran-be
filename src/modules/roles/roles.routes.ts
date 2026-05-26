import { Router } from "express";
import { z } from "zod";

import { param } from "../../utils/param";
import { authenticate } from "../auth/auth.middleware";
import { requirePermission } from "../auth/auth.guard";
import {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  removeRole,
  setRolePermissions,
  listPermissions,
  createPermission,
  removePermission
} from "./roles.service";

const rolesRouter = Router();

rolesRouter.use(authenticate);
rolesRouter.use(requirePermission("manage_roles"));

// ── Roles ────────────────────────────────────────────────

rolesRouter.get("/", async (_req, res, next) => {
  try {
    const roles = await listRoles();
    res.status(200).json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
});

rolesRouter.get("/:id", async (req, res, next) => {
  try {
    const role = await getRoleById(param(req.params.id));
    res.status(200).json({ success: true, data: role });
  } catch (error) {
    next(error);
  }
});

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional()
});

rolesRouter.post("/", async (req, res, next) => {
  try {
    const data = createRoleSchema.parse(req.body);
    const role = await createRole(data);
    res.status(201).json({ success: true, data: role });
  } catch (error) {
    next(error);
  }
});

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional()
});

rolesRouter.put("/:id", async (req, res, next) => {
  try {
    const data = updateRoleSchema.parse(req.body);
    const role = await updateRole(param(req.params.id), data);
    res.status(200).json({ success: true, data: role });
  } catch (error) {
    next(error);
  }
});

rolesRouter.delete("/:id", async (req, res, next) => {
  try {
    await removeRole(param(req.params.id));
    res.status(200).json({ success: true, message: "Role deleted" });
  } catch (error) {
    next(error);
  }
});

const assignPermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid())
});

rolesRouter.put("/:id/permissions", async (req, res, next) => {
  try {
    const { permissionIds } = assignPermissionsSchema.parse(req.body);
    const role = await setRolePermissions(param(req.params.id), permissionIds);
    res.status(200).json({ success: true, data: role });
  } catch (error) {
    next(error);
  }
});

// ── Permissions ──────────────────────────────────────────

rolesRouter.get("/permissions/all", async (_req, res, next) => {
  try {
    const permissions = await listPermissions();
    res.status(200).json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
});

const createPermissionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional()
});

rolesRouter.post("/permissions", async (req, res, next) => {
  try {
    const data = createPermissionSchema.parse(req.body);
    const permission = await createPermission(data);
    res.status(201).json({ success: true, data: permission });
  } catch (error) {
    next(error);
  }
});

rolesRouter.delete("/permissions/:permId", async (req, res, next) => {
  try {
    await removePermission(param(req.params.permId));
    res.status(200).json({ success: true, message: "Permission deleted" });
  } catch (error) {
    next(error);
  }
});

export { rolesRouter };
