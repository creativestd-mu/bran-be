import { NextFunction, Request, Response } from "express";

import { env } from "../config/env";

export function validateLanguage(req: Request, res: Response, next: NextFunction): void {
  const langParam = req.params.lang;
  const lang = (Array.isArray(langParam) ? langParam[0] : langParam)?.toLowerCase();

  if (!lang || !env.supportedLanguages.includes(lang)) {
    res.status(400).json({
      success: false,
      error: "Unsupported language",
      supportedLanguages: env.supportedLanguages
    });
    return;
  }

  req.language = lang;
  next();
}
