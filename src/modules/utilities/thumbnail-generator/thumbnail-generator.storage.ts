import path from "node:path";

import {
  openStoredFileReadStream,
  saveStoredFile
} from "../../../lib/file-storage";
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

export async function saveReferenceThumbnail(params: {
  generationId: string;
  index: number;
  fileBuffer: Buffer;
  originalname: string;
  mimetype: string;
}): Promise<string> {
  if (!isSupportedThumbnailMime(params.mimetype)) {
    throw new HttpError(400, `Unsupported image format: ${params.mimetype}`);
  }

  const ext = extensionForMime(params.mimetype, params.originalname);
  const filename = `ref-${params.index}${ext}`;
  const relativePath = path.join(params.generationId, "references", filename);

  return saveStoredFile({
    root: "thumbnails",
    relativePath,
    buffer: params.fileBuffer,
    contentType: params.mimetype
  });
}

export async function saveGeneratedThumbnail(params: {
  generationId: string;
  fileBuffer: Buffer;
  mimetype: string;
}): Promise<string> {
  const ext = extensionForMime(params.mimetype, "generated.png");
  const filename = `generated${ext}`;
  const relativePath = path.join(params.generationId, filename);

  return saveStoredFile({
    root: "thumbnails",
    relativePath,
    buffer: params.fileBuffer,
    contentType: params.mimetype
  });
}

export function openThumbnailReadStream(storagePath: string) {
  return openStoredFileReadStream("thumbnails", storagePath);
}
