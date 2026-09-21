-- AlterTable
ALTER TABLE "AssignmentHistory" ADD COLUMN     "assignedFromId" TEXT;

-- AddForeignKey
ALTER TABLE "AssignmentHistory" ADD CONSTRAINT "AssignmentHistory_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentHistory" ADD CONSTRAINT "AssignmentHistory_assignedFromId_fkey" FOREIGN KEY ("assignedFromId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
