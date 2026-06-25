import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { canAssignLead } from "@lms/auth";
import { validateReassignment } from "@lms/core";
import { Role, AssignLeadSchema } from "@lms/types";
import { validateBody } from "../../middleware/validate";
import {
  invalidateAnalyticsCache,
  invalidateActivityCache,
} from "../../services/cache";
import { syncLeadFollowUpTask } from "../../services/followUpTasks";

export async function assignLeadRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    "/:id/assign",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { id: userId, role } = request.user;
      const bodyValidation = validateBody(AssignLeadSchema, request.body);
      if (!bodyValidation.success) {
        return reply
          .status(400)
          .send({ success: false, ...bodyValidation.error });
      }
      const { assignedToId, reason } = bodyValidation.data;

      if (
        !canAssignLead({
          id: userId,
          role: role as Role,
          branchId: request.user.branchId,
        })
      ) {
        return reply.status(403).send({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only Sub Admin and Admin can assign leads",
          },
        });
      }

      const [lead, newAssignee] = await Promise.all([
        fastify.prisma.lead.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            studentName: true,
            branchId: true,
            nextFollowUpAt: true,
          },
        }),
        fastify.prisma.user.findUnique({
          where: { id: assignedToId },
          select: { id: true, role: true, isActive: true },
        }),
      ]);

      if (!lead) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Lead not found" },
        });
      }

      if (!newAssignee || !newAssignee.isActive) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Assignee not found or inactive",
          },
        });
      }

      const reassignmentValidation = validateReassignment({
        newAssigneeId: assignedToId,
        newAssigneeRole: newAssignee.role as Role,
        leadStatus: lead.status,
      });

      if (!reassignmentValidation.success) {
        return reply.status(400).send({
          success: false,
          error: reassignmentValidation.error,
        });
      }

      await fastify.prisma.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id },
          data: { assignedToId },
        });

        await syncLeadFollowUpTask(tx, {
          leadId: lead.id,
          studentName: lead.studentName,
          branchId: lead.branchId,
          assignedToId,
          actorUserId: userId,
          nextFollowUpAt: lead.nextFollowUpAt,
        });

        await tx.assignmentHistory.create({
          data: {
            leadId: id,
            assignedById: userId,
            assignedToId,
            reason: reason ?? null,
          },
        });

        await tx.auditLog.create({
          data: {
            leadId: id,
            userId,
            action: "LEAD_ASSIGNED",
            newValue: { assignedToId, reason },
          },
        });
      });

      await invalidateAnalyticsCache(fastify.redis);
      await invalidateActivityCache(
        fastify.redis,
        request.user.branchId,
        request.user.id,
      );

      return reply.status(200).send({ success: true, data: { assignedToId } });
    },
  );
}
