const ASSIGNMENT_CONTEXT_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 200;

const assignmentContextCache = new Map<string, { value: unknown; expiresAt: number }>();

export function invalidateAssignmentContextCache(): void {
  assignmentContextCache.clear();
}

export function getCachedAssignmentContext<T>(userId: string): T | null {
  const entry = assignmentContextCache.get(userId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    assignmentContextCache.delete(userId);
    return null;
  }
  return entry.value as T;
}

export function setCachedAssignmentContext<T>(userId: string, value: T): void {
  if (assignmentContextCache.size >= MAX_ENTRIES) {
    const oldest = assignmentContextCache.keys().next().value;
    if (oldest !== undefined) assignmentContextCache.delete(oldest);
  }
  assignmentContextCache.set(userId, {
    value,
    expiresAt: Date.now() + ASSIGNMENT_CONTEXT_TTL_MS
  });
}
