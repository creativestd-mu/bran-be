import path from "node:path";
import { randomUUID } from "node:crypto";

import { saveStoredFile, openStoredFileReadStream, deleteStoredFile } from "../../lib/file-storage";
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

export async function saveVoiceRecordingFile(params: {
  userId: string;
  recordingId: string;
  fileBuffer: Buffer;
  originalname: string;
  mimetype: string;
}): Promise<string> {
  const ext = extensionForMime(params.mimetype, params.originalname);
  const safeName = `${params.recordingId}${ext}`;
  const relativePath = path.join(params.userId, params.recordingId, safeName);

  return saveStoredFile({
    root: "audio",
    relativePath,
    buffer: params.fileBuffer,
    contentType: params.mimetype
  });
}

export function openVoiceRecordingReadStream(storagePath: string) {
  return openStoredFileReadStream("audio", storagePath);
}

export function newRecordingId(): string {
  return randomUUID();
}

export function displayFilename(originalFilename: string): string {
  return sanitizeFilename(originalFilename);
}
