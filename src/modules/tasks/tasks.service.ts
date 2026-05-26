import { HttpError } from "../../utils/httpError";
import {
  fetchInstagramTaskStatsFromApify,
  isInstagramUrl,
  type InstagramTaskStats
} from "./tasks.apify";
import {
  createTask as createTaskInDb,
  findTaskById,
  findTasks,
  updateTask as updateTaskInDb,
  deleteTask as deleteTaskInDb
} from "./tasks.repository";

const VALID_TYPES = ["CONTENT_CREATION", "TEAM_MANAGEMENT", "GENERAL"] as const;
const VALID_PLATFORMS = ["YOUTUBE", "INSTAGRAM", "LINKEDIN", "FACEBOOK"] as const;
const VALID_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

type TaskMetadataRecord = Record<string, unknown>;

function tryParseMetadataObject(raw: string): TaskMetadataRecord | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as TaskMetadataRecord;
    }
  } catch {
    // Existing metadata may be plain text; keep it as notes.
  }
  return null;
}

function buildTaskMetadata(options: {
  existing?: string;
  instagramStats?: InstagramTaskStats | null;
  instagramStatsError?: string;
}): string | undefined {
  const { existing, instagramStats, instagramStatsError } = options;

  if (!existing && !instagramStats && !instagramStatsError) {
    return undefined;
  }

  const base = existing
    ? tryParseMetadataObject(existing) ?? { notes: existing }
    : ({} as TaskMetadataRecord);

  if (instagramStats) {
    base.instagramStats = instagramStats;
  }
  if (instagramStatsError) {
    base.instagramStatsError = instagramStatsError;
  }

  return JSON.stringify(base);
}

function parseOptionalDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `Invalid date: ${value}`);
  }
  return parsed;
}

export async function createTask(
  userId: string,
  data: {
    title: string;
    description?: string;
    type?: string;
    platform?: string;
    contentUrl?: string;
    metadata?: string;
    dueDate?: string;
  }
) {
  const type = (data.type ?? "GENERAL").toUpperCase();
  if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    throw new HttpError(400, `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`);
  }

  const platform = data.platform?.toUpperCase();
  if (platform && !VALID_PLATFORMS.includes(platform as (typeof VALID_PLATFORMS)[number])) {
    throw new HttpError(400, `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`);
  }

  let instagramStats: InstagramTaskStats | null = null;
  let instagramStatsError: string | undefined;
  if (type === "CONTENT_CREATION" && data.contentUrl && isInstagramUrl(data.contentUrl)) {
    const result = await fetchInstagramTaskStatsFromApify(data.contentUrl);
    instagramStats = result.stats;
    instagramStatsError = result.error;
  }

  const metadata = buildTaskMetadata({
    existing: data.metadata,
    instagramStats,
    instagramStatsError
  });

  const task = await createTaskInDb({
    userId,
    title: data.title,
    description: data.description,
    type,
    platform: platform ?? undefined,
    contentUrl: data.contentUrl,
    metadata,
    dueDate: parseOptionalDate(data.dueDate)
  });

  return task;
}

export async function getTaskById(id: string) {
  const task = await findTaskById(id);
  if (!task) throw new HttpError(404, "Task not found");
  return task;
}

export async function listTasks(options: {
  userId?: string;
  status?: string;
  type?: string;
  platform?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 20));

  const { items, total } = await findTasks({
    userId: options.userId,
    status: options.status?.toUpperCase(),
    type: options.type?.toUpperCase(),
    platform: options.platform?.toUpperCase(),
    from: parseOptionalDate(options.from),
    to: parseOptionalDate(options.to),
    page,
    pageSize
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items,
    pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages }
  };
}

export async function updateTask(
  id: string,
  data: {
    title?: string;
    description?: string;
    type?: string;
    platform?: string;
    contentUrl?: string;
    status?: string;
    metadata?: string;
    dueDate?: string | null;
  }
) {
  const task = await getTaskById(id);

  const updateData: Record<string, unknown> = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.contentUrl !== undefined) updateData.contentUrl = data.contentUrl;
  if (data.metadata !== undefined) updateData.metadata = data.metadata;

  if (data.type !== undefined) {
    const type = data.type.toUpperCase();
    if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
      throw new HttpError(400, `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`);
    }
    updateData.type = type;
  }

  if (data.platform !== undefined) {
    const platform = data.platform.toUpperCase();
    if (!VALID_PLATFORMS.includes(platform as (typeof VALID_PLATFORMS)[number])) {
      throw new HttpError(400, `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`);
    }
    updateData.platform = platform;
  }

  if (data.status !== undefined) {
    const status = data.status.toUpperCase();
    if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      throw new HttpError(400, `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
    }
    updateData.status = status;
    if (status === "COMPLETED" && task.status !== "COMPLETED") {
      updateData.completedAt = new Date();
    }
    if (status !== "COMPLETED") {
      updateData.completedAt = null;
    }
  }

  if (data.dueDate !== undefined) {
    updateData.dueDate = data.dueDate ? parseOptionalDate(data.dueDate) : null;
  }

  return updateTaskInDb(id, updateData as Parameters<typeof updateTaskInDb>[1]);
}

export async function removeTask(id: string) {
  await getTaskById(id);
  return deleteTaskInDb(id);
}
