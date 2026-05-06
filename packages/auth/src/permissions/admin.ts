import { Role } from '@lms/types'
import type { AuthUser } from '../types'

// ─────────────────────────────────────────
// Who can manage courses?
// SUB_ADMIN and ADMIN
// ─────────────────────────────────────────
export function canManageCourses(user: AuthUser): boolean {
  return user.role === Role.SUB_ADMIN || user.role === Role.ADMIN
}

// ─────────────────────────────────────────
// Who can manage lead source types?
// SUB_ADMIN and ADMIN
// ─────────────────────────────────────────
export function canManageSourceTypes(user: AuthUser): boolean {
  return user.role === Role.SUB_ADMIN || user.role === Role.ADMIN
}

// ─────────────────────────────────────────
// Who can manage document types?
// SUB_ADMIN and ADMIN
// ─────────────────────────────────────────
export function canManageDocumentTypes(user: AuthUser): boolean {
  return user.role === Role.SUB_ADMIN || user.role === Role.ADMIN
}

// ─────────────────────────────────────────
// Who can upload documents for a lead?
// Anyone who can view the lead
// ─────────────────────────────────────────
export function canUploadDocument(
  user: AuthUser,
  lead: { assignedToId: string | null; createdById: string }
): boolean {
  if (user.role === Role.ADMIN || user.role === Role.SUB_ADMIN) return true
  return lead.assignedToId === user.id || lead.createdById === user.id
}

// ─────────────────────────────────────────
// Who can manage confirmed application data?
// Anyone who can view the lead
// ─────────────────────────────────────────
export function canManageConfirmedApplication(
  user: AuthUser,
  lead: { assignedToId: string | null; createdById: string }
): boolean {
  if (user.role === Role.ADMIN || user.role === Role.SUB_ADMIN) return true
  return lead.assignedToId === user.id || lead.createdById === user.id
}

// ─────────────────────────────────────────
// Who can view analytics?
// SUB_ADMIN and ADMIN
// ─────────────────────────────────────────
export function canViewAnalytics(user: AuthUser): boolean {
  return user.role === Role.SUB_ADMIN || user.role === Role.ADMIN
}