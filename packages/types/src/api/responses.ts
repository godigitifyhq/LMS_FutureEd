import type { Lead, LeadSummary } from "../entities/lead";
import type { InteractionLog } from "../entities/interaction";
import type { User, PublicUser } from "../entities/user";
import type { ConfirmedApplication } from "../entities/confirmed";
import type { Branch } from "../entities/branch";
import type { Course, LeadSourceType } from "../entities/course";

// Standard API wrapper — every response follows this shape
export type ApiResponse<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

// Auth
export type LoginResponse = ApiResponse<{
  token: string;
  user: PublicUser;
}>;

// Leads
export type LeadListResponse = ApiResponse<{
  leads: LeadSummary[];
  total: number;
  page: number;
  pageSize: number;
}>;

export type LeadDetailResponse = ApiResponse<Lead>;

export type LeadInteractionsResponse = ApiResponse<{
  interactions: InteractionLog[];
}>;

// Confirmed
export type ConfirmedApplicationResponse = ApiResponse<ConfirmedApplication>;

// Users
export type UserListResponse = ApiResponse<User[]>;

// Reference data
export type CoursesResponse = ApiResponse<Course[]>;
export type LeadSourceTypesResponse = ApiResponse<LeadSourceType[]>;
export type BranchesResponse = ApiResponse<Branch[]>;
