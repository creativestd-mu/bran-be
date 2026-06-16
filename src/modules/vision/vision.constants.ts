export const VISION_HORIZONS = ["SHORT_TERM", "LONG_TERM"] as const;
export const VISION_SCOPES = ["ALL", "SPECIFIC"] as const;

export type VisionHorizon = (typeof VISION_HORIZONS)[number];
export type VisionScope = (typeof VISION_SCOPES)[number];

export const MIN_VISION_DURATION_MONTHS = 1;
export const MAX_VISION_DURATION_MONTHS = 24;

export const MAX_VISION_FILE_BYTES = 25 * 1024 * 1024;

export const SUPPORTED_VISION_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp"
]);

export function isSupportedVisionMime(mimetype: string): boolean {
  return SUPPORTED_VISION_MIMES.has(mimetype.toLowerCase());
}
