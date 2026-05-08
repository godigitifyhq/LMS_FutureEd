import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { canUpdateLead } from "@lms/auth";
import { Role } from "@lms/types";

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

      const body = request.body as Record<string, unknown>;

      // Strip fields that cannot be updated via this endpoint
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
        ...updateData
      } = body;

      const updated = await fastify.prisma.$transaction(async (tx) => {
        const updatedLead = await tx.lead.update({
          where: { id },
          data: updateData as any,
        });

        await tx.auditLog.create({
          data: {
            leadId: id,
            userId,
            action: "LEAD_UPDATED",
            newValue: updateData as Record<
              string,
              string | number | boolean | null
            >,
          },
        });

        return updatedLead;
      });

      return reply.status(200).send({ success: true, data: updated });
    },
  );
}
