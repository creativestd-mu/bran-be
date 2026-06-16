import fs from "node:fs";
import path from "node:path";

import { env } from "../../../config/env";
import { HttpError } from "../../../utils/httpError";
import { isSupportedThumbnailMime } from "./thumbnail-generator.constants";

function extensionForMime(mimetype: string, originalname: string): string {
  const fromName = path.extname(originalname);
  if (fromName) return fromName.toLowerCase();

  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
  };
  return map[mimetype.toLowerCase()] ?? ".img";
}

export function saveReferenceThumbnail(params: {
  generationId: string;
  index: number;
  fileBuffer: Buffer;
  originalname: string;
  mimetype: string;
}): string {
  if (!isSupportedThumbnailMime(params.mimetype)) {
    throw new HttpError(400, `Unsupported image format: ${params.mimetype}`);
  }

  const ext = extensionForMime(params.mimetype, params.originalname);
  const relativeDir = params.generationId;
  const absoluteDir = path.join(env.thumbnailStorageDir, relativeDir, "references");

  fs.mkdirSync(absoluteDir, { recursive: true });
  const filename = `ref-${params.index}${ext}`;
  const absolutePath = path.join(absoluteDir, filename);
  fs.writeFileSync(absolutePath, params.fileBuffer);

  return path.join(relativeDir, "references", filename);
}

export function saveGeneratedThumbnail(params: {
  generationId: string;
  fileBuffer: Buffer;
  mimetype: string;
}): string {
  const ext = extensionForMime(params.mimetype, "generated.png");
  const relativeDir = params.generationId;
  const absoluteDir = path.join(env.thumbnailStorageDir, relativeDir);

  fs.mkdirSync(absoluteDir, { recursive: true });
  const filename = `generated${ext}`;
  const absolutePath = path.join(absoluteDir, filename);
  fs.writeFileSync(absolutePath, params.fileBuffer);

  return path.join(relativeDir, filename);
}

export function resolveThumbnailAbsolutePath(storagePath: string): string {
  const absolutePath = path.resolve(env.thumbnailStorageDir, storagePath);
  const storageRoot = path.resolve(env.thumbnailStorageDir);

  if (!absolutePath.startsWith(storageRoot + path.sep) && absolutePath !== storageRoot) {
    throw new HttpError(400, "Invalid storage path");
  }

  if (!fs.existsSync(absolutePath)) {
    throw new HttpError(404, "File not found");
  }

  return absolutePath;
}
