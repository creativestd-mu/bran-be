import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";

import { env } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import { notFoundHandler } from "./middlewares/notFound";
import { apiRouter } from "./routes";

const app = express();

// Serve admin tools before helmet so inline scripts are not blocked by CSP
app.get("/admin/ingestion", (_req, res) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src *; img-src *;"
  );
  res.sendFile(path.join(__dirname, "../tools/user-ingestion.html"));
});

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
