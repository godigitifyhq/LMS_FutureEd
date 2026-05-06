import { Role } from '@lms/types'
import type { AuthUser } from '../types'

// ─────────────────────────────────────────
// Who can create a new user account?
// SUB_ADMIN and ADMIN
// ─────────────────────────────────────────
export function canCreateUser(user: AuthUser): boolean {
  return user.role === Role.SUB_ADMIN || user.role === Role.ADMIN
}

// ─────────────────────────────────────────
// Who can update a user's details?
// SUB_ADMIN and ADMIN
// ─────────────────────────────────────────
export function canUpdateUser(user: AuthUser): boolean {
  return user.role === Role.SUB_ADMIN || user.role === Role.ADMIN
}

// ─────────────────────────────────────────
// Who can deactivate or delete a user?
// ADMIN only
// ─────────────────────────────────────────
export function canDeactivateUser(user: AuthUser): boolean {
  return user.role === Role.ADMIN
}