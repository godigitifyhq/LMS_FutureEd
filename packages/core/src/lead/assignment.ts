import { Role } from "@lms/types";
import type { Result } from "../types";

type AssignmentContext = {
  creatorId: string;
  creatorRole: Role;
  explicitAssigneeId?: string; // only provided by Sub Admin/Admin
};

// ─────────────────────────────────────────
// Determine assignedToId at lead creation time
//
// EMPLOYEE creates lead → assigned to themselves
// SUB_ADMIN/ADMIN creates → use explicit assignee if provided,
//                           otherwise assign to themselves
// ─────────────────────────────────────────
export function resolveAssigneeOnCreate(context: AssignmentContext): string {
  if (context.creatorRole === Role.EMPLOYEE) {
    return context.creatorId;
  }

  // Sub Admin or Admin — use explicit if provided, else self
  return context.explicitAssigneeId ?? context.creatorId;
}

// ─────────────────────────────────────────
// Validate a reassignment operation
// Only validates business rules — permission check
// already done in auth package before calling this
// ─────────────────────────────────────────
export function validateReassignment(params: {
  newAssigneeId: string;
  newAssigneeRole: Role;
  leadStatus: string;
  actorRole: Role;
}): Result<{ assignedToId: string }> {
  // Admins may assign leads to anyone (Admin, Sub Admin, or Employee).
  // Sub Admins may only assign leads to Employees.
  const targetIsManager =
    params.newAssigneeRole === Role.ADMIN ||
    params.newAssigneeRole === Role.SUB_ADMIN;

  if (targetIsManager && params.actorRole !== Role.ADMIN) {
    return {
      success: false,
      error: {
        code: "INVALID_ASSIGNMENT",
        message: "Only Admins can assign leads to Admins or Sub Admins.",
        meta: { newAssigneeRole: params.newAssigneeRole },
      },
    };
  }

  // Confirmed leads can't be reassigned by employees, but Admin/Sub Admin
  // may still transfer them to another employee (e.g. staff changes).
  const actorCanOverride =
    params.actorRole === Role.ADMIN || params.actorRole === Role.SUB_ADMIN;
  if (params.leadStatus === "CONFIRMED" && !actorCanOverride) {
    return {
      success: false,
      error: {
        code: "ALREADY_CONFIRMED",
        message: "Confirmed leads cannot be reassigned.",
        meta: { leadStatus: params.leadStatus },
      },
    };
  }

  return {
    success: true,
    data: { assignedToId: params.newAssigneeId },
  };
}

// ─────────────────────────────────────────
// Handle user deactivation
// Returns lead IDs that need to be unassigned
// API layer updates them all to assignedToId = null
// and creates audit log entries
// ─────────────────────────────────────────
export function resolveDeactivationUnassignment(params: {
  deactivatedUserId: string;
  assignedLeads: Array<{ id: string; status: string }>;
}): {
  leadIdsToUnassign: string[];
  skippedLeadIds: string[]; // confirmed leads stay as-is
} {
  const leadIdsToUnassign: string[] = [];
  const skippedLeadIds: string[] = [];

  for (const lead of params.assignedLeads) {
    // Confirmed leads keep their assignment record for history
    // but are no longer actively worked — skip reassignment
    if (lead.status === "CONFIRMED") {
      skippedLeadIds.push(lead.id);
      continue;
    }
    leadIdsToUnassign.push(lead.id);
  }

  return { leadIdsToUnassign, skippedLeadIds };
}
