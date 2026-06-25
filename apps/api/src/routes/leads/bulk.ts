import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { transitionLead } from "@lms/core";
import {
  LeadStatus,
  Role,
  BulkAssignSchema,
  BulkStatusSchema,
} from "@lms/types";
import { validateBody } from "../../middleware/validate";
import {
  invalidateActivityCache,
  invalidateAnalyticsCache,
} from "../../services/cache";
import { syncLeadFollowUpTask } from "../../services/followUpTasks";

export async function bulkLeadRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /leads/bulk-assign ──
  fastify.post(
    "/bulk-assign",
    {
      preHandler: [authenticate, authorize([Role.ADMIN, Role.SUB_ADMIN])],
    },
    async (request, reply) => {
      const validation = validateBody(BulkAssignSchema, request.body);
      if (!validation.success) {
        return reply.status(400).send({ success: false, ...validation.error });
      }
      const { leadIds, assignedToId, reason } = validation.data;

      const assignee = await fastify.prisma.user.findUnique({
        where: { id: assignedToId },
        select: { id: true, role: true, isActive: true },
      });

      if (!assignee || !assignee.isActive || assignee.role !== "EMPLOYEE") {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "Assignee must be an active employee",
          },
        });
      }

      const { id: userId } = request.user;

      await fastify.prisma.$transaction(async (tx) => {
        const leadsToAssign = await tx.lead.findMany({
          where: {
            id: { in: leadIds },
            status: { notIn: ["CONFIRMED", "DUPLICATE"] },
          },
          select: {
            id: true,
            studentName: true,
            branchId: true,
            nextFollowUpAt: true,
          },
        });

        await tx.lead.updateMany({
          where: {
            id: { in: leadIds },
            status: { notIn: ["CONFIRMED", "DUPLICATE"] },
          },
          data: { assignedToId },
        });

        for (const lead of leadsToAssign) {
          await syncLeadFollowUpTask(tx, {
            leadId: lead.id,
            studentName: lead.studentName,
            branchId: lead.branchId,
            assignedToId,
            actorUserId: userId,
            nextFollowUpAt: lead.nextFollowUpAt,
          });
        }

        await tx.assignmentHistory.createMany({
          data: leadIds.map((leadId) => ({
            leadId,
            assignedById: userId,
            assignedToId,
            reason: reason ?? "Bulk assignment",
          })),
        });

        await tx.auditLog.createMany({
          data: leadIds.map((leadId) => ({
            leadId,
            userId,
            action: "BULK_ASSIGNED",
            newValue: { assignedToId },
          })),
        });
      });

      await invalidateAnalyticsCache(fastify.redis);
      await invalidateActivityCache(
        fastify.redis,
        request.user.branchId,
        userId,
      );

      return reply.status(200).send({
        success: true,
        data: { assigned: leadIds.length, assignedToId },
      });
    },
  );

  // ── POST /leads/bulk-status ──
  fastify.post(
    "/bulk-status",
    {
      preHandler: [authenticate, authorize([Role.ADMIN, Role.SUB_ADMIN])],
    },
    async (request, reply) => {
      const validation2 = validateBody(BulkStatusSchema, request.body);
      if (!validation2.success) {
        return reply.status(400).send({ success: false, ...validation2.error });
      }
      const { leadIds, toStatus, note } = validation2.data;

      const leads = await fastify.prisma.lead.findMany({
        where: { id: { in: leadIds } },
        select: { id: true, status: true },
      });

      const { id: userId } = request.user;
      const successful: string[] = [];
      const failed: Array<{ id: string; reason: string }> = [];
      const statusBefore: Record<string, LeadStatus> = {};

      for (const lead of leads) {
        const result = transitionLead(lead.status as LeadStatus, toStatus);
        if (result.success) {
          successful.push(lead.id);
          statusBefore[lead.id] = lead.status as LeadStatus;
        } else {
          failed.push({ id: lead.id, reason: result.error.message });
        }
      }

      if (successful.length > 0) {
        await fastify.prisma.$transaction(async (tx) => {
          const leadsForTasks = await tx.lead.findMany({
            where: { id: { in: successful } },
            select: {
              id: true,
              studentName: true,
              branchId: true,
              assignedToId: true,
              nextFollowUpAt: true,
            },
          });

          await tx.lead.updateMany({
            where: { id: { in: successful } },
            data: { status: toStatus },
          });

          const shouldCancelFollowUpTask =
            toStatus === "CONFIRMED" ||
            toStatus === "LOST" ||
            toStatus === "DUPLICATE";

          for (const lead of leadsForTasks) {
            await syncLeadFollowUpTask(tx, {
              leadId: lead.id,
              studentName: lead.studentName,
              branchId: lead.branchId,
              assignedToId: lead.assignedToId,
              actorUserId: userId,
              nextFollowUpAt: shouldCancelFollowUpTask
                ? null
                : lead.nextFollowUpAt,
            });
          }

          await tx.interactionLog.createMany({
            data: successful.map((leadId) => ({
              leadId,
              userId,
              type: "STATUS_CHANGED" as const,
              note: note ?? "Bulk status change",
              statusBefore: statusBefore[leadId] ?? null,
              statusAfter: toStatus,
            })),
          });

          await tx.auditLog.createMany({
            data: successful.map((leadId) => ({
              leadId,
              userId,
              action: "BULK_STATUS_CHANGED",
              newValue: { status: toStatus },
            })),
          });
        });

        await invalidateAnalyticsCache(fastify.redis);
        await invalidateActivityCache(
          fastify.redis,
          request.user.branchId,
          userId,
        );
      }

      return reply.status(200).send({
        success: true,
        data: { successful: successful.length, failed },
      });
    },
  );
}
