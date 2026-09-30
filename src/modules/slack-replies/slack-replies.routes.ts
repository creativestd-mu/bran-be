import { Router } from "express";

import { authenticate } from "../auth/auth.middleware";
import {
  disconnectSlackReplies,
  getSlackReplyConnectionStatus,
  startSlackReplyConnect,
  syncSlackRepliesForUser
} from "./slack-replies.service";

const slackRepliesRouter = Router();
slackRepliesRouter.use(authenticate);

slackRepliesRouter.post("/connect", async (req, res, next) => {
  try { res.json({ success: true, data: await startSlackReplyConnect(req.user!.userId) }); }
  catch (error) { next(error); }
});
slackRepliesRouter.get("/status", async (req, res, next) => {
  try { res.json({ success: true, data: await getSlackReplyConnectionStatus(req.user!.userId) }); }
  catch (error) { next(error); }
});
slackRepliesRouter.post("/sync", async (req, res, next) => {
  try { res.json({ success: true, data: { pending: await syncSlackRepliesForUser(req.user!.userId) } }); }
  catch (error) { next(error); }
});
slackRepliesRouter.delete("/", async (req, res, next) => {
  try { res.json({ success: true, data: await disconnectSlackReplies(req.user!.userId) }); }
  catch (error) { next(error); }
});

export { slackRepliesRouter };
