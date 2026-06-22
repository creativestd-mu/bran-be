import path from "node:path";
import { randomUUID } from "node:crypto";

import { PDFParse } from "pdf-parse";

import {
  deleteStoredFile,
  openStoredFileReadStream,
  readStoredFileBuffer,
  saveStoredFile
} from "../../lib/file-storage";
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

export async function saveVisionDocument(params: {
  visionId: string;
  fileBuffer: Buffer;
  originalname: string;
  mimetype: string;
}): Promise<string> {
  if (!isSupportedVisionMime(params.mimetype)) {
    throw new HttpError(400, `Unsupported document format: ${params.mimetype}`);
  }

  const ext = extensionForMime(params.mimetype, params.originalname);
  const safeName = `${params.visionId}${ext}`;
  const relativePath = path.join(params.visionId, safeName);

  return saveStoredFile({
    root: "visions",
    relativePath,
    buffer: params.fileBuffer,
    contentType: params.mimetype
  });
}

export function openVisionDocumentReadStream(storagePath: string) {
  return openStoredFileReadStream("visions", storagePath);
}

export async function deleteVisionDocument(storagePath: string): Promise<void> {
  await deleteStoredFile("visions", storagePath);
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

async function readPlainTextBuffer(buffer: Buffer): Promise<string | null> {
  return trimForAi(buffer.toString("utf8"));
}

async function readPdfText(buffer: Buffer): Promise<string | null> {
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
    const buffer = await readStoredFileBuffer("visions", storagePath);
    const mime = mimeType.toLowerCase();

    if (mime === "text/plain") {
      return await readPlainTextBuffer(buffer);
    }

    if (mime === "application/pdf") {
      return await readPdfText(buffer);
    }

    return null;
  } catch {
    return null;
  }
}
