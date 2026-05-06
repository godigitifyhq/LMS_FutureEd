import type { Role } from '@lms/types'

// Minimum user info needed to make any permission decision
export type AuthUser = {
  id: string
  role: Role
  branchId: string
}

// Minimum lead info needed to check ownership
export type LeadOwnership = {
  id: string
  assignedToId: string | null
  createdById: string
  branchId: string
  status: string
}

// Minimum interaction info needed to check ownership
export type InteractionOwnership = {
  id: string
  userId: string    // who created it
  isDeleted: boolean
}