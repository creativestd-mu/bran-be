/**
 * Safely extract a route parameter as a string.
 * Express 5 types allow params to be string | string[]; single-segment
 * parameters (e.g. /:id) always produce a string at runtime.
 */
export function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}
