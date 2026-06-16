-- Add isKey flag for tagging priority KPIs / KRAs per user

ALTER TABLE "UserKpi" ADD COLUMN "isKey" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "UserKpi_userId_isKey_idx" ON "UserKpi"("userId", "isKey");
