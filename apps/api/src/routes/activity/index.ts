import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { Role } from "@lms/types";

export async function activityRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { id: userId, role } = request.user;

      const where: Record<string, unknown> = {
        isDeleted: false,
      };

      // Employees only see activity on their leads
      if (role === Role.EMPLOYEE) {
        where["lead"] = {
          OR: [{ assignedToId: userId }, { createdById: userId }],
        };
      }

      const interactions = await fastify.prisma.interactionLog.findMany({
        where,
        select: {
          id: true,
          type: true,
          note: true,
          statusBefore: true,
          statusAfter: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
          lead: {
            select: {
              id: true,
              studentName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      return reply.status(200).send({ success: true, data: { interactions } });
    },
  );

  // GET /activity/notifications — user-specific unread events
  fastify.get(
    "/notifications",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { id: userId, role } = request.user;

      // Get recent events relevant to this user
      const where: Record<string, unknown> = {
        isDeleted: false,
        userId: { not: userId }, // exclude own actions
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // last 7 days
        },
      };

      if (role === "EMPLOYEE") {
        where["lead"] = {
          OR: [{ assignedToId: userId }, { createdById: userId }],
        };
      }

      const items = await fastify.prisma.interactionLog.findMany({
        where,
        select: {
          id: true,
          type: true,
          note: true,
          statusBefore: true,
          statusAfter: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
          lead: { select: { id: true, studentName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      });

      // Also get recent assignments to this user
      const assignments = await fastify.prisma.assignmentHistory.findMany({
        where: {
          assignedToId: userId,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: {
          id: true,
          createdAt: true,
          reason: true,
          assignedBy: { select: { id: true, name: true } },
          lead: { select: { id: true, studentName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      return reply.status(200).send({
        success: true,
        data: { interactions: items, assignments },
      });
    },
  );
}
