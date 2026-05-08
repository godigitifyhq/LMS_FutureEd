import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate'
import { buildLeadWhereClause, leadSummarySelect } from './service'
import type { LeadStatus, Role } from '@lms/types'

const ALLOWED_PAGE_SIZES = [20, 50, 80]
const DEFAULT_PAGE_SIZE = 20

const SORT_FIELDS: Record<string, string> = {
  createdAt: 'createdAt',
  studentName: 'studentName',
  status: 'status',
  nextFollowUpAt: 'nextFollowUpAt',
}

export async function leadListRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', {
    preHandler: authenticate,
  }, async (request, reply) => {

    const query = request.query as {
      page?: string
      pageSize?: string
      status?: string
      assignedToId?: string
      courseId?: string
      sourceId?: string
      branchId?: string
      search?: string
      dateFrom?: string
      dateTo?: string
      sortBy?: string
      sortOrder?: string
    }

    const page = Math.max(1, parseInt(query.page ?? '1', 10))
    const requestedSize = parseInt(query.pageSize ?? '20', 10)
    const pageSize = ALLOWED_PAGE_SIZES.includes(requestedSize)
      ? requestedSize
      : DEFAULT_PAGE_SIZE

    const sortBy = SORT_FIELDS[query.sortBy ?? ''] ?? 'createdAt'
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc'

    const { id: userId, role } = request.user

    // Employees cannot filter by assignedToId — they only see their own
    const assignedToId =
      role === 'EMPLOYEE' ? undefined : query.assignedToId
      // Build filters object — only include defined values
      const filters: Parameters<typeof buildLeadWhereClause>[0]['filters'] = {}
      
      if (query.status) filters.status = query.status as LeadStatus
      if (assignedToId) filters.assignedToId = assignedToId
      if (query.courseId) filters.courseId = query.courseId
      if (query.sourceId) filters.sourceId = query.sourceId
      if (query.search) filters.search = query.search
      if (query.dateFrom) filters.dateFrom = query.dateFrom
      if (query.dateTo) filters.dateTo = query.dateTo
      if (role !== 'EMPLOYEE' && query.branchId) filters.branchId = query.branchId
      
      const where = buildLeadWhereClause({
        userId,
        userRole: role as Role,
        filters,
      })

    const [leads, total] = await Promise.all([
      fastify.prisma.lead.findMany({
        where,
        select: leadSummarySelect,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      fastify.prisma.lead.count({ where }),
    ])

    return reply.status(200).send({
      success: true,
      data: {
        leads,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  })
}