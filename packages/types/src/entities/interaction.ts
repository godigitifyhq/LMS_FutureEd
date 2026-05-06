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