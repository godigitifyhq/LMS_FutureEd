/*
  Warnings:

  - You are about to drop the column `editedAt` on the `InteractionLog` table. All the data in the column will be lost.
  - You are about to drop the column `originalNote` on the `InteractionLog` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "InteractionLog" DROP COLUMN "editedAt",
DROP COLUMN "originalNote";

-- CreateTable
CREATE TABLE "InteractionLogEdit" (
    "id" TEXT NOT NULL,
    "interactionLogId" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "noteBefore" TEXT NOT NULL,
    "noteAfter" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteractionLogEdit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InteractionLogEdit_interactionLogId_idx" ON "InteractionLogEdit"("interactionLogId");

-- CreateIndex
CREATE INDEX "InteractionLogEdit_editedAt_idx" ON "InteractionLogEdit"("editedAt");

-- CreateIndex
CREATE INDEX "InteractionLog_isDeleted_idx" ON "InteractionLog"("isDeleted");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- AddForeignKey
ALTER TABLE "InteractionLogEdit" ADD CONSTRAINT "InteractionLogEdit_interactionLogId_fkey" FOREIGN KEY ("interactionLogId") REFERENCES "InteractionLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionLogEdit" ADD CONSTRAINT "InteractionLogEdit_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
