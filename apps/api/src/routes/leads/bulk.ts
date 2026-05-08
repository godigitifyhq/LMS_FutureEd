import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate'
import { authorize } from '../../middleware/authorize'
import { transitionLead } from '@lms/core'
import { LeadStatus, Role } from '@lms/types'

export async function bulkLeadRoutes(fastify: FastifyInstance): Promise<void> {

  // ── POST /leads/bulk-assign ──
  fastify.post('/bulk-assign', {
    preHandler: [authenticate, authorize([Role.ADMIN, Role.SUB_ADMIN])],
  }, async (request, reply) => {
    const { leadIds, assignedToId, reason } = request.body as {
      leadIds: string[]
      assignedToId: string
      reason?: string
    }

    if (!leadIds?.length || !assignedToId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'leadIds and assignedToId required' },
      })
    }

    if (leadIds.length > 50) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Maximum 50 leads per bulk operation' },
      })
    }

    const assignee = await fastify.prisma.user.findUnique({
      where: { id: assignedToId },
      select: { id: true, role: true, isActive: true },
    })

    if (!assignee || !assignee.isActive || assignee.role !== 'EMPLOYEE') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Assignee must be an active employee' },
      })
    }

    const { id: userId } = request.user

    await fastify.prisma.$transaction(async (tx) => {
      await tx.lead.updateMany({
        where: {
          id: { in: leadIds },
          status: { notIn: ['CONFIRMED', 'DUPLICATE'] },
        },
        data: { assignedToId },
      })

      await tx.assignmentHistory.createMany({
        data: leadIds.map(leadId => ({
          leadId,
          assignedById: userId,
          assignedToId,
          reason: reason ?? 'Bulk assignment',
        })),
      })

      await tx.auditLog.createMany({
        data: leadIds.map(leadId => ({
          leadId,
          userId,
          action: 'BULK_ASSIGNED',
          newValue: { assignedToId },
        })),
      })
    })

    return reply.status(200).send({
      success: true,
      data: { assigned: leadIds.length, assignedToId },
    })
  })

  // ── POST /leads/bulk-status ──
  fastify.post('/bulk-status', {
    preHandler: [authenticate, authorize([Role.ADMIN, Role.SUB_ADMIN])],
  }, async (request, reply) => {
    const { leadIds, toStatus, note } = request.body as {
      leadIds: string[]
      toStatus: LeadStatus
      note?: string
    }

    if (!leadIds?.length || !toStatus) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'leadIds and toStatus required' },
      })
    }

    if (leadIds.length > 50) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Maximum 50 leads per bulk operation' },
      })
    }

    const leads = await fastify.prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true, status: true },
    })

    const { id: userId } = request.user
    const successful: string[] = []
    const failed: Array<{ id: string; reason: string }> = []

    for (const lead of leads) {
      const result = transitionLead(lead.status as LeadStatus, toStatus)
      if (result.success) {
        successful.push(lead.id)
      } else {
        failed.push({ id: lead.id, reason: result.error.message })
      }
    }

    if (successful.length > 0) {
      await fastify.prisma.$transaction(async (tx) => {
        await tx.lead.updateMany({
          where: { id: { in: successful } },
          data: { status: toStatus },
        })

        await tx.interactionLog.createMany({
          data: successful.map(leadId => ({
            leadId,
            userId,
            type: 'STATUS_CHANGED' as const,
            note: note ?? 'Bulk status change',
            statusAfter: toStatus,
          })),
        })

        await tx.auditLog.createMany({
          data: successful.map(leadId => ({
            leadId,
            userId,
            action: 'BULK_STATUS_CHANGED',
            newValue: { status: toStatus },
          })),
        })
      })
    }

    return reply.status(200).send({
      success: true,
      data: { successful: successful.length, failed },
    })
  })
}