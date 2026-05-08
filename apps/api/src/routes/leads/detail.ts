import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate'
import { canViewLead } from '@lms/auth'
import { canEmployeeSeeConfirmedLead } from '@lms/core'
import { LeadStatus, Role } from '@lms/types'
import { leadDetailSelect } from './service'

export async function leadDetailRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/:id', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId, role } = request.user

    const lead = await fastify.prisma.lead.findUnique({
      where: { id },
      select: leadDetailSelect,
    })

    if (!lead) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lead not found' },
      })
    }

    // Permission check
    const canView = canViewLead(
      { id: userId, role: role as Role, branchId: request.user.branchId },
      {
        id: lead.id,
        assignedToId: lead.assignedTo?.id ?? null,
        createdById: lead.createdBy.id,
        branchId: lead.branchId,
        status: lead.status,
      }
    )

    if (!canView) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have access to this lead' },
      })
    }

    // Confirmed lead visibility window for employees
    if (role === 'EMPLOYEE' && lead.status === LeadStatus.CONFIRMED) {
      const visible = canEmployeeSeeConfirmedLead({
        lead: {
          id: lead.id,
          status: lead.status as LeadStatus,
          assignedToId: lead.assignedTo?.id ?? null,
          createdById: lead.createdBy.id,
          confirmedAt: lead.confirmedAt,
          confirmedById: lead.confirmedById,
        },
        user: { id: userId, role: role as Role },
      })

      if (!visible) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'This confirmed lead has been handed over to admin',
          },
        })
      }
    }

    return reply.status(200).send({ success: true, data: lead })
  })
}