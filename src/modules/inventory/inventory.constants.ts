export const INVENTORY_ITEM_STATUSES = [
  "AVAILABLE",
  "IN_USE",
  "MAINTENANCE",
  "RETIRED"
] as const;

export type InventoryItemStatus = (typeof INVENTORY_ITEM_STATUSES)[number];

export const RESERVATION_STATUSES = ["ACTIVE", "RETURNED", "OVERDUE", "CANCELLED"] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const SHOOT_NODE_KIND = "SHOOT";
