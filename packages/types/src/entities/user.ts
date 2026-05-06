import type { Role } from "../enums";

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
};

// What gets returned to the frontend — never expose passwordHash
export type PublicUser = Omit<User, never> & {
  branchName: string;
};

// Lightweight version for dropdowns, assignment lists
export type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: Role;
  branchId: string;
};
