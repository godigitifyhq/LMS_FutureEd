import { Role } from "@lms/types";
import type { AuthUser, LeadOwnership } from "../types";

// ─────────────────────────────────────────
// Who can create a lead?
// All roles can create.
// BUSINESS RULE (enforced in packages/core, not here):
//   → EMPLOYEE creates lead → auto-assigned to themselves
//   → SUB_ADMIN/ADMIN creates lead → can assign to anyone
// ─────────────────────────────────────────
export function canCreateLead(user: AuthUser): boolean {
  return (
    user.role === Role.EMPLOYEE ||
    user.role === Role.SUB_ADMIN ||
    user.role === Role.ADMIN
  );
}

// ─────────────────────────────────────────
// Who can view a lead?
// EMPLOYEE: only leads assigned to them OR created by them
// SUB_ADMIN + ADMIN: all leads
// Note: since employee-created leads auto-assign to creator,
// createdById check handles edge cases where reassignment happened
// ─────────────────────────────────────────
export function canViewLead(user: AuthUser, lead: LeadOwnership): boolean {
  if (user.role === Role.ADMIN || user.role === Role.SUB_ADMIN) {
    return true;
  }
  return lead.assignedToId === user.id || lead.createdById === user.id;
}

// ─────────────────────────────────────────
// Who can update a lead's details?
// Same rules as view
// ─────────────────────────────────────────
export function canUpdateLead(user: AuthUser, lead: LeadOwnership): boolean {
  return canViewLead(user, lead);
}

// ─────────────────────────────────────────
// Who can transition a lead's status?
// Same rules as view
// Transition VALIDITY enforced by state machine in packages/core
// ─────────────────────────────────────────
export function canTransitionLead(
  user: AuthUser,
  lead: LeadOwnership,
): boolean {
  return canViewLead(user, lead);
}

// ─────────────────────────────────────────
// Who can assign or reassign a lead?
// SUB_ADMIN and ADMIN only.
// EMPLOYEE cannot assign — even their own leads.
// Their leads are auto-assigned to them by core on creation.
// ─────────────────────────────────────────
export function canAssignLead(user: AuthUser): boolean {
  return user.role === Role.SUB_ADMIN || user.role === Role.ADMIN;
}

// ─────────────────────────────────────────
// Who can deactivate or delete a lead?
// ADMIN only. No exceptions.
// ─────────────────────────────────────────
export function canDeactivateLead(user: AuthUser): boolean {
  return user.role === Role.ADMIN;
}
