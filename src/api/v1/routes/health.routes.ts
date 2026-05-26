import { Router } from "express";

const healthRouter = Router();

healthRouter.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Service is healthy",
    language: req.language,
    version: "v1",
    timestamp: new Date().toISOString()
  });
});

export { healthRouter };
