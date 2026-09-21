import type { InteractionType, LeadStatus } from '../enums'
import type { UserSummary } from './user'

export type InteractionLogEdit = {
  id: string
  interactionLogId: string
  editedBy: UserSummary
  noteBefore: string
  noteAfter: string
  editedAt: Date
}

export type InteractionLog = {
  id: string
  leadId: string
  user: UserSummary
  type: InteractionType
  note: string | null
  callRecordingUrl: string | null
  callDurationSecs: number | null
  callDirection: string | null
  statusBefore: LeadStatus | null
  statusAfter: LeadStatus | null
  smsSent: boolean
  emailSent: boolean
  isEdited: boolean
  isDeleted: boolean
  createdAt: Date
  editHistory: InteractionLogEdit[]
}

// A reassignment, as shown in the lead timeline. Not an InteractionLog row —
// it comes from AssignmentHistory. `from` is null when the lead was
// unassigned (or the row predates the assignedFromId column).
export type LeadAssignmentEvent = {
  id: string
  reason: string | null
  createdAt: Date
  assignedBy: { id: string; name: string }
  assignedFrom: { id: string; name: string } | null
  assignedTo: { id: string; name: string } | null
}
