import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { LeadListQuerySchema } from "@lms/types";
import { validateQuery } from "../../middleware/validate";
import { buildLeadWhereClause, leadSummarySelect } from "./service";
import type { LeadStatus, Role } from "@lms/types";

const ALLOWED_PAGE_SIZES = [20, 50, 80];
const DEFAULT_PAGE_SIZE = 20;

const SORT_FIELDS: Record<string, string> = {
  createdAt: "createdAt",
  studentName: "studentName",
  status: "status",
  nextFollowUpAt: "nextFollowUpAt",
};

export async function leadListRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const qValidation = validateQuery(LeadListQuerySchema, request.query);
      if (!qValidation.success) {
        return reply.status(400).send({ success: false, ...qValidation.error });
      }

      const query = qValidation.data;
      // showAllStatuses bypasses the default CONFIRMED/INTERESTED exclusion (used by dashboard drill-through)
      const rawQuery = request.query as Record<string, string | undefined>;
      const showAllStatuses = rawQuery.showAllStatuses === "true";
      const page = Math.max(1, query.page);
      const pageSize = ALLOWED_PAGE_SIZES.includes(query.pageSize)
        ? query.pageSize
        : DEFAULT_PAGE_SIZE;

      const sortBy = SORT_FIELDS[query.sortBy ?? "createdAt"] ?? "createdAt";
      const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

      const { id: userId, role } = request.user;

      const assignedToId = role === "EMPLOYEE" ? undefined : query.assignedToId;
      const filters: Parameters<typeof buildLeadWhereClause>[0]["filters"] = {};

      if (query.statuses) {
        const parsed = query.statuses.split(",").map(s => s.trim()).filter(Boolean) as LeadStatus[];
        if (parsed.length > 0) filters.statuses = parsed;
      }
      if (query.status) filters.status = query.status as LeadStatus;
      if (query.interactionType) filters.interactionType = query.interactionType;
      if (query.interactedByUserId) filters.interactedByUserId = query.interactedByUserId;
      if (assignedToId) filters.assignedToId = assignedToId;
      if (query.courseId) filters.courseId = query.courseId;
      if (query.sourceId) filters.sourceId = query.sourceId;
      if (query.search) filters.search = query.search;
      if (query.dateFrom) filters.dateFrom = query.dateFrom;
      if (query.dateTo) filters.dateTo = query.dateTo;
      if (role !== "EMPLOYEE" && query.branchId)
        filters.branchId = query.branchId;
      if (query.overdue) filters.overdue = true;
      if (rawQuery.upcoming === "true") filters.upcoming = true;
      if (showAllStatuses) filters.showAllStatuses = true;
      if (rawQuery.excludeTerminal === "true") filters.excludeTerminal = true;
      if (rawQuery.dateBy === "confirmedAt") filters.dateBy = "confirmedAt";

      const where = buildLeadWhereClause({
        userId,
        userRole: role as Role,
        filters,
      });

      const [leads, total] = await Promise.all([
        fastify.prisma.lead.findMany({
          where,
          select: leadSummarySelect,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        fastify.prisma.lead.count({ where }),
      ]);

      return reply.status(200).send({
        success: true,
        data: {
          leads,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    },
  );
}
