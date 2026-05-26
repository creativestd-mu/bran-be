import { Router } from "express";
import { z } from "zod";

import { googleSignIn, emailPasswordLogin } from "./auth.service";

const authRouter = Router();

const googleSignInSchema = z.object({
  idToken: z.string().min(1, "idToken is required")
});

authRouter.post("/google", async (req, res, next) => {
  try {
    const { idToken } = googleSignInSchema.parse(req.body);
    const result = await googleSignIn(idToken);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required")
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await emailPasswordLogin(email, password);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export { authRouter };
