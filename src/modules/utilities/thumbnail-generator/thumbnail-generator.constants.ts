export const REQUIRED_REFERENCE_COUNT = 5;
export const MAX_THUMBNAIL_FILE_BYTES = 10 * 1024 * 1024;

export const SUPPORTED_THUMBNAIL_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp"
]);

export function isSupportedThumbnailMime(mimetype: string): boolean {
  return SUPPORTED_THUMBNAIL_MIMES.has(mimetype.toLowerCase());
}
