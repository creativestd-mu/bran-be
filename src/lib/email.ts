import nodemailer, { Transporter } from "nodemailer";

import { env } from "../config/env";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  if (!env.smtp.host) return null;

  cachedTransporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user
      ? { user: env.smtp.user, pass: env.smtp.password }
      : undefined
  });
  return cachedTransporter;
}

export function isEmailConfigured(): boolean {
  return !!env.smtp.host;
}

/**
 * Best-effort send. When SMTP isn't configured we just log and resolve so
 * callers (notification fan-out) don't have to special-case anything.
 *
 * Returns `true` only when an SMTP transport was used and accepted the message.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    if (env.nodeEnv !== "test") {
      console.info(
        `[email] SMTP not configured; skipping email to ${message.to} ("${message.subject}")`
      );
    }
    return false;
  }

  try {
    await transporter.sendMail({
      from: env.smtp.from || env.smtp.user,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html
    });
    return true;
  } catch (error) {
    console.error(`[email] Failed to send email to ${message.to}:`, error);
    return false;
  }
}
