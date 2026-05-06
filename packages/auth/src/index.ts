// @lms/auth - RBAC permission functions
// Types
export type { AuthUser, LeadOwnership, InteractionOwnership } from './types'

// Lead permissions
export {
  canCreateLead,
  canViewLead,
  canUpdateLead,
  canTransitionLead,
  canAssignLead,
  canDeactivateLead,
} from './permissions/lead'

// Interaction permissions
export {
  canAddInteraction,
  canEditInteraction,
  canDeleteInteraction,
} from './permissions/interaction'

// User permissions
export {
  canCreateUser,
  canUpdateUser,
  canDeactivateUser,
} from './permissions/user'

// Admin permissions
export {
  canManageCourses,
  canManageSourceTypes,
  canManageDocumentTypes,
  canUploadDocument,
  canManageConfirmedApplication,
  canViewAnalytics,
} from './permissions/admin'