export const PREREAD_NODE_KINDS = ["output", "blocker", "advice"] as const;
export type PrereadNodeKind = (typeof PREREAD_NODE_KINDS)[number];

export const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

export const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime"
]);

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function isSupportedPrereadMediaMime(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType) || VIDEO_MIME_TYPES.has(mimeType);
}

export function maxBytesForMime(mimeType: string): number {
  if (IMAGE_MIME_TYPES.has(mimeType)) return MAX_IMAGE_BYTES;
  if (VIDEO_MIME_TYPES.has(mimeType)) return MAX_VIDEO_BYTES;
  return 0;
}

export function isImageMime(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType);
}

export function isVideoMime(mimeType: string): boolean {
  return VIDEO_MIME_TYPES.has(mimeType);
}
