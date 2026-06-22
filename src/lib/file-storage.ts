import fs from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException
} from "@aws-sdk/client-s3";

import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

export type StorageRoot = "audio" | "visions" | "thumbnails";

const PLACEHOLDER_SECRETS = new Set(["your_s3_secret_access_key", ""]);

function localDirForRoot(root: StorageRoot): string {
  if (root === "audio") return env.audioStorageDir;
  if (root === "visions") return env.visionStorageDir;
  return env.thumbnailStorageDir;
}

function s3PrefixForRoot(root: StorageRoot): string {
  if (root === "audio") return env.s3AudioPrefix;
  if (root === "visions") return env.s3VisionPrefix;
  return env.s3ThumbnailPrefix;
}

function sanitizeRelativePath(relativePath: string): string {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  if (normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new HttpError(400, "Invalid storage path");
  }
  return normalized.split(path.sep).join("/");
}

function isS3Configured(): boolean {
  return (
    Boolean(env.s3Bucket && env.s3AccessKeyId && env.s3SecretAccessKey) &&
    !PLACEHOLDER_SECRETS.has(env.s3SecretAccessKey)
  );
}

let s3Client: S3Client | undefined;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.s3Region,
      endpoint: env.s3Endpoint || undefined,
      credentials: {
        accessKeyId: env.s3AccessKeyId,
        secretAccessKey: env.s3SecretAccessKey
      },
      forcePathStyle: env.s3ForcePathStyle
    });
  }
  return s3Client;
}

function objectKey(root: StorageRoot, relativePath: string): string {
  const rel = sanitizeRelativePath(relativePath);
  const prefix = s3PrefixForRoot(root).replace(/\/$/, "");
  return `${prefix}/${rel}`;
}

function localAbsolutePath(root: StorageRoot, relativePath: string): string {
  const rel = sanitizeRelativePath(relativePath);
  const storageRoot = path.resolve(localDirForRoot(root));
  const absolutePath = path.resolve(localDirForRoot(root), rel);

  if (!absolutePath.startsWith(storageRoot + path.sep) && absolutePath !== storageRoot) {
    throw new HttpError(400, "Invalid storage path");
  }

  return absolutePath;
}

export function isObjectStorageEnabled(): boolean {
  return isS3Configured();
}

function rethrowStorageError(error: unknown): never {
  if (error instanceof HttpError) {
    throw error;
  }

  if (
    error instanceof S3ServiceException &&
    (error.name === "NoSuchKey" || error.$metadata.httpStatusCode === 404)
  ) {
    throw new HttpError(404, "File not found");
  }

  throw error;
}

export async function saveStoredFile(params: {
  root: StorageRoot;
  relativePath: string;
  buffer: Buffer;
  contentType?: string;
}): Promise<string> {
  const relativePath = sanitizeRelativePath(params.relativePath);

  if (isS3Configured()) {
    try {
      await getS3Client().send(
        new PutObjectCommand({
          Bucket: env.s3Bucket,
          Key: objectKey(params.root, relativePath),
          Body: params.buffer,
          ContentType: params.contentType
        })
      );
    } catch (error) {
      rethrowStorageError(error);
    }
    return relativePath;
  }

  const absolutePath = localAbsolutePath(params.root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, params.buffer);
  return relativePath;
}

export async function readStoredFileBuffer(root: StorageRoot, relativePath: string): Promise<Buffer> {
  if (isS3Configured()) {
    try {
      const response = await getS3Client().send(
        new GetObjectCommand({
          Bucket: env.s3Bucket,
          Key: objectKey(root, relativePath)
        })
      );

      if (!response.Body) {
        throw new HttpError(404, "File not found");
      }

      return Buffer.from(await response.Body.transformToByteArray());
    } catch (error) {
      rethrowStorageError(error);
    }
  }

  const absolutePath = localAbsolutePath(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new HttpError(404, "File not found");
  }

  return fs.readFileSync(absolutePath);
}

export async function openStoredFileReadStream(
  root: StorageRoot,
  relativePath: string
): Promise<Readable> {
  if (isS3Configured()) {
    try {
      const response = await getS3Client().send(
        new GetObjectCommand({
          Bucket: env.s3Bucket,
          Key: objectKey(root, relativePath)
        })
      );

      if (!response.Body) {
        throw new HttpError(404, "File not found");
      }

      return response.Body as Readable;
    } catch (error) {
      rethrowStorageError(error);
    }
  }

  const absolutePath = localAbsolutePath(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new HttpError(404, "File not found");
  }

  return fs.createReadStream(absolutePath);
}

export async function deleteStoredFile(root: StorageRoot, relativePath: string): Promise<void> {
  try {
    if (isS3Configured()) {
      await getS3Client().send(
        new DeleteObjectCommand({
          Bucket: env.s3Bucket,
          Key: objectKey(root, relativePath)
        })
      );
      return;
    }

    const absolutePath = localAbsolutePath(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      return;
    }

    fs.unlinkSync(absolutePath);
    const dir = path.dirname(absolutePath);
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  } catch {
    // Best-effort cleanup when the file is already gone.
  }
}
