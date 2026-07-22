import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";

const PREFIX = "enc:v1:";

function getEncryptionKey(): Buffer {
  const raw = env.tokenEncryptionKey.trim();
  if (!raw) {
    throw new HttpError(
      500,
      "TOKEN_ENCRYPTION_KEY is not configured. Set a 64-char hex (32-byte) key before connecting Gmail."
    );
  }

  // Accept 64-char hex or any passphrase (hashed to 32 bytes).
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  return createHash("sha256").update(raw).digest();
}

/** Encrypt a Gmail refresh token for DB storage (AES-256-GCM). */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

/**
 * Decrypt a stored secret. Plaintext values without the enc:v1: prefix are
 * returned as-is so a one-time re-encrypt can happen on next connect/sync write.
 */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) {
    return stored;
  }

  const key = getEncryptionKey();
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new HttpError(500, "Stored Gmail token is corrupted");
  }

  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function isEncryptedSecret(stored: string): boolean {
  return stored.startsWith(PREFIX);
}
