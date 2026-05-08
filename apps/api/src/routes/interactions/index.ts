import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { canAddInteraction, canEditInteraction, canViewLead } from "@lms/auth";
import { InteractionType, Role } from "@lms/types";
import { dispatchInteractionNotification } from "../../services/notifications";

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function interactionRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  // ─────────────────────────────────────────
  // GET /leads/:leadId/interactions
  // Get all interactions for a lead
  // ─────────────────────────────────────────
  fastify.get(
    "/:leadId/interactions",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { leadId } = request.params as { leadId: string };
      const { id: userId, role } = request.user;

      const query = request.query as {
        type?: string;
        page?: string;
      };

      const page = Math.max(1, parseInt(query.page ?? "1", 10));
      const pageSize = 20;

      // Verify lead exists and user can view it
      const lead = await fastify.prisma.lead.findUnique({
        where: { id: leadId },
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

      const canView = canViewLead(
        { id: userId, role: role as Role, branchId: request.user.branchId },
        {
          id: lead.id,
          assignedToId: lead.assignedTo?.id ?? null,
          createdById: lead.createdBy.id,
          branchId: lead.branchId,
          status: lead.status,
        },
      );

      if (!canView) {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "Access denied" },
        });
      }

      // Build where clause
      const where: Record<string, unknown> = {
        leadId,
        isDeleted: false,
      };

      // Filter by type if provided
      if (query.type) {
        where["type"] = query.type;
      }

      const [interactions, total] = await Promise.all([
        fastify.prisma.interactionLog.findMany({
          where,
          select: {
            id: true,
            type: true,
            note: true,
            callRecordingUrl: true,
            callDurationSecs: true,
            callDirection: true,
            statusBefore: true,
            statusAfter: true,
            smsSent: true,
            emailSent: true,
            isEdited: true,
            createdAt: true,
            user: {
              select: { id: true, name: true, role: true },
            },
            editHistory: {
              select: {
                id: true,
                noteBefore: true,
                noteAfter: true,
                editedAt: true,
                editedBy: { select: { id: true, name: true } },
              },
              orderBy: { editedAt: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        fastify.prisma.interactionLog.count({ where }),
      ]);

      return reply.status(200).send({
        success: true,
        data: { interactions, total, page, pageSize },
      });
    },
  );

  // ─────────────────────────────────────────
  // POST /leads/:leadId/interactions
  // Add interaction/feedback to a lead
  // ─────────────────────────────────────────
  fastify.post(
    "/:leadId/interactions",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { leadId } = request.params as { leadId: string };
      const { id: userId, role } = request.user;

      const body = request.body as {
        type: InteractionType;
        note?: string;
        callRecordingUrl?: string;
        callDurationSecs?: number;
        callDirection?: string;
        isDuplicateDetected?: boolean; // tags note as duplicate detection
      };

      if (!body.type) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "Interaction type is required",
          },
        });
      }

      // Fetch lead with full context
      const lead = await fastify.prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          studentName: true,
          branchId: true,
          status: true,
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          createdBy: { select: { id: true } },
        },
      });

      if (!lead) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Lead not found" },
        });
      }

      // Permission check
      const canAdd = canAddInteraction(
        { id: userId, role: role as Role, branchId: request.user.branchId },
        {
          id: lead.id,
          assignedToId: lead.assignedTo?.id ?? null,
          createdById: lead.createdBy.id,
          branchId: lead.branchId,
          status: lead.status,
        },
      );

      if (!canAdd) {
        return reply.status(403).send({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You cannot add interactions to this lead",
          },
        });
      }

      // Build note — tag duplicate detection notes
      const finalNote = body.isDuplicateDetected
        ? `[DUPLICATE DETECTED] ${body.note ?? ""}`
        : (body.note ?? null);

      // Create interaction
      const interaction = await fastify.prisma.interactionLog.create({
        data: {
          leadId,
          userId,
          type: body.type,
          note: finalNote,
          callRecordingUrl: body.callRecordingUrl ?? null,
          callDurationSecs: body.callDurationSecs ?? null,
          callDirection: body.callDirection ?? null,
          statusBefore: lead.status as any,
        },
        select: {
          id: true,
          type: true,
          note: true,
          callRecordingUrl: true,
          callDurationSecs: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
      });

      // Fetch actor name for notification
      const actor = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      // Dispatch notifications
      await dispatchInteractionNotification({
        fastify,
        context: {
          leadId,
          studentName: lead.studentName,
          actorId: userId,
          actorName: actor?.name ?? "Someone",
          assignedToId: lead.assignedTo?.id ?? null,
          assignedToEmail: lead.assignedTo?.email ?? null,
          assignedToName: lead.assignedTo?.name ?? null,
          branchId: lead.branchId,
        },
        interactionType: body.type,
        note: finalNote,
      });

      return reply.status(201).send({ success: true, data: interaction });
    },
  );

  // ─────────────────────────────────────────
  // PATCH /interactions/:id
  // Edit interaction note — 24 hour window
  // ─────────────────────────────────────────
  fastify.patch(
    "/:id",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { id: userId } = request.user;
      const { note } = request.body as { note?: string };

      if (!note?.trim()) {
        return reply.status(400).send({
          success: false,
          error: { code: "INVALID_INPUT", message: "Note content is required" },
        });
      }

      const interaction = await fastify.prisma.interactionLog.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          note: true,
          isDeleted: true,
          createdAt: true,
          type: true,
        },
      });

      if (!interaction) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Interaction not found" },
        });
      }

      // Permission — only own notes
      const canEdit = canEditInteraction(
        {
          id: userId,
          role: request.user.role as Role,
          branchId: request.user.branchId,
        },
        {
          id: interaction.id,
          userId: interaction.userId,
          isDeleted: interaction.isDeleted,
        },
      );

      if (!canEdit) {
        return reply.status(403).send({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You can only edit your own notes",
          },
        });
      }

      // Check 24 hour edit window
      const ageMs = Date.now() - interaction.createdAt.getTime();
      if (ageMs > EDIT_WINDOW_MS) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "EDIT_WINDOW_EXPIRED",
            message: "Notes can only be edited within 24 hours of creation",
          },
        });
      }

      // Check it's an editable type — can't edit STATUS_CHANGED system notes
      if (interaction.type === InteractionType.STATUS_CHANGED) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "System-generated status change notes cannot be edited",
          },
        });
      }

      // Save edit trail + update note in transaction
      await fastify.prisma.$transaction(async (tx) => {
        // Store the edit in history
        await tx.interactionLogEdit.create({
          data: {
            interactionLogId: id,
            editedById: userId,
            noteBefore: interaction.note ?? "",
            noteAfter: note.trim(),
          },
        });

        // Update current note + mark as edited
        await tx.interactionLog.update({
          where: { id },
          data: {
            note: note.trim(),
            isEdited: true,
          },
        });
      });

      return reply.status(200).send({
        success: true,
        data: { message: "Note updated successfully" },
      });
    },
  );

  // ─────────────────────────────────────────
  // DELETE /interactions/:id
  // Soft delete — ADMIN only
  // ─────────────────────────────────────────
  fastify.delete(
    "/:id",
    {
      preHandler: [authenticate, authorize([Role.ADMIN])],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { id: userId } = request.user;

      const interaction = await fastify.prisma.interactionLog.findUnique({
        where: { id },
        select: { id: true, isDeleted: true },
      });

      if (!interaction) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Interaction not found" },
        });
      }

      if (interaction.isDeleted) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "ALREADY_DELETED",
            message: "Interaction already deleted",
          },
        });
      }

      await fastify.prisma.interactionLog.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedById: userId,
        },
      });

      return reply.status(200).send({
        success: true,
        data: { message: "Interaction removed" },
      });
    },
  );
}
