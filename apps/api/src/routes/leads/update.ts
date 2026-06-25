import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { canUpdateLead } from "@lms/auth";
import { Role, UpdateLeadSchema } from "@lms/types";
import { validateBody } from "../../middleware/validate";
import {
  invalidateActivityCache,
  invalidateAnalyticsCache,
} from "../../services/cache";
import { syncLeadFollowUpTask } from "../../services/followUpTasks";

export async function updateLeadRoute(fastify: FastifyInstance): Promise<void> {
  fastify.patch(
    "/:id",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { id: userId, role } = request.user;

      const lead = await fastify.prisma.lead.findUnique({
        where: { id },
        select: {
          id: true,
          assignedTo: { select: { id: true } },
          createdBy: { select: { id: true } },
          branchId: true,
          status: true,
        },
      });

      if (!lead) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Lead not found" },
        });
      }

      const canUpdate = canUpdateLead(
        { id: userId, role: role as Role, branchId: request.user.branchId },
        {
          id: lead.id,
          assignedToId: lead.assignedTo?.id ?? null,
          createdById: lead.createdBy.id,
          branchId: lead.branchId,
          status: lead.status,
        },
      );

      if (!canUpdate) {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "You cannot update this lead" },
        });
      }

      const validation = validateBody(UpdateLeadSchema, request.body);
      if (!validation.success) {
        return reply.status(400).send({ success: false, ...validation.error });
      }
      const body = validation.data;

      // Pull out fields that need special handling or must not reach lead.update()
      const {
        id: _id,
        status: _status,
        assignedToId: _assigned,
        branchId: _branch,
        createdById: _creator,
        isDuplicate: _dup,
        duplicateOfId: _dupOf,
        confirmedAt: _conf,
        confirmedById: _confBy,
        courseIds,           // handled separately via LeadCourse
        dateOfBirth,         // needs Date conversion
        nextFollowUpAt,      // needs Date conversion
        ...rest
      } = body as Record<string, unknown>;

      // Build the Prisma-safe update payload
      const leadData: Record<string, unknown> = { ...rest };
      if (dateOfBirth !== undefined) {
        leadData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth as string) : null;
      }
      if (nextFollowUpAt !== undefined) {
        leadData.nextFollowUpAt = nextFollowUpAt ? new Date(nextFollowUpAt as string) : null;
      }

      const updated = await fastify.prisma.$transaction(async (tx) => {
        const updatedLead = await tx.lead.update({
          where: { id },
          data: leadData as any,
        });

        // Update courses if provided
        if (Array.isArray(courseIds)) {
          await tx.leadCourse.deleteMany({ where: { leadId: id } });
          if (courseIds.length > 0) {
            await tx.leadCourse.createMany({
              data: (courseIds as string[]).map((courseId, index) => ({
                leadId: id,
                courseId,
                isPrimary: index === 0,
              })),
            });
          }
        }

        await tx.auditLog.create({
          data: {
            leadId: id,
            userId,
            action: "LEAD_UPDATED",
            newValue: leadData as Record<string, string | number | boolean | null>,
          },
        });

        await syncLeadFollowUpTask(tx, {
          leadId: updatedLead.id,
          studentName: updatedLead.studentName,
          branchId: updatedLead.branchId,
          assignedToId: updatedLead.assignedToId,
          actorUserId: userId,
          nextFollowUpAt: updatedLead.nextFollowUpAt,
        });

        return updatedLead;
      });

      await invalidateAnalyticsCache(fastify.redis);
      await invalidateActivityCache(fastify.redis, lead.branchId, userId);

      return reply.status(200).send({ success: true, data: updated });
    },
  );
}
