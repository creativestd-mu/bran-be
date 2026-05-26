import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import { notFoundHandler } from "./middlewares/notFound";
import { apiRouter } from "./routes";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
if (env.nodeEnv !== "test") {
  app.use(morgan("dev"));
}

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend service is running"
  });
});

app.use(apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
