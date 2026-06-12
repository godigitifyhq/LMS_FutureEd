-- Add remarks field to ConfirmedApplication for admission staff notes.
ALTER TABLE "ConfirmedApplication"
ADD COLUMN "remarks" TEXT;
