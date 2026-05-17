import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate'
import { leadSummarySelect } from './service'
import { Role } from '@lms/types'

export async function leadFollowUpsRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/followups', { preHandler: authenticate }, async (request, reply) => {
    const { id: userId, role, branchId } = request.user
    const now = new Date()
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const excludedStatuses = ['CONFIRMED', 'DUPLICATE', 'LOST']

    // Employees see only their own leads; admins/sub-admins see the whole branch
    const scopeWhere =
      role === Role.EMPLOYEE
        ? { OR: [{ assignedToId: userId }, { createdById: userId }] }
        : { branchId }

    const [overdue, upcoming] = await Promise.all([
      fastify.prisma.lead.findMany({
        where: {
          ...scopeWhere,
          status: { notIn: excludedStatuses },
          nextFollowUpAt: { lte: now },
        },
        select: leadSummarySelect,
        orderBy: { nextFollowUpAt: 'asc' },
      }),
      fastify.prisma.lead.findMany({
        where: {
          ...scopeWhere,
          status: { notIn: excludedStatuses },
          nextFollowUpAt: { gt: now, lte: sevenDaysLater },
        },
        select: leadSummarySelect,
        orderBy: { nextFollowUpAt: 'asc' },
      }),
    ])

    return reply.status(200).send({ success: true, data: { overdue, upcoming } })
  })
}
