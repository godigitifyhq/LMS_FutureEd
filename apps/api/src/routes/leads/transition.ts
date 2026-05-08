import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate'
import { canTransitionLead } from '@lms/auth'
import { transitionLead, getValidTransitions } from '@lms/core'
import { LeadStatus, Role } from '@lms/types'

export async function transitionLeadRoute(
  fastify: FastifyInstance
): Promise<void> {
  fastify.post('/:id/transition', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId, role } = request.user
    const { toStatus, note } = request.body as {
      toStatus: LeadStatus
      note?: string
    }

    if (!toStatus) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'toStatus is required' },
      })
    }

    const lead = await fastify.prisma.lead.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        assignedTo: { select: { id: true } },
        createdBy: { select: { id: true } },
        branchId: true,
      },
    })

    if (!lead) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead not found' },
      })
    }

    // Permission check
    const canTransition = canTransitionLead(
      { id: userId, role: role as Role, branchId: request.user.branchId },
      {
        id: lead.id,
        assignedToId: lead.assignedTo?.id ?? null,
        createdById: lead.createdBy.id,
        branchId: lead.branchId,
        status: lead.status,
      }
    )

    if (!canTransition) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You cannot update this lead' },
      })
    }

    // State machine validation
    const result = transitionLead(lead.status as LeadStatus, toStatus)

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          details: {
            validTransitions: getValidTransitions(lead.status as LeadStatus),
          },
        },
      })
    }

    const previousStatus = lead.status as LeadStatus

    // Handle CONFIRMED transition specially
    const isConfirming = toStatus === LeadStatus.CONFIRMED

    await fastify.prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: {
          status: toStatus,
          ...(isConfirming
            ? { confirmedAt: new Date(), confirmedById: userId }
            : {}),
        },
      })

      await tx.interactionLog.create({
        data: {
          leadId: id,
          userId,
          type: 'STATUS_CHANGED',
          note: note ?? null,
          statusBefore: previousStatus,
          statusAfter: toStatus,
        },
      })

      await tx.auditLog.create({
        data: {
          leadId: id,
          userId,
          action: 'STATUS_CHANGED',
          oldValue: { status: previousStatus },
          newValue: { status: toStatus },
        },
      })

      // Create ConfirmedApplication record when confirmed
      if (isConfirming) {
        await tx.confirmedApplication.upsert({
          where: { leadId: id },
          update: {},
          create: { leadId: id },
        })
      }
    })

    return reply.status(200).send({
      success: true,
      data: { previousStatus, newStatus: toStatus },
    })
  })
}