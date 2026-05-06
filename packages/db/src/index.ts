// @lms/db - Prisma client and schema
export { PrismaClient } from "./generated/client";
export type {
  Lead,
  User,
  Branch,
  Course,
  LeadCourse,
  LeadSourceType,
  InteractionLog,
  AssignmentHistory,
  AuditLog,
  ConfirmedApplication,
  AcademicRecord,
  EntranceExamDetail,
  DocumentType,
  LeadDocument,
} from "./generated/client";

export {
  Role,
  LeadStatus,
  Gender,
  MaritalStatus,
  QualificationLevel,
  InteractionType,
} from "./generated/client";
