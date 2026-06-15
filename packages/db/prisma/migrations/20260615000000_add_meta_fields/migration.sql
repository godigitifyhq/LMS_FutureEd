-- AlterTable: add Meta/WhatsApp fields to Lead
ALTER TABLE "Lead"
  ADD COLUMN "waContactId"    TEXT,
  ADD COLUMN "waFirstMessage" TEXT,
  ADD COLUMN "waMessageType"  TEXT,
  ADD COLUMN "isFromWhatsApp" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "metaLeadgenId"  TEXT,
  ADD COLUMN "metaAdName"     TEXT;

-- CreateIndex: unique constraint on metaLeadgenId (idempotency for Lead Form)
CREATE UNIQUE INDEX "Lead_metaLeadgenId_key" ON "Lead"("metaLeadgenId");

-- CreateIndex: lookup by waContactId (idempotency for WhatsApp)
CREATE INDEX "Lead_waContactId_idx" ON "Lead"("waContactId");

-- CreateIndex: filter WhatsApp leads
CREATE INDEX "Lead_isFromWhatsApp_idx" ON "Lead"("isFromWhatsApp");
