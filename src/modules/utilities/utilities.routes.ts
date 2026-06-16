import { Router } from "express";

import { thumbnailGeneratorRouter } from "./thumbnail-generator/thumbnail-generator.routes";

const utilitiesRouter = Router();

utilitiesRouter.use("/thumbnail-generator", thumbnailGeneratorRouter);

export { utilitiesRouter };
