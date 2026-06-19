import { HttpError } from "../../utils/httpError";
import { endOfDayInTimezone, startOfDayInTimezone } from "../../utils/timezone";
import {
  effectiveReservationStatus,
  markOverdueReservations,
  refreshInventoryItemStatus,
  resolveShootReservationWindow
} from "./inventory.reservations";
import {
  countActiveReservationsForItem,
  createInventoryItem,
  deleteInventoryItem,
  findBusyInventoryItemIds,
  findInventoryItemById,
  findInventoryItems,
  findReservationById,
  findReservations,
  replaceInventoryItemTeams,
  returnReservation as returnReservationInDb,
  teamExists,
  updateInventoryItem
} from "./inventory.repository";

function formatTeamAssignment(row: {
  teamId: string;
  isPrimary: boolean;
  assignedAt: Date;
  team: { id: string; name: string; verticalId: string; isActive: boolean };
}) {
  return {
    teamId: row.teamId,
    isPrimary: row.isPrimary,
    assignedAt: row.assignedAt.toISOString(),
    team: row.team
  };
}

function formatReservation(row: Awaited<ReturnType<typeof findReservationById>>) {
  if (!row) return null;

  const status = effectiveReservationStatus(row);

  return {
    id: row.id,
    status,
    reservedFrom: row.reservedFrom.toISOString(),
    dueBackAt: row.dueBackAt.toISOString(),
    returnedAt: row.returnedAt?.toISOString() ?? null,
    notes: row.notes,
    item: row.item,
    node: {
      ...row.node,
      startsAt: row.node.startsAt?.toISOString() ?? null,
      dueDate: row.node.dueDate?.toISOString() ?? null
    },
    resource: row.resource,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function formatInventoryItem(row: NonNullable<Awaited<ReturnType<typeof findInventoryItemById>>>) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    serialNumber: row.serialNumber,
    status: row.status,
    isActive: row.isActive,
    teams: row.teams.map(formatTeamAssignment),
    activeReservations: row.reservations.map((reservation) => ({
      id: reservation.id,
      status: effectiveReservationStatus(reservation),
      reservedFrom: reservation.reservedFrom.toISOString(),
      dueBackAt: reservation.dueBackAt.toISOString(),
      node: {
        id: reservation.node.id,
        name: reservation.node.name,
        startsAt: reservation.node.startsAt?.toISOString() ?? null,
        dueDate: reservation.node.dueDate?.toISOString() ?? null,
        content: reservation.node.content
      }
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

async function validateTeamIds(teamIds: string[], primaryTeamId?: string | null) {
  for (const teamId of teamIds) {
    if (!(await teamExists(teamId))) {
      throw new HttpError(404, `Team not found: ${teamId}`);
    }
  }
  if (primaryTeamId && !teamIds.includes(primaryTeamId)) {
    throw new HttpError(400, "primaryTeamId must be one of teamIds");
  }
}

export async function createInventoryItemService(input: {
  name: string;
  description?: string;
  category?: string;
  serialNumber?: string;
  status?: string;
  isActive?: boolean;
  teamIds?: string[];
  primaryTeamId?: string;
}) {
  if (input.teamIds?.length) {
    await validateTeamIds(input.teamIds, input.primaryTeamId);
  }

  const row = await createInventoryItem(input);
  return formatInventoryItem(row!);
}

export async function getInventoryItemById(id: string) {
  const row = await findInventoryItemById(id);
  if (!row) throw new HttpError(404, "Inventory item not found");
  return formatInventoryItem(row);
}

export async function listInventoryItems(options: {
  teamId?: string;
  category?: string;
  status?: string;
  isActive?: boolean;
  availableOn?: string;
  page?: number;
  pageSize?: number;
}) {
  await markOverdueReservations();

  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;

  let excludeItemIds: string[] | undefined;
  if (options.availableOn) {
    const anchor = new Date(options.availableOn);
    const from = startOfDayInTimezone(anchor);
    const to = endOfDayInTimezone(anchor);
    excludeItemIds = await findBusyInventoryItemIds(from, to);
  }

  const { items, total } = await findInventoryItems({
    teamId: options.teamId,
    category: options.category,
    status: options.status,
    isActive: options.isActive,
    page,
    pageSize,
    excludeItemIds
  });

  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    items: items.map(formatInventoryItem),
    pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages }
  };
}

export async function updateInventoryItemService(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    category?: string | null;
    serialNumber?: string | null;
    status?: string;
    isActive?: boolean;
    teamIds?: string[];
    primaryTeamId?: string | null;
  }
) {
  await getInventoryItemById(id);

  if (input.teamIds) {
    await validateTeamIds(input.teamIds, input.primaryTeamId ?? undefined);
    await replaceInventoryItemTeams(id, input.teamIds, input.primaryTeamId);
  }

  const row = await updateInventoryItem(id, {
    name: input.name,
    description: input.description,
    category: input.category,
    serialNumber: input.serialNumber,
    status: input.status,
    isActive: input.isActive
  });

  return formatInventoryItem(row!);
}

export async function assignTeamsToInventoryItem(
  id: string,
  teamIds: string[],
  primaryTeamId?: string
) {
  await getInventoryItemById(id);
  await validateTeamIds(teamIds, primaryTeamId);
  const row = await replaceInventoryItemTeams(id, teamIds, primaryTeamId);
  return formatInventoryItem(row!);
}

export async function removeInventoryItem(id: string) {
  await getInventoryItemById(id);

  const active = await countActiveReservationsForItem(id);
  if (active > 0) {
    throw new HttpError(409, "Cannot delete equipment with active shoot reservations");
  }

  await deleteInventoryItem(id);
}

export async function listInventoryReservations(options: {
  inventoryItemId?: string;
  contentNodeId?: string;
  status?: string;
  overdueOnly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  await markOverdueReservations();

  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;

  const { items, total } = await findReservations({
    inventoryItemId: options.inventoryItemId,
    contentNodeId: options.contentNodeId,
    status: options.status,
    overdueOnly: options.overdueOnly,
    page,
    pageSize
  });

  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    items: items.map((row) => formatReservation(row)!),
    pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages }
  };
}

export async function getInventoryReservationById(id: string) {
  const row = await findReservationById(id);
  if (!row) throw new HttpError(404, "Reservation not found");
  return formatReservation(row)!;
}

export async function returnInventoryReservation(id: string, notes?: string) {
  const existing = await findReservationById(id);
  if (!existing) throw new HttpError(404, "Reservation not found");
  if (existing.returnedAt || existing.status === "RETURNED") {
    throw new HttpError(409, "Equipment already returned");
  }

  const row = await returnReservationInDb(id, notes);
  await refreshInventoryItemStatus(existing.inventoryItemId);
  return formatReservation(row)!;
}

export { resolveShootReservationWindow };
