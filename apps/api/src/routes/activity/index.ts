import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { Role } from "@lms/types";

export async function activityRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Activity feed (admin/sub-admin dashboard) ──
  fastify.get("/", { preHandler: authenticate }, async (request, reply) => {
    const { id: userId, role, branchId } = request.user;
    const cacheKey = `activity:${role}:${branchId}:${userId}`;

    // Check Redis cache — 30 second TTL
    try {
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return reply.send({ success: true, data: JSON.parse(cached) });
      }
    } catch {}

    const where: Record<string, unknown> = { isDeleted: false };

    if (role === Role.EMPLOYEE) {
      // Employee sees only their own interactions on their own leads
      where["userId"] = userId;
      where["lead"] = {
        OR: [{ assignedToId: userId }, { createdById: userId }],
      };
    } else {
      // Admin/SubAdmin — scoped to branch
      where["lead"] = { branchId };
    }

    const [interactions, assignments] = await Promise.all([
      fastify.prisma.interactionLog.findMany({
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
        take: 25,
      }),
      fastify.prisma.assignmentHistory.findMany({
        where: {
          lead: { branchId },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          ...(role === Role.EMPLOYEE ? { assignedToId: userId } : {}),
        },
        select: {
          id: true,
          createdAt: true,
          reason: true,
          assignedBy: { select: { id: true, name: true } },
          lead: { select: { id: true, studentName: true } },
          assignedToId: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    const data = { interactions, assignments };

    try {
      await fastify.redis.setex(cacheKey, 30, JSON.stringify(data));
    } catch {}

    return reply.send({ success: true, data });
  });

  // ── Role-specific notifications ──
  fastify.get(
    "/notifications",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id: userId, role, branchId } = request.user;
      const cacheKey = `notifs:${userId}`;

      try {
        const cached = await fastify.redis.get(cacheKey);
        if (cached)
          return reply.send({ success: true, data: JSON.parse(cached) });
      } catch {}

      // Role-based where clause for interactions
      const interactionWhere: Record<string, unknown> = {
        isDeleted: false,
        userId: { not: userId }, // exclude own actions
        createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }, // last 3 days
      };

      if (role === Role.EMPLOYEE) {
        // Employee only sees interactions on their leads
        interactionWhere["lead"] = {
          OR: [{ assignedToId: userId }, { createdById: userId }],
        };
      } else {
        // Admin/SubAdmin see all branch interactions
        interactionWhere["lead"] = { branchId };
      }

      // Assignment notifications — "X assigned a lead to you"
      const assignmentWhere: Record<string, unknown> = {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      };

      if (role === Role.EMPLOYEE) {
        // Employee only sees assignments TO them
        assignmentWhere["assignedToId"] = userId;
      } else {
        // Admin/SubAdmin see all assignments in branch
        assignmentWhere["lead"] = { branchId };
      }

      const [interactions, assignments, overdueLeads] = await Promise.all([
        fastify.prisma.interactionLog.findMany({
          where: interactionWhere,
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
          take: 20,
        }),

        fastify.prisma.assignmentHistory.findMany({
          where: assignmentWhere,
          select: {
            id: true,
            createdAt: true,
            reason: true,
            assignedBy: { select: { id: true, name: true } },
            assignedToId: true,
            lead: { select: { id: true, studentName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),

        // Overdue follow-ups relevant to user
        fastify.prisma.lead.findMany({
          where: {
            nextFollowUpAt: { lte: new Date() },
            status: { notIn: ["CONFIRMED", "DUPLICATE", "LOST"] },
            ...(role === Role.EMPLOYEE
              ? { OR: [{ assignedToId: userId }, { createdById: userId }] }
              : { branchId }),
          },
          select: {
            id: true,
            studentName: true,
            nextFollowUpAt: true,
            assignedTo: { select: { id: true, name: true } },
          },
          orderBy: { nextFollowUpAt: "asc" },
          take: 5,
        }),
      ]);

      const data = {
        interactions,
        assignments,
        overdueLeads,
        userRole: role,
        userId,
      };

      try {
        await fastify.redis.setex(cacheKey, 60, JSON.stringify(data)); // 60s cache
      } catch {}

      return reply.send({ success: true, data });
    },
  );
}
