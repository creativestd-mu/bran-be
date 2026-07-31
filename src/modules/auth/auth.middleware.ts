import { NextFunction, Request, Response } from "express";

import { prisma } from "../../lib/prisma";
import { HttpError } from "../../utils/httpError";
import { verifyJwt } from "./auth.service";

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new HttpError(401, "Authentication required. Please sign in again.");
    }

    const token = header.slice(7);
    const payload = verifyJwt(token);

    // Prefer the live role from the DB so role changes take effect without forcing a re-login.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        isActive: true,
        roleId: true,
        role: { select: { name: true } }
      }
    });

    if (!user || !user.isActive) {
      throw new HttpError(401, "Authentication required. Please sign in again.");
    }

    req.user = {
      userId: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name
    };
    next();
  } catch (error) {
    next(error);
  }
}
