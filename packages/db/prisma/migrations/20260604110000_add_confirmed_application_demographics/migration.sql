-- Add confirmed application demographics so the confirmed tab can persist them.
ALTER TABLE "ConfirmedApplication"
ADD COLUMN "gender" "Gender",
ADD COLUMN "maritalStatus" "MaritalStatus";