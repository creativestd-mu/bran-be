import { HttpError } from "../../utils/httpError";
import {
  createUserKpi as createUserKpiInDb,
  createManyUserKpis as createManyUserKpisInDb,
  deleteUserKpi as deleteUserKpiInDb,
  findUserKpiById,
  findUserKpis,
  updateUserKpi as updateUserKpiInDb,
  userExists
} from "./kpi.repository";

const KPI_MANAGER_ROLES = new Set(["admin", "chief_of_staff"]);

export function canManageUserKpis(roleName: string): boolean {
  return KPI_MANAGER_ROLES.has(roleName);
}

export function assertCanManageUserKpis(roleName: string): void {
  if (!canManageUserKpis(roleName)) {
    throw new HttpError(403, "Only admin or chief of staff can manage user KPIs");
  }
}

export function assertCanViewUserKpi(
  kpi: { userId: string },
  viewerUserId: string,
  roleName: string
): void {
  if (canManageUserKpis(roleName)) return;
  if (kpi.userId !== viewerUserId) {
    throw new HttpError(403, "Not authorized to view this KPI");
  }
}

export async function createUserKpi(
  createdById: string,
  data: {
    userId: string;
    title: string;
    description: string;
    sortOrder?: number;
    isActive?: boolean;
    isKey?: boolean;
  }
) {
  if (!(await userExists(data.userId))) {
    throw new HttpError(404, "User not found");
  }

  return createUserKpiInDb({
    ...data,
    createdById
  });
}

export async function batchCreateUserKpis(
  createdById: string,
  data: {
    userId: string;
    items: Array<{
      title: string;
      description: string;
      sortOrder?: number;
      isActive?: boolean;
      isKey?: boolean;
    }>;
  }
) {
  if (!(await userExists(data.userId))) {
    throw new HttpError(404, "User not found");
  }

  return createManyUserKpisInDb(
    data.items.map((item) => ({
      ...item,
      userId: data.userId,
      createdById
    }))
  );
}

export async function getUserKpiById(id: string) {
  const kpi = await findUserKpiById(id);
  if (!kpi) throw new HttpError(404, "KPI not found");
  return kpi;
}

export async function listUserKpis(options: {
  viewerUserId: string;
  viewerRole: string;
  userId?: string;
  isActive?: boolean;
  isKey?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 20));

  const filterUserId = canManageUserKpis(options.viewerRole)
    ? options.userId
    : options.viewerUserId;

  const { items, total } = await findUserKpis({
    userId: filterUserId,
    isActive: options.isActive,
    isKey: options.isKey,
    page,
    pageSize
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items,
    pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages }
  };
}

export async function updateUserKpi(
  id: string,
  data: {
    title?: string;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
    isKey?: boolean;
  }
) {
  await getUserKpiById(id);
  return updateUserKpiInDb(id, data);
}

export async function removeUserKpi(id: string) {
  await getUserKpiById(id);
  await deleteUserKpiInDb(id);
}
