import { Router } from "express";

import { v1Router } from "../api/v1/routes";
import { validateLanguage } from "../middlewares/validateLanguage";

const apiRouter = Router();

apiRouter.use("/:lang/v1", validateLanguage, v1Router);

export { apiRouter };
