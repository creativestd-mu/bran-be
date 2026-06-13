import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";

function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^\w.\-()+ ]/g, "_");
  return base.length > 0 ? base : "recording";
}

function extensionForMime(mimetype: string, originalname: string): string {
  const fromName = path.extname(originalname);
  if (fromName) return fromName.toLowerCase();

  const map: Record<string, string> = {
    "audio/webm": ".webm",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a"
  };
  return map[mimetype.toLowerCase()] ?? ".bin";
}

export function saveVoiceRecordingFile(params: {
  userId: string;
  recordingId: string;
  fileBuffer: Buffer;
  originalname: string;
  mimetype: string;
}): string {
  const ext = extensionForMime(params.mimetype, params.originalname);
  const safeName = `${params.recordingId}${ext}`;
  const relativeDir = path.join(params.userId, params.recordingId);
  const absoluteDir = path.join(env.audioStorageDir, relativeDir);

  fs.mkdirSync(absoluteDir, { recursive: true });
  const absolutePath = path.join(absoluteDir, safeName);
  fs.writeFileSync(absolutePath, params.fileBuffer);

  return path.join(relativeDir, safeName);
}

export function resolveVoiceRecordingAbsolutePath(storagePath: string): string {
  const absolutePath = path.resolve(env.audioStorageDir, storagePath);
  const storageRoot = path.resolve(env.audioStorageDir);

  if (!absolutePath.startsWith(storageRoot + path.sep) && absolutePath !== storageRoot) {
    throw new HttpError(400, "Invalid audio storage path");
  }

  if (!fs.existsSync(absolutePath)) {
    throw new HttpError(404, "Audio file not found");
  }

  return absolutePath;
}

export function newRecordingId(): string {
  return randomUUID();
}

export function displayFilename(originalFilename: string): string {
  return sanitizeFilename(originalFilename);
}
