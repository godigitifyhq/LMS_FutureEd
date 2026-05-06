import { Role } from '@lms/types'
import type { AuthUser, InteractionOwnership, LeadOwnership } from '../types'

// ─────────────────────────────────────────
// Who can add an interaction/feedback?
// Any user who can view the lead can add interactions
// ─────────────────────────────────────────
export function canAddInteraction(
  user: AuthUser,
  lead: LeadOwnership
): boolean {
  // Reuse lead view permission
  if (user.role === Role.ADMIN || user.role === Role.SUB_ADMIN) return true
  return lead.assignedToId === user.id || lead.createdById === user.id
}

// ─────────────────────────────────────────
// Who can edit an interaction note?
// ONLY the person who wrote it — regardless of role
// Even ADMIN cannot edit another person's note
// ─────────────────────────────────────────
export function canEditInteraction(
  user: AuthUser,
  interaction: InteractionOwnership
): boolean {
  if (interaction.isDeleted) return false
  return interaction.userId === user.id
}

// ─────────────────────────────────────────
// Who can soft-delete an interaction?
// ADMIN only
// ─────────────────────────────────────────
export function canDeleteInteraction(user: AuthUser): boolean {
  return user.role === Role.ADMIN
}