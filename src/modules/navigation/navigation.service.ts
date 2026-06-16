import {
  createNavSearchLog,
  findMostVisitedPages,
  upsertPageVisit
} from "./navigation.repository";

export function formatPageVisit(row: {
  path: string;
  visitCount: number;
  lastVisitedAt: Date;
}) {
  return {
    path: row.path,
    visitCount: row.visitCount,
    lastVisitedAt: row.lastVisitedAt.toISOString()
  };
}

export async function getMostVisitedPages(userId: string) {
  const rows = await findMostVisitedPages(userId);
  return rows.map(formatPageVisit);
}

export async function logNavSearch(
  userId: string,
  input: { query: string; selectedPath?: string }
) {
  const row = await createNavSearchLog({
    userId,
    query: input.query,
    selectedPath: input.selectedPath
  });

  return {
    id: row.id,
    query: row.query,
    selectedPath: row.selectedPath,
    createdAt: row.createdAt.toISOString()
  };
}

export async function recordPageVisit(userId: string, path: string) {
  const row = await upsertPageVisit(userId, path);
  return formatPageVisit(row);
}
