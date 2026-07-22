import { Router } from "express";

import { authenticate } from "../auth/auth.middleware";
import { listGmailMessagesQuerySchema } from "./gmail.schemas";
import {
  disconnectGmail,
  getGmailStatus,
  listGmailMessages,
  startGmailConnect,
  syncGmailForUser
} from "./gmail.service";

const gmailRouter = Router();

gmailRouter.use(authenticate);

gmailRouter.post("/connect", async (req, res, next) => {
  try {
    const result = await startGmailConnect(req.user!.userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

gmailRouter.get("/status", async (req, res, next) => {
  try {
    const result = await getGmailStatus(req.user!.userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

gmailRouter.post("/sync", async (req, res, next) => {
  try {
    const result = await syncGmailForUser(req.user!.userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

gmailRouter.delete("/", async (req, res, next) => {
  try {
    const result = await disconnectGmail(req.user!.userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

gmailRouter.get("/messages", async (req, res, next) => {
  try {
    const query = listGmailMessagesQuerySchema.parse(req.query);
    const result = await listGmailMessages(req.user!.userId, query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export { gmailRouter };
