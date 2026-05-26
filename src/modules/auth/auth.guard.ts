import { NextFunction, Request, Response } from "express";

import { HttpError } from "../../utils/httpError";
import { prisma } from "../../lib/prisma";

export function requirePermission(...permissions: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw new HttpError(401, "Authentication required");
    }

    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: req.user.roleId },
      include: { permission: true }
    });

    const userPermissions = new Set(rolePermissions.map((rp) => rp.permission.name));
    const hasAll = permissions.every((p) => userPermissions.has(p));

    if (!hasAll) {
      throw new HttpError(403, "Insufficient permissions");
    }

    next();
  };
}

export function requireRole(...roleNames: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new HttpError(401, "Authentication required");
    }

    if (!roleNames.includes(req.user.roleName)) {
      throw new HttpError(403, "Insufficient role privileges");
    }

    next();
  };
}
