import type { FastifyInstance } from 'fastify'
import { QUEUES } from '../plugins/bullmq'
import { InteractionType } from '@lms/types'

type NotificationContext = {
  leadId: string
  studentName: string
  actorId: string       // who performed the action
  actorName: string
  assignedToId: string | null
  assignedToEmail: string | null
  assignedToName: string | null
  branchId: string
}

type InteractionNotificationParams = {
  fastify: FastifyInstance
  context: NotificationContext
  interactionType: InteractionType
  note: string | null
  statusBefore?: string | null
  statusAfter?: string | null
}

export async function dispatchInteractionNotification(
  params: InteractionNotificationParams
): Promise<void> {
  const { fastify, context, interactionType, note, statusBefore, statusAfter } = params

  // Fetch all admins and sub-admins for this branch
  const managers = await fastify.prisma.user.findMany({
    where: {
      branchId: context.branchId,
      role: { in: ['ADMIN', 'SUB_ADMIN'] },
      isActive: true,
    },
    select: { id: true, email: true, name: true },
  })

  const notifications: Array<{
    recipientId: string
    recipientEmail: string
    recipientName: string
    message: string
    type: string
  }> = []

  const baseMessage = buildNotificationMessage({
    actorName: context.actorName,
    studentName: context.studentName,
    interactionType,
    note,
    statusBefore: statusBefore ?? null,
    statusAfter: statusAfter ?? null,
  })

  // Notify assigned employee if action was by someone else
  if (
    context.assignedToId &&
    context.assignedToId !== context.actorId &&
    context.assignedToEmail &&
    context.assignedToName
  ) {
    notifications.push({
      recipientId: context.assignedToId,
      recipientEmail: context.assignedToEmail,
      recipientName: context.assignedToName,
      message: baseMessage,
      type: 'LEAD_INTERACTION',
    })
  }

  // Notify all managers
  for (const manager of managers) {
    if (manager.id !== context.actorId) {
      notifications.push({
        recipientId: manager.id,
        recipientEmail: manager.email,
        recipientName: manager.name,
        message: baseMessage,
        type: 'LEAD_INTERACTION',
      })
    }
  }

  // Queue all notifications
  for (const notification of notifications) {
    await fastify.queues[QUEUES.NOTIFICATIONS].add(
      'interaction-notification',
      {
        ...notification,
        leadId: context.leadId,
        studentName: context.studentName,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 3000 } }
    )
  }
}

function buildNotificationMessage(params: {
  actorName: string
  studentName: string
  interactionType: InteractionType
  note: string | null
  statusBefore: string | null
  statusAfter: string | null
}): string {
  const { actorName, studentName, interactionType, note, statusBefore, statusAfter } = params

  switch (interactionType) {
    case InteractionType.STATUS_CHANGED:
      return `${actorName} moved ${studentName}'s lead from ${statusBefore} to ${statusAfter}`

    case InteractionType.CALL:
      return `${actorName} logged a call with ${studentName}${note ? `: "${note}"` : ''}`

    case InteractionType.NOTE:
      return `${actorName} added a note on ${studentName}'s lead${note ? `: "${note}"` : ''}`

    case InteractionType.EMAIL:
      return `${actorName} sent an email to ${studentName}`

    case InteractionType.MEETING:
      return `${actorName} logged a meeting with ${studentName}`

    case InteractionType.DOCUMENT_UPLOADED:
      return `${actorName} uploaded a document for ${studentName}`

    default:
      return `${actorName} updated ${studentName}'s lead`
  }
}