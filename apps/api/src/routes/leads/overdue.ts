import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate'
import { leadSummarySelect } from './service'
import { Role } from '@lms/types'

export async function overdueLeadsRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/overdue', {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id: userId, role } = request.user
    const now = new Date()

    const where: Record<string, unknown> = {
      nextFollowUpAt: { lte: now },
      status: { notIn: ['CONFIRMED', 'DUPLICATE', 'LOST'] },
    }

    // Employees only see their own overdue leads
    if (role === Role.EMPLOYEE) {
      where['OR'] = [
        { assignedToId: userId },
        { createdById: userId },
      ]
    }

    const leads = await fastify.prisma.lead.findMany({
      where,
      select: {
        ...leadSummarySelect,
        nextFollowUpAt: true,
      },
      orderBy: { nextFollowUpAt: 'asc' },
    })

    return reply.status(200).send({ success: true, data: { leads } })
  })
}