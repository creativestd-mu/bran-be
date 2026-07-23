-- AlterTable
ALTER TABLE "WorkUnit" ADD COLUMN "source_type" VARCHAR(50),
ADD COLUMN "source_id" VARCHAR(200);

-- CreateIndex
CREATE INDEX "WorkUnit_source_type_source_id_idx" ON "WorkUnit"("source_type", "source_id");

-- CreateTable
CREATE TABLE "work_unit_sources" (
    "id" TEXT NOT NULL,
    "source_type" VARCHAR(50) NOT NULL,
    "source_id" VARCHAR(200) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "work_unit_count" INTEGER NOT NULL DEFAULT 0,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_unit_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_unit_sources_source_type_source_id_key" ON "work_unit_sources"("source_type", "source_id");
CREATE INDEX "work_unit_sources_source_type_idx" ON "work_unit_sources"("source_type");
CREATE INDEX "work_unit_sources_processed_at_idx" ON "work_unit_sources"("processed_at");
