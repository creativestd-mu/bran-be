import { NextFunction, Request, Response } from "express";

import { HttpError } from "../../utils/httpError";
import { verifyJwt } from "./auth.service";

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Authentication required. Please sign in again.");
  }

  const token = header.slice(7);
  req.user = verifyJwt(token);
  next();
}
