import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { canAddInteraction, canEditInteraction, canViewLead } from "@lms/auth";
import {
  InteractionType,
  Role,
  CreateInteractionSchema,
  EditInteractionSchema,
} from "@lms/types";
import { validateBody } from "../../middleware/validate";
import { dispatchInteractionNotification } from "../../services/notifications";
import { invalidateActivityCache } from "../../services/cache";
import {
  getMyCallsList,
  getMyInteractedLeadsCount,
  getMyInteractedLeadsList,
  computeEmployeeStats,
} from "../analytics/reporting";
import { getDateRange, toISTDateString } from "../analytics/helpers";
import type { Period } from "../analytics/helpers";
import { buildLeadWhereClause } from "../leads/service";

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function interactionRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  // ─────────────────────────────────────────
  // GET /leads/:leadId/interactions
  // Get all interactions for a lead
  // ─────────────────────────────────────────
  fastify.get(
    "/leads/:leadId/interactions",
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
    "/leads/:leadId/interactions",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { leadId } = request.params as { leadId: string };
      const { id: userId, role } = request.user;

      const validation = validateBody(CreateInteractionSchema, request.body);
      if (!validation.success) {
        return reply.status(400).send({ success: false, ...validation.error });
      }
      const body = validation.data;
      const { branchId } = request.user;

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

      await invalidateActivityCache(fastify.redis, branchId, userId);

      return reply.status(201).send({ success: true, data: interaction });
    },
  );

  // ─────────────────────────────────────────
  // PATCH /interactions/:id
  // Edit interaction note — admin/sub-admin only
  // ─────────────────────────────────────────
  fastify.patch(
    "/interactions/:id",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { id: userId } = request.user;
      const validation = validateBody(EditInteractionSchema, request.body);
      if (!validation.success) {
        return reply.status(400).send({ success: false, ...validation.error });
      }
      const { note } = validation.data;

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

      await invalidateActivityCache(
        fastify.redis,
        request.user.branchId,
        userId,
      );

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
    "/interactions/:id",
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

      await invalidateActivityCache(
        fastify.redis,
        request.user.branchId,
        userId,
      );

      return reply.status(200).send({
        success: true,
        data: { message: "Interaction removed" },
      });
    },
  );

  // ─────────────────────────────────────────
  // GET /me/call-stats
  // Returns today's call count, total call minutes, and daily breakdown
  // for the last 7 days — for the authenticated user (any role).
  // Day boundaries are IST-aligned via getDateRange(), same as every other
  // "today" computation in the app (getMyCallsList/getMyInteractedLeadsList),
  // so this widget's numbers always match the /my-calls and /leads
  // drill-throughs it links to.
  // ─────────────────────────────────────────
  fastify.get(
    "/me/call-stats",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id: userId } = request.user;

      const { from: todayStart, to: todayEnd } = getDateRange("today");
      const sevenDaysAgo = new Date(
        todayStart.getTime() - 6 * 24 * 60 * 60 * 1000,
      );

      const [callInteractions, leadsInteractedToday, confirmedToday, newLeadsToday] =
        await Promise.all([
          // CALL interactions for the last 7 days (for the chart)
          fastify.prisma.interactionLog.findMany({
            where: {
              userId,
              type: "CALL",
              isDeleted: false,
              createdAt: { gte: sevenDaysAgo, lte: todayEnd },
            },
            select: { callDurationSecs: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          }),

          // Distinct leads interacted with today (any type except STATUS_CHANGED)
          // — shares its WHERE clause with GET /me/interactions/leads so the
          // "Interacted" tile always matches its drill-through list.
          getMyInteractedLeadsCount({ prisma: fastify.prisma, userId, scope: "today" }),

          // Leads confirmed today by this user
          fastify.prisma.lead.count({
            where: {
              assignedToId: userId,
              status: "CONFIRMED",
              confirmedAt: { gte: todayStart, lte: todayEnd },
            },
          }),

          // New leads assigned today
          fastify.prisma.lead.count({
            where: {
              assignedToId: userId,
              createdAt: { gte: todayStart, lte: todayEnd },
            },
          }),
        ]);

      // Build daily buckets for the last 7 days
      const dailyMap = new Map<
        string,
        { callCount: number; totalMinutes: number }
      >();
      for (let d = 0; d < 7; d++) {
        const date = new Date(sevenDaysAgo.getTime() + d * 24 * 60 * 60 * 1000);
        const key = toISTDateString(date);
        dailyMap.set(key, { callCount: 0, totalMinutes: 0 });
      }

      let callsToday = 0;
      let secondsToday = 0;
      const todayKey = toISTDateString(todayStart);

      for (const row of callInteractions) {
        const key = toISTDateString(row.createdAt);
        const bucket = dailyMap.get(key);
        if (bucket) {
          bucket.callCount++;
          bucket.totalMinutes += row.callDurationSecs ?? 0;
        }
        if (key === todayKey) {
          callsToday++;
          secondsToday += row.callDurationSecs ?? 0;
        }
      }

      const daily = Array.from(dailyMap.entries()).map(
        ([date, { callCount, totalMinutes }]) => ({
          date,
          callCount,
          totalMinutes: Math.round(totalMinutes / 60),
        }),
      );

      return reply.send({
        success: true,
        data: {
          callsToday,
          minutesToday: Math.round(secondsToday / 60),
          secondsToday,
          leadsInteractedToday,
          confirmedToday,
          newLeadsToday,
          daily,
        },
      });
    },
  );

  // ─────────────────────────────────────────
  // GET /me/dashboard-overview
  // Employee Dashboard KPI cards — Total Leads (all-time), New/Confirmed/
  // Interested/Lost Leads (period), Overdue (current), Conversion Rate
  // (period), Total Calls/Total Call Duration/Total Leads Interacted
  // (period) — for the authenticated user only.
  //
  // Reuses computeEmployeeStats() — the SAME function the leaderboard and
  // per-employee admin report are built from — so an employee's own
  // dashboard numbers always match what an admin sees drilling into that
  // employee, and every period-scoped card here reconciles exactly with its
  // /leads or /my-calls drill-through (period cohort semantics: leads
  // created in the window, currently in that status / touched by this user).
  // ─────────────────────────────────────────
  fastify.get(
    "/me/dashboard-overview",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id: userId, role } = request.user;
      const q = request.query as {
        period?: Period;
        dateFrom?: string;
        dateTo?: string;
      };
      const period = q.period ?? "last30";

      // All-time portfolio counts — NOT period-scoped by design (they answer
      // "how many leads do I currently own", not "how much activity happened
      // in this window"). Built via buildLeadWhereClause so they match
      // /leads?showAllStatuses=true exactly.
      const totalAllTimeWhere = buildLeadWhereClause({
        userId,
        userRole: role as Role,
        filters: { showAllStatuses: true },
      });
      const activeAllTimeWhere = buildLeadWhereClause({
        userId,
        userRole: role as Role,
        filters: { excludeTerminal: true },
      });

      const [statsArr, totalLeadsAllTime, activeLeadsAllTime] = await Promise.all([
        computeEmployeeStats({
          prisma: fastify.prisma,
          period,
          ...(q.dateFrom ? { dateFrom: q.dateFrom } : {}),
          ...(q.dateTo ? { dateTo: q.dateTo } : {}),
          employeeId: userId,
        }),
        fastify.prisma.lead.count({ where: totalAllTimeWhere }),
        fastify.prisma.lead.count({ where: activeAllTimeWhere }),
      ]);

      const { from, to } = getDateRange(period, q.dateFrom, q.dateTo);

      return reply.status(200).send({
        success: true,
        data: {
          stats: statsArr[0] ?? null,
          totalLeadsAllTime,
          activeLeadsAllTime,
          period: { from: toISTDateString(from), to: toISTDateString(to) },
        },
      });
    },
  );

  // ─────────────────────────────────────────
  // GET /me/calls
  // Paginated call records for the authenticated user — powers the
  // "My Call Records" section and the Total Calls / Today's Calls /
  // Total Call Duration card drill-throughs.
  // ─────────────────────────────────────────
  fastify.get(
    "/me/calls",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id: userId } = request.user;
      const q = request.query as {
        page?: string;
        pageSize?: string;
        search?: string;
        dateFrom?: string;
        dateTo?: string;
        scope?: "all" | "today";
        sortOrder?: "asc" | "desc";
      };

      const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
      const rawPageSize = parseInt(q.pageSize ?? "20", 10) || 20;
      const pageSize = [20, 50, 80].includes(rawPageSize) ? rawPageSize : 20;

      const data = await getMyCallsList({
        prisma: fastify.prisma,
        userId,
        page,
        pageSize,
        ...(q.search ? { search: q.search } : {}),
        ...(q.dateFrom ? { dateFrom: q.dateFrom } : {}),
        ...(q.dateTo ? { dateTo: q.dateTo } : {}),
        ...(q.scope === "today" ? { scope: "today" as const } : {}),
        ...(q.sortOrder === "asc" ? { sortOrder: "asc" as const } : {}),
      });

      return reply.status(200).send({
        success: true,
        data: { ...data, totalPages: Math.ceil(data.total / data.pageSize) },
      });
    },
  );

  // ─────────────────────────────────────────
  // GET /me/interactions/leads
  // Paginated distinct leads the authenticated user has interacted with
  // (any interaction type except STATUS_CHANGED) — powers the Today's
  // Report "Interacted" tile drill-through. Defaults to today's scope,
  // matching /me/call-stats' leadsInteractedToday.
  // ─────────────────────────────────────────
  fastify.get(
    "/me/interactions/leads",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id: userId } = request.user;
      const q = request.query as {
        page?: string;
        pageSize?: string;
        search?: string;
        scope?: "all" | "today";
      };

      const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
      const rawPageSize = parseInt(q.pageSize ?? "20", 10) || 20;
      const pageSize = [20, 50, 80].includes(rawPageSize) ? rawPageSize : 20;

      const data = await getMyInteractedLeadsList({
        prisma: fastify.prisma,
        userId,
        page,
        pageSize,
        scope: q.scope === "all" ? "all" : "today",
        ...(q.search ? { search: q.search } : {}),
      });

      return reply.status(200).send({
        success: true,
        data: { ...data, totalPages: Math.ceil(data.total / data.pageSize) },
      });
    },
  );
}
