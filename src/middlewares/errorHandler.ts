import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isProd = env.nodeEnv === "production";
  const statusCode =
    error instanceof ZodError ? 400 : error instanceof HttpError ? error.statusCode : 500;
  const message = error instanceof ZodError ? "Validation error" : error.message;

  if (!isProd) {
    console.error("[error-handler]", {
      method: req.method,
      path: req.originalUrl,
      statusCode,
      message: error.message,
      stack: error.stack
    });
  }

  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? "Internal server error" : message,
    details: isProd
      ? undefined
      : error instanceof ZodError
        ? error.flatten()
        : error.message
  });
}
