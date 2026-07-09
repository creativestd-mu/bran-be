import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { handleRecallWebhookEvent } from "./meetings.service";

function getSvixSecretBytes(secret: string): Buffer {
  const raw = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  return Buffer.from(raw, "base64");
}

export function verifySvixWebhook(
  payload: string,
  headers: {
    "svix-id"?: string;
    "svix-timestamp"?: string;
    "svix-signature"?: string;
  },
  secret: string
): boolean {
  const svixId = headers["svix-id"];
  const svixTimestamp = headers["svix-timestamp"];
  const svixSignature = headers["svix-signature"];

  if (!svixId || !svixTimestamp || !svixSignature || !secret) {
    return false;
  }

  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  const secretBytes = getSvixSecretBytes(secret);

  for (const versionedSig of svixSignature.split(" ")) {
    const [version, signature] = versionedSig.split(",");
    if (version !== "v1" || !signature) continue;

    const expected = crypto
      .createHmac("sha256", secretBytes)
      .update(signedContent)
      .digest("base64");

    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);
    if (
      expectedBuffer.length === signatureBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      return true;
    }
  }

  return false;
}

export async function recallWebhookHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawBody =
      req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body ?? {});

    if (env.recallWebhookSecret) {
      const valid = verifySvixWebhook(
        rawBody,
        {
          "svix-id": req.header("svix-id") ?? undefined,
          "svix-timestamp": req.header("svix-timestamp") ?? undefined,
          "svix-signature": req.header("svix-signature") ?? undefined
        },
        env.recallWebhookSecret
      );

      if (!valid) {
        throw new HttpError(401, "Invalid Recall webhook signature");
      }
    }

    const payload = JSON.parse(rawBody) as {
      event?: string;
      data?: Record<string, unknown>;
    };
    void handleRecallWebhookEvent(payload).catch((error) => {
      console.error("Recall webhook processing failed:", error);
    });

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}
