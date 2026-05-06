// @lms/types - shared TypeScript types
// Enums
export * from "./enums";

// Entities
export type { User, PublicUser, UserSummary } from "./entities/user";
export type { Branch } from "./entities/branch";
export type { Course, LeadSourceType } from "./entities/course";
export type { Lead, LeadSummary, LeadCourse } from "./entities/lead";
export type {
  InteractionLog,
  InteractionLogEdit,
} from "./entities/interaction";
export type {
  ConfirmedApplication,
  AcademicRecord,
  EntranceExamDetail,
  DocumentType,
  LeadDocument,
} from "./entities/confirmed";

// API contracts
export type {
  LoginRequest,
  CreateLeadRequest,
  UpdateLeadRequest,
  TransitionLeadRequest,
  AssignLeadRequest,
  CreateInteractionRequest,
  EditInteractionRequest,
  CreateConfirmedApplicationRequest,
} from "./api/requests";

export type {
  ApiResponse,
  ApiError,
  LoginResponse,
  LeadListResponse,
  LeadDetailResponse,
  LeadInteractionsResponse,
  ConfirmedApplicationResponse,
  UserListResponse,
  CoursesResponse,
  LeadSourceTypesResponse,
  BranchesResponse,
} from "./api/responses";
