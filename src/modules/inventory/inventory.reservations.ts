import { prisma } from "../../lib/prisma";
import { HttpError } from "../../utils/httpError";
import { endOfDayInTimezone, startOfDayInTimezone } from "../../utils/timezone";
import { SHOOT_NODE_KIND } from "./inventory.constants";

type ShootNode = {
  id: string;
  kind: string;
  startsAt: Date | null;
  dueDate: Date | null;
};

export function resolveShootReservationWindow(node: ShootNode, now: Date = new Date()) {
  const anchor = node.startsAt ?? node.dueDate ?? now;

  return {
    reservedFrom: startOfDayInTimezone(anchor),
    dueBackAt: endOfDayInTimezone(anchor)
  };
}

export async function assertInventoryItemAvailable(
  inventoryItemId: string,
  reservedFrom: Date,
  dueBackAt: Date,
  excludeResourceId?: string
) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  if (!item || !item.isActive) {
    throw new HttpError(404, "Inventory item not found");
  }
  if (item.status === "RETIRED" || item.status === "MAINTENANCE") {
    throw new HttpError(409, `Equipment is ${item.status.toLowerCase()} and cannot be reserved`);
  }

  const overlap = await prisma.inventoryReservation.findFirst({
    where: {
      inventoryItemId,
      status: { in: ["ACTIVE", "OVERDUE"] },
      ...(excludeResourceId ? { contentNodeResourceId: { not: excludeResourceId } } : {}),
      reservedFrom: { lte: dueBackAt },
      dueBackAt: { gte: reservedFrom }
    },
    include: {
      node: { select: { name: true, kind: true } }
    }
  });

  if (overlap) {
    throw new HttpError(
      409,
      `Equipment is already reserved for ${overlap.node.name} until ${overlap.dueBackAt.toISOString()}`
    );
  }
}

export async function syncReservationForResource(input: {
  resourceId: string;
  node: ShootNode;
  inventoryItemId: string | null | undefined;
  createdById?: string;
}) {
  if (input.node.kind !== SHOOT_NODE_KIND) {
    if (!input.inventoryItemId) {
      await cancelReservationForResource(input.resourceId);
      return null;
    }
    throw new HttpError(409, "Inventory equipment can only be linked on SHOOT nodes");
  }

  if (!input.inventoryItemId) {
    await cancelReservationForResource(input.resourceId);
    return null;
  }

  const window = resolveShootReservationWindow(input.node);
  await assertInventoryItemAvailable(
    input.inventoryItemId,
    window.reservedFrom,
    window.dueBackAt,
    input.resourceId
  );

  const reservation = await prisma.inventoryReservation.upsert({
    where: { contentNodeResourceId: input.resourceId },
    create: {
      inventoryItemId: input.inventoryItemId,
      contentNodeId: input.node.id,
      contentNodeResourceId: input.resourceId,
      reservedFrom: window.reservedFrom,
      dueBackAt: window.dueBackAt,
      status: "ACTIVE",
      createdById: input.createdById ?? null
    },
    update: {
      inventoryItemId: input.inventoryItemId,
      contentNodeId: input.node.id,
      reservedFrom: window.reservedFrom,
      dueBackAt: window.dueBackAt,
      returnedAt: null,
      status: "ACTIVE"
    }
  });

  await refreshInventoryItemStatus(input.inventoryItemId);
  return reservation;
}

export async function cancelReservationForResource(resourceId: string) {
  const existing = await prisma.inventoryReservation.findUnique({
    where: { contentNodeResourceId: resourceId }
  });
  if (!existing) return;

  await prisma.inventoryReservation.update({
    where: { id: existing.id },
    data: { status: "CANCELLED", returnedAt: new Date() }
  });

  await refreshInventoryItemStatus(existing.inventoryItemId);
}

export async function syncReservationsForNode(nodeId: string) {
  const node = await prisma.contentNode.findUnique({
    where: { id: nodeId },
    include: {
      resources: {
        where: { inventoryItemId: { not: null } },
        select: { id: true, inventoryItemId: true }
      }
    }
  });

  if (!node || node.kind !== SHOOT_NODE_KIND) return;

  for (const resource of node.resources) {
    if (!resource.inventoryItemId) continue;
    await syncReservationForResource({
      resourceId: resource.id,
      node,
      inventoryItemId: resource.inventoryItemId
    });
  }
}

export async function refreshInventoryItemStatus(inventoryItemId: string) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  if (!item) return;

  if (item.status === "MAINTENANCE" || item.status === "RETIRED") return;

  const activeCount = await prisma.inventoryReservation.count({
    where: {
      inventoryItemId,
      status: { in: ["ACTIVE", "OVERDUE"] },
      returnedAt: null
    }
  });

  await prisma.inventoryItem.update({
    where: { id: inventoryItemId },
    data: { status: activeCount > 0 ? "IN_USE" : "AVAILABLE" }
  });
}

export async function markOverdueReservations(now: Date = new Date()) {
  await prisma.inventoryReservation.updateMany({
    where: {
      status: "ACTIVE",
      returnedAt: null,
      dueBackAt: { lt: now }
    },
    data: { status: "OVERDUE" }
  });
}

export function effectiveReservationStatus(row: {
  status: string;
  returnedAt: Date | null;
  dueBackAt: Date;
}): string {
  if (row.returnedAt || row.status === "RETURNED" || row.status === "CANCELLED") {
    return row.status;
  }
  if (row.dueBackAt.getTime() < Date.now() && row.status === "ACTIVE") {
    return "OVERDUE";
  }
  return row.status;
}
