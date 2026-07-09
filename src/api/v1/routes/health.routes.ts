import { Router } from "express";

const healthRouter = Router();

healthRouter.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Service is healthy",
    language: req.language,
    version: "v1",
    build: "attendance-v1",
    features: { attendance: true },
    timestamp: new Date().toISOString()
  });
});

export { healthRouter };
