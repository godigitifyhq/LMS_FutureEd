import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate'
import { authorize } from '../../middleware/authorize'
import { Role } from '@lms/types'
import { leadSummarySelect } from './service'

export async function unassignedLeadsRoute(
  fastify: FastifyInstance
): Promise<void> {
  fastify.get('/unassigned', {
    preHandler: [authenticate, authorize([Role.ADMIN, Role.SUB_ADMIN])],
  }, async (request, reply) => {

    const query = request.query as {
      page?: string
      pageSize?: string
    }

    const page = Math.max(1, parseInt(query.page ?? '1', 10))
    const pageSize = 20

    const [leads, total] = await Promise.all([
      fastify.prisma.lead.findMany({
        where: {
          assignedToId: null,
          status: { notIn: ['CONFIRMED', 'DUPLICATE', 'LOST'] },
        },
        select: leadSummarySelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      fastify.prisma.lead.count({
        where: {
          assignedToId: null,
          status: { notIn: ['CONFIRMED', 'DUPLICATE', 'LOST'] },
        },
      }),
    ])

    return reply.status(200).send({
      success: true,
      data: { leads, total, page, pageSize },
    })
  })
}