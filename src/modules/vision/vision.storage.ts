import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { PDFParse } from "pdf-parse";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { isSupportedVisionMime } from "./vision.constants";

function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^\w.\-()+ ]/g, "_");
  return base.length > 0 ? base : "document";
}

function extensionForMime(mimetype: string, originalname: string): string {
  const fromName = path.extname(originalname);
  if (fromName) return fromName.toLowerCase();

  const map: Record<string, string> = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "text/plain": ".txt",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp"
  };
  return map[mimetype.toLowerCase()] ?? ".bin";
}

export function saveVisionDocument(params: {
  visionId: string;
  fileBuffer: Buffer;
  originalname: string;
  mimetype: string;
}): string {
  if (!isSupportedVisionMime(params.mimetype)) {
    throw new HttpError(400, `Unsupported document format: ${params.mimetype}`);
  }

  const ext = extensionForMime(params.mimetype, params.originalname);
  const safeName = `${params.visionId}${ext}`;
  const relativeDir = params.visionId;
  const absoluteDir = path.join(env.visionStorageDir, relativeDir);

  fs.mkdirSync(absoluteDir, { recursive: true });
  const absolutePath = path.join(absoluteDir, safeName);
  fs.writeFileSync(absolutePath, params.fileBuffer);

  return path.join(relativeDir, safeName);
}

export function resolveVisionDocumentAbsolutePath(storagePath: string): string {
  const absolutePath = path.resolve(env.visionStorageDir, storagePath);
  const storageRoot = path.resolve(env.visionStorageDir);

  if (!absolutePath.startsWith(storageRoot + path.sep) && absolutePath !== storageRoot) {
    throw new HttpError(400, "Invalid vision document path");
  }

  if (!fs.existsSync(absolutePath)) {
    throw new HttpError(404, "Vision document not found");
  }

  return absolutePath;
}

export function deleteVisionDocument(storagePath: string): void {
  try {
    const absolutePath = resolveVisionDocumentAbsolutePath(storagePath);
    fs.unlinkSync(absolutePath);
    const dir = path.dirname(absolutePath);
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  } catch {
    // Best-effort cleanup when the file is already gone.
  }
}

export function newVisionId(): string {
  return randomUUID();
}

export function displayFilename(originalFilename: string): string {
  return sanitizeFilename(originalFilename);
}

const MAX_DOCUMENT_TEXT_FOR_AI = 6000;

function trimForAi(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_DOCUMENT_TEXT_FOR_AI
    ? `${trimmed.slice(0, MAX_DOCUMENT_TEXT_FOR_AI)}…`
    : trimmed;
}

async function readPlainTextFile(absolutePath: string): Promise<string | null> {
  const text = fs.readFileSync(absolutePath, "utf8");
  return trimForAi(text);
}

async function readPdfText(absolutePath: string): Promise<string | null> {
  const buffer = fs.readFileSync(absolutePath);
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return trimForAi(result.text);
  } finally {
    await parser.destroy();
  }
}

export async function readVisionDocumentText(
  storagePath: string,
  mimeType: string
): Promise<string | null> {
  try {
    const absolutePath = resolveVisionDocumentAbsolutePath(storagePath);
    const mime = mimeType.toLowerCase();

    if (mime === "text/plain") {
      return await readPlainTextFile(absolutePath);
    }

    if (mime === "application/pdf") {
      return await readPdfText(absolutePath);
    }

    return null;
  } catch {
    return null;
  }
}
