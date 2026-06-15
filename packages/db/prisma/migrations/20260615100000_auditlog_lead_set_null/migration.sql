-- AuditLog: change lead FK from implicit NO ACTION to SET NULL
-- This allows hard-deletion of leads without blocking on audit history

ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_leadId_fkey";

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_leadId_fkey"
  FOREIGN KEY ("leadId")
  REFERENCES "Lead"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
