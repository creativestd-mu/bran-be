-- Inventory module: equipment catalog, team ownership, shoot reservations

CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(200),
    "serialNumber" VARCHAR(200),
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryItemTeam" (
    "inventoryItemId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItemTeam_pkey" PRIMARY KEY ("inventoryItemId","teamId")
);

CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "contentNodeId" TEXT NOT NULL,
    "contentNodeResourceId" TEXT NOT NULL,
    "reservedFrom" TIMESTAMP(3) NOT NULL,
    "dueBackAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ContentNodeResource" ADD COLUMN "inventoryItemId" TEXT;

CREATE INDEX "ContentNodeResource_inventoryItemId_idx" ON "ContentNodeResource"("inventoryItemId");
CREATE INDEX "InventoryItem_status_idx" ON "InventoryItem"("status");
CREATE INDEX "InventoryItem_isActive_idx" ON "InventoryItem"("isActive");
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");
CREATE INDEX "InventoryItem_name_idx" ON "InventoryItem"("name");
CREATE INDEX "InventoryItemTeam_teamId_idx" ON "InventoryItemTeam"("teamId");
CREATE UNIQUE INDEX "InventoryReservation_contentNodeResourceId_key" ON "InventoryReservation"("contentNodeResourceId");
CREATE INDEX "InventoryReservation_inventoryItemId_status_idx" ON "InventoryReservation"("inventoryItemId", "status");
CREATE INDEX "InventoryReservation_contentNodeId_idx" ON "InventoryReservation"("contentNodeId");
CREATE INDEX "InventoryReservation_dueBackAt_idx" ON "InventoryReservation"("dueBackAt");
CREATE INDEX "InventoryReservation_status_dueBackAt_idx" ON "InventoryReservation"("status", "dueBackAt");

ALTER TABLE "ContentNodeResource" ADD CONSTRAINT "ContentNodeResource_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "InventoryItemTeam" ADD CONSTRAINT "InventoryItemTeam_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "InventoryItemTeam" ADD CONSTRAINT "InventoryItemTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_contentNodeId_fkey" FOREIGN KEY ("contentNodeId") REFERENCES "ContentNode"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_contentNodeResourceId_fkey" FOREIGN KEY ("contentNodeResourceId") REFERENCES "ContentNodeResource"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
