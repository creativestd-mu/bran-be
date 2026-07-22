-- CreateTable
CREATE TABLE "org_events" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "ai_summary" TEXT,
    "ai_analyzed_at" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION,
    "latest_update_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_event_updates" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" VARCHAR(200) NOT NULL,
    "title" VARCHAR(500),
    "body" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_name" VARCHAR(320),
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_event_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_events_status_idx" ON "org_events"("status");
CREATE INDEX "org_events_kind_idx" ON "org_events"("kind");
CREATE INDEX "org_events_latest_update_at_idx" ON "org_events"("latest_update_at");
CREATE INDEX "org_events_created_at_idx" ON "org_events"("created_at");
CREATE INDEX "org_events_created_by_id_idx" ON "org_events"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_event_updates_source_type_source_id_key" ON "org_event_updates"("source_type", "source_id");
CREATE INDEX "org_event_updates_event_id_occurred_at_idx" ON "org_event_updates"("event_id", "occurred_at");
CREATE INDEX "org_event_updates_source_type_idx" ON "org_event_updates"("source_type");
CREATE INDEX "org_event_updates_occurred_at_idx" ON "org_event_updates"("occurred_at");

-- AddForeignKey
ALTER TABLE "org_events" ADD CONSTRAINT "org_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "org_event_updates" ADD CONSTRAINT "org_event_updates_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "org_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "org_event_updates" ADD CONSTRAINT "org_event_updates_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
