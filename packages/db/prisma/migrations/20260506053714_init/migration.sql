-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'SUB_ADMIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'ATTEMPTED_CONTACT', 'CONNECTED', 'INTERESTED', 'FOLLOW_UP_SCHEDULED', 'APPLICATION_SENT', 'UNDER_VALIDATION', 'CONFIRMED', 'LOST', 'NOT_INTERESTED', 'NOT_REACHABLE', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED');

-- CreateEnum
CREATE TYPE "QualificationLevel" AS ENUM ('TENTH', 'TWELFTH', 'GRADUATION', 'POST_GRADUATION', 'OTHER');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'SMS', 'MEETING', 'DOCUMENT_UPLOADED', 'STATUS_CHANGED');

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSourceType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadSourceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "fatherName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "alternatePhone" TEXT,
    "whatsappNumber" TEXT,
    "email" TEXT,
    "gender" "Gender",
    "maritalStatus" "MaritalStatus",
    "village" TEXT,
    "sector" TEXT,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "qualification" "QualificationLevel",
    "schoolCollege" TEXT,
    "boardUniversity" TEXT,
    "passingYear" INTEGER,
    "percentage" DOUBLE PRECISION,
    "pcmPcbPercentage" DOUBLE PRECISION,
    "sourceId" TEXT,
    "sourceOther" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "purpose" TEXT,
    "remarks" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "sendSms" BOOLEAN NOT NULL DEFAULT false,
    "sendEmail" BOOLEAN NOT NULL DEFAULT false,
    "branchId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCourse" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "InteractionType" NOT NULL,
    "note" TEXT,
    "callRecordingUrl" TEXT,
    "callDurationSecs" INTEGER,
    "callDirection" TEXT,
    "statusBefore" "LeadStatus",
    "statusAfter" "LeadStatus",
    "smsSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "originalNote" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteractionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfirmedApplication" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "aadharNo" TEXT,
    "apaarId" TEXT,
    "motherName" TEXT,
    "motherOccupation" TEXT,
    "motherIncome" DOUBLE PRECISION,
    "fatherOccupation" TEXT,
    "fatherIncome" DOUBLE PRECISION,
    "noOfSisters" INTEGER,
    "noOfBrothers" INTEGER,
    "nationality" TEXT,
    "religion" TEXT,
    "category" TEXT,
    "permanentAddress" TEXT,
    "permanentPhone" TEXT,
    "localGuardianName" TEXT,
    "localGuardianAddress" TEXT,
    "localGuardianPhone" TEXT,
    "bookingAmount" DOUBLE PRECISION,
    "bookingCashDDNo" TEXT,
    "bookingBank" TEXT,
    "bookingDate" TIMESTAMP(3),
    "admissionAmount" DOUBLE PRECISION,
    "admissionCashDDNo" TEXT,
    "admissionBank" TEXT,
    "admissionDate" TIMESTAMP(3),
    "duesAmount" DOUBLE PRECISION,
    "dueDate" TIMESTAMP(3),
    "extraCurricular" TEXT,
    "authorisedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfirmedApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicRecord" (
    "id" TEXT NOT NULL,
    "confirmedApplicationId" TEXT NOT NULL,
    "level" "QualificationLevel" NOT NULL,
    "stream" TEXT,
    "institution" TEXT,
    "board" TEXT,
    "passingYear" INTEGER,
    "percentage" DOUBLE PRECISION,
    "grade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntranceExamDetail" (
    "id" TEXT NOT NULL,
    "confirmedApplicationId" TEXT NOT NULL,
    "examName" TEXT NOT NULL,
    "rollNo" TEXT,
    "score" TEXT,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntranceExamDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadDocument" (
    "id" TEXT NOT NULL,
    "confirmedApplicationId" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_branchId_idx" ON "User"("branchId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Course_name_key" ON "Course"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSourceType_name_key" ON "LeadSourceType"("name");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_assignedToId_idx" ON "Lead"("assignedToId");

-- CreateIndex
CREATE INDEX "Lead_branchId_idx" ON "Lead"("branchId");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Lead_sourceId_idx" ON "Lead"("sourceId");

-- CreateIndex
CREATE INDEX "Lead_isDuplicate_idx" ON "Lead"("isDuplicate");

-- CreateIndex
CREATE INDEX "Lead_nextFollowUpAt_idx" ON "Lead"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "LeadCourse_leadId_idx" ON "LeadCourse"("leadId");

-- CreateIndex
CREATE INDEX "LeadCourse_courseId_idx" ON "LeadCourse"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadCourse_leadId_courseId_key" ON "LeadCourse"("leadId", "courseId");

-- CreateIndex
CREATE INDEX "InteractionLog_leadId_idx" ON "InteractionLog"("leadId");

-- CreateIndex
CREATE INDEX "InteractionLog_userId_idx" ON "InteractionLog"("userId");

-- CreateIndex
CREATE INDEX "InteractionLog_createdAt_idx" ON "InteractionLog"("createdAt");

-- CreateIndex
CREATE INDEX "InteractionLog_type_idx" ON "InteractionLog"("type");

-- CreateIndex
CREATE INDEX "InteractionLog_statusAfter_idx" ON "InteractionLog"("statusAfter");

-- CreateIndex
CREATE INDEX "AssignmentHistory_leadId_idx" ON "AssignmentHistory"("leadId");

-- CreateIndex
CREATE INDEX "AssignmentHistory_assignedById_idx" ON "AssignmentHistory"("assignedById");

-- CreateIndex
CREATE INDEX "AssignmentHistory_createdAt_idx" ON "AssignmentHistory"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_leadId_idx" ON "AuditLog"("leadId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConfirmedApplication_leadId_key" ON "ConfirmedApplication"("leadId");

-- CreateIndex
CREATE INDEX "AcademicRecord_confirmedApplicationId_idx" ON "AcademicRecord"("confirmedApplicationId");

-- CreateIndex
CREATE INDEX "EntranceExamDetail_confirmedApplicationId_idx" ON "EntranceExamDetail"("confirmedApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentType_name_key" ON "DocumentType"("name");

-- CreateIndex
CREATE INDEX "LeadDocument_confirmedApplicationId_idx" ON "LeadDocument"("confirmedApplicationId");

-- CreateIndex
CREATE INDEX "LeadDocument_documentTypeId_idx" ON "LeadDocument"("documentTypeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LeadSourceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCourse" ADD CONSTRAINT "LeadCourse_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCourse" ADD CONSTRAINT "LeadCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionLog" ADD CONSTRAINT "InteractionLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionLog" ADD CONSTRAINT "InteractionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentHistory" ADD CONSTRAINT "AssignmentHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentHistory" ADD CONSTRAINT "AssignmentHistory_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmedApplication" ADD CONSTRAINT "ConfirmedApplication_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicRecord" ADD CONSTRAINT "AcademicRecord_confirmedApplicationId_fkey" FOREIGN KEY ("confirmedApplicationId") REFERENCES "ConfirmedApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntranceExamDetail" ADD CONSTRAINT "EntranceExamDetail_confirmedApplicationId_fkey" FOREIGN KEY ("confirmedApplicationId") REFERENCES "ConfirmedApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDocument" ADD CONSTRAINT "LeadDocument_confirmedApplicationId_fkey" FOREIGN KEY ("confirmedApplicationId") REFERENCES "ConfirmedApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDocument" ADD CONSTRAINT "LeadDocument_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
