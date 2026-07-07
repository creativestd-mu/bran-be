import { Router } from "express";
import { z } from "zod";

import { param } from "../../utils/param";
import { authenticate } from "../auth/auth.middleware";
import { requirePermission } from "../auth/auth.guard";
import {
  listUsers,
  createUser,
  getUserById,
  getUserHierarchy,
  upsertUserHierarchy,
  updateUserProfile,
  removeUser,
  addSocialAccount,
  removeSocialAccount,
  getUserSocialAccounts
} from "./users.service";

const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get("/me", async (req, res, next) => {
  try {
    const user = await getUserById(req.user!.userId);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/", async (req, res, next) => {
  try {
    const result = await listUsers({
      page: Number(req.query.page) || undefined,
      pageSize: Number(req.query.pageSize) || undefined,
      roleId: typeof req.query.roleId === "string" ? req.query.roleId : undefined,
      isActive: typeof req.query.isActive === "string" ? req.query.isActive : undefined
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

const upsertUserHierarchySchema = z.object({
  members: z.array(
    z.object({
      userId: z.string().uuid(),
      managerUserId: z.string().uuid().nullable().optional()
    })
  )
});

usersRouter.get("/hierarchy", requirePermission("manage_users"), async (req, res, next) => {
  try {
    const isActive =
      typeof req.query.isActive === "string"
        ? req.query.isActive === "true"
          ? true
          : req.query.isActive === "false"
            ? false
            : undefined
        : undefined;
    const hierarchy = await getUserHierarchy(isActive);
    res.status(200).json({ success: true, data: hierarchy });
  } catch (error) {
    next(error);
  }
});

usersRouter.put("/hierarchy", requirePermission("manage_users"), async (req, res, next) => {
  try {
    const payload = upsertUserHierarchySchema.parse(req.body);
    const hierarchy = await upsertUserHierarchy(payload.members);
    res.status(200).json({ success: true, data: hierarchy });
  } catch (error) {
    next(error);
  }
});

const createUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().min(1),
  roleId: z.string().uuid(),
  description: z.string().optional(),
  phone: z.string().optional(),
  designation: z.string().optional(),
  managerUserId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional()
});

usersRouter.post("/", requirePermission("manage_users"), async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);
    const user = await createUser(data);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/:id", async (req, res, next) => {
  try {
    const user = await getUserById(param(req.params.id));
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  designation: z.string().optional(),
  managerUserId: z.string().uuid().nullable().optional(),
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional()
});

usersRouter.put("/:id", async (req, res, next) => {
  try {
    const id = param(req.params.id);
    const isSelf = req.user!.userId === id;
    const data = updateUserSchema.parse(req.body);
    const requiresManageUsers =
      data.managerUserId !== undefined ||
      (!isSelf && (data.roleId !== undefined || data.isActive !== undefined));

    if (requiresManageUsers) {
      await new Promise<void>((resolve, reject) => {
        requirePermission("manage_users")(req, res, (err?: unknown) =>
          err ? reject(err) : resolve()
        );
      });
    }

    const user = await updateUserProfile(id, data);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

usersRouter.delete("/:id", requirePermission("manage_users"), async (req, res, next) => {
  try {
    await removeUser(param(req.params.id));
    res.status(200).json({ success: true, message: "User deleted" });
  } catch (error) {
    next(error);
  }
});

const socialAccountSchema = z.object({
  platform: z.string().min(1),
  platformAccountId: z.string().min(1),
  handle: z.string().optional()
});

usersRouter.get("/:id/social-accounts", async (req, res, next) => {
  try {
    const accounts = await getUserSocialAccounts(param(req.params.id));
    res.status(200).json({ success: true, data: accounts });
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/:id/social-accounts", async (req, res, next) => {
  try {
    const data = socialAccountSchema.parse(req.body);
    const account = await addSocialAccount(param(req.params.id), data);
    res.status(201).json({ success: true, data: account });
  } catch (error) {
    next(error);
  }
});

usersRouter.delete("/social-accounts/:accountId", async (req, res, next) => {
  try {
    await removeSocialAccount(param(req.params.accountId));
    res.status(200).json({ success: true, message: "Social account unlinked" });
  } catch (error) {
    next(error);
  }
});

export { usersRouter };
