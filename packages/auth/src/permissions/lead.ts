import { Role } from '@lms/types'
import type { AuthUser, LeadOwnership } from '../types'

// ─────────────────────────────────────────
// Who can create a lead?
// All roles can create. But employee-created
// leads go unassigned — enforced in core, not here.
// ─────────────────────────────────────────
export function canCreateLead(user: AuthUser): boolean {
  return user.role === Role.EMPLOYEE
    || user.role === Role.SUB_ADMIN
    || user.role === Role.ADMIN
}

// ─────────────────────────────────────────
// Who can view a lead?
// EMPLOYEE: only leads assigned to them OR created by them
// SUB_ADMIN + ADMIN: all leads
// ─────────────────────────────────────────
export function canViewLead(user: AuthUser, lead: LeadOwnership): boolean {
  if (user.role === Role.ADMIN || user.role === Role.SUB_ADMIN) {
    return true
  }
  return lead.assignedToId === user.id || lead.createdById === user.id
}

// ─────────────────────────────────────────
// Who can update a lead's details?
// Same rules as view
// ─────────────────────────────────────────
export function canUpdateLead(user: AuthUser, lead: LeadOwnership): boolean {
  return canViewLead(user, lead)
}

// ─────────────────────────────────────────
// Who can transition a lead's status?
// Same rules as view — if you can see it, you can move it
// Transition validity is enforced by core (state machine)
// ─────────────────────────────────────────
export function canTransitionLead(user: AuthUser, lead: LeadOwnership): boolean {
  return canViewLead(user, lead)
}

// ─────────────────────────────────────────
// Who can assign or reassign a lead?
// EMPLOYEE can never assign — even their own leads
// ─────────────────────────────────────────
export function canAssignLead(user: AuthUser): boolean {
  return user.role === Role.SUB_ADMIN || user.role === Role.ADMIN
}

// ─────────────────────────────────────────
// Who can deactivate or delete a lead?
// ADMIN only. No exceptions.
// ─────────────────────────────────────────
export function canDeactivateLead(user: AuthUser): boolean {
  return user.role === Role.ADMIN
}