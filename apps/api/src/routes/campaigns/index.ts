import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import {
  Role,
  CampaignListQuerySchema,
  AssignCampaignSchema,
  UpdateCampaignSchema,
  CampaignProgressSchema,
} from "@lms/types";
import {
  distributeLeadsRoundRobin,
  nextVersionedName,
  resolveResumeIndex,
  neighbourIds,
} from "@lms/core";
import { validateBody, validateQuery } from "../../middleware/validate";
import {
  invalidateAnalyticsCache,
  invalidateActivityCache,
} from "../../services/cache";
import { syncLeadFollowUpTask } from "../../services/followUpTasks";
import { leadSummarySelect } from "../leads/service";

// Leads in these statuses are never reassigned by a campaign assignment —
// matches the bulk-assign rule so a confirmed admission can't be handed
// around by accident.
const LOCKED_STATUSES = ["CONFIRMED", "DUPLICATE"] as const;

// Work-view order: oldest first so the queue is stable while new leads
// arrive, then id as a tiebreaker so pagination never skips or repeats.
const WORK_ORDER = [{ createdAt: "asc" as const }, { id: "asc" as const }];

type CampaignStats = {
  leadCount: number;
  newCount: number;       // still NEW — the campaign's "remaining"
  workedCount: number;    // leadCount − newCount
  unassignedCount: number;
  progress: number;       // 0..1
};

async function campaignStats(
  prisma: FastifyInstance["prisma"],
  campaignIds: string[],
): Promise<Map<string, CampaignStats>> {
  const out = new Map<string, CampaignStats>();
  if (campaignIds.length === 0) return out;

  const [totals, news, unassigned] = await Promise.all([
    prisma.lead.groupBy({
      by: ["campaignId"],
      where: { campaignId: { in: campaignIds } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["campaignId"],
      where: { campaignId: { in: campaignIds }, status: "NEW" },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["campaignId"],
      where: { campaignId: { in: campaignIds }, assignedToId: null },
      _count: { _all: true },
    }),
  ]);

  const newMap = new Map(news.map((r) => [r.campaignId!, r._count._all]));
  const unMap = new Map(unassigned.map((r) => [r.campaignId!, r._count._all]));
  for (const id of campaignIds) {
    out.set(id, { leadCount: 0, newCount: 0, workedCount: 0, unassignedCount: 0, progress: 0 });
  }
  for (const r of totals) {
    const id = r.campaignId!;
    const leadCount = r._count._all;
    const newCount = newMap.get(id) ?? 0;
    const workedCount = leadCount - newCount;
    out.set(id, {
      leadCount,
      newCount,
      workedCount,
      unassignedCount: unMap.get(id) ?? 0,
      progress: leadCount > 0 ? workedCount / leadCount : 0,
    });
  }
  return out;
}

// EMPLOYEE may only touch campaigns they are assigned to.
async function assertCampaignAccess(
  fastify: FastifyInstance,
  campaignId: string,
  user: { id: string; role: Role; branchId: string },
) {
  const campaign = await fastify.prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      assignees: { select: { userId: true, user: { select: { id: true, name: true, email: true } } } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!campaign) return { campaign: null, allowed: false };
  if (user.role === Role.EMPLOYEE) {
    const isAssignee = campaign.assignees.some((a) => a.userId === user.id);
    return { campaign, allowed: isAssignee };
  }
  if (user.role === Role.SUB_ADMIN && campaign.branchId !== user.branchId) {
    return { campaign, allowed: false };
  }
  return { campaign, allowed: true };
}

// The ordered lead ids an employee works in a campaign. Managers see the
// whole campaign; employees see only leads assigned to them.
async function workLeadIds(
  fastify: FastifyInstance,
  campaignId: string,
  user: { id: string; role: Role },
): Promise<string[]> {
  const rows = await fastify.prisma.lead.findMany({
    where: {
      campaignId,
      ...(user.role === Role.EMPLOYEE ? { assignedToId: user.id } : {}),
    },
    select: { id: true },
    orderBy: WORK_ORDER,
  });
  return rows.map((r) => r.id);
}

export async function campaignRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /campaigns — list with filters + stats ──
  fastify.get("/", { preHandler: authenticate }, async (request, reply) => {
    const q = validateQuery(CampaignListQuerySchema, request.query);
    if (!q.success) {
      return reply.status(400).send({ success: false, ...q.error });
    }
    const query = q.data;
    const { id: userId, role, branchId: userBranchId } = request.user;

    const and: Record<string, unknown>[] = [];

    // Scope: employee → assigned campaigns only; sub-admin → own branch
    if (role === Role.EMPLOYEE) {
      and.push({ assignees: { some: { userId } } });
    } else if (role === Role.SUB_ADMIN) {
      and.push({ branchId: userBranchId });
    } else if (query.branchId) {
      and.push({ branchId: query.branchId });
    }

    if (query.status === "archived") and.push({ isArchived: true });
    else if (query.status !== "all") and.push({ isArchived: false });

    if (query.search) {
      and.push({
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { sourceFile: { contains: query.search, mode: "insensitive" } },
        ],
      });
    }
    if (query.assigneeId === "unassigned") and.push({ assignees: { none: {} } });
    else if (query.assigneeId) and.push({ assignees: { some: { userId: query.assigneeId } } });
    if (query.createdById) and.push({ createdById: query.createdById });
    if (query.dateFrom) and.push({ createdAt: { gte: new Date(`${query.dateFrom}T00:00:00.000+05:30`) } });
    if (query.dateTo) and.push({ createdAt: { lte: new Date(`${query.dateTo}T23:59:59.999+05:30`) } });

    const where = and.length ? { AND: and } : {};

    // leadCount / progress sort needs the stats first, so fetch the full
    // matching set (campaign counts are small — one per import) and page
    // in memory; createdAt / name sort pages in the DB.
    const dbSortable = query.sortBy === "createdAt" || query.sortBy === "name";
    const baseArgs = {
      where,
      include: {
        assignees: { select: { user: { select: { id: true, name: true, email: true } } } },
        createdBy: { select: { id: true, name: true } },
      },
    } as const;

    let campaigns;
    let total: number;
    if (dbSortable) {
      [campaigns, total] = await Promise.all([
        fastify.prisma.campaign.findMany({
          ...baseArgs,
          orderBy: { [query.sortBy]: query.sortOrder },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        fastify.prisma.campaign.count({ where }),
      ]);
    } else {
      campaigns = await fastify.prisma.campaign.findMany({ ...baseArgs, orderBy: { createdAt: "desc" } });
      total = campaigns.length;
    }

    const stats = await campaignStats(fastify.prisma, campaigns.map((c) => c.id));

    let rows = campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      sourceFile: c.sourceFile,
      isArchived: c.isArchived,
      createdAt: c.createdAt,
      createdBy: c.createdBy,
      assignees: c.assignees.map((a) => a.user),
      ...stats.get(c.id)!,
    }));

    // "completed" / "active" are derived from stats, so they filter here.
    if (query.status === "completed") rows = rows.filter((r) => r.leadCount > 0 && r.newCount === 0);
    else if (query.status === "active") rows = rows.filter((r) => r.leadCount === 0 || r.newCount > 0);

    if (!dbSortable) {
      const dir = query.sortOrder === "asc" ? 1 : -1;
      const key = query.sortBy as "leadCount" | "progress";
      rows.sort((a, b) => (a[key] - b[key]) * dir);
      total = rows.length;
      rows = rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
    } else if (query.status === "completed" || query.status === "active") {
      total = rows.length; // best effort — status filter applied post-page
    }

    // Summary strip over the WHOLE filtered set (not just this page). One
    // campaign per import keeps this small enough to compute on every list.
    const allMatching = await fastify.prisma.campaign.findMany({
      where,
      select: { id: true, assignees: { select: { userId: true } } },
    });
    const allStats = await campaignStats(fastify.prisma, allMatching.map((c) => c.id));
    const summary = { campaigns: 0, leads: 0, remaining: 0, unassignedCampaigns: 0 };
    for (const c of allMatching) {
      const s = allStats.get(c.id)!;
      const isCompleted = s.leadCount > 0 && s.newCount === 0;
      if (query.status === "completed" && !isCompleted) continue;
      if (query.status === "active" && isCompleted) continue;
      summary.campaigns++;
      summary.leads += s.leadCount;
      summary.remaining += s.newCount;
      if (c.assignees.length === 0) summary.unassignedCampaigns++;
    }

    return reply.status(200).send({
      success: true,
      data: {
        campaigns: rows,
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        summary,
      },
    });
  });

  // ── GET /campaigns/:id — detail + stats + my resume cursor ──
  fastify.get("/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { campaign, allowed } = await assertCampaignAccess(fastify, id, request.user);
    if (!campaign) {
      return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Campaign not found" } });
    }
    if (!allowed) {
      return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "You are not assigned to this campaign" } });
    }

    const [stats, ids, progress, perAssignee] = await Promise.all([
      campaignStats(fastify.prisma, [id]),
      workLeadIds(fastify, id, request.user),
      fastify.prisma.campaignProgress.findUnique({
        where: { campaignId_userId: { campaignId: id, userId: request.user.id } },
      }),
      fastify.prisma.lead.groupBy({
        by: ["assignedToId", "status"],
        where: { campaignId: id },
        _count: { _all: true },
      }),
    ]);

    const resume = resolveResumeIndex(ids, progress?.lastLeadId ?? null);

    // per-assignee breakdown: total + remaining(NEW)
    const byAssignee = new Map<string, { total: number; remaining: number }>();
    for (const r of perAssignee) {
      const key = r.assignedToId ?? "unassigned";
      const cur = byAssignee.get(key) ?? { total: 0, remaining: 0 };
      cur.total += r._count._all;
      if (r.status === "NEW") cur.remaining += r._count._all;
      byAssignee.set(key, cur);
    }

    return reply.status(200).send({
      success: true,
      data: {
        id: campaign.id,
        name: campaign.name,
        sourceFile: campaign.sourceFile,
        isArchived: campaign.isArchived,
        createdAt: campaign.createdAt,
        createdBy: campaign.createdBy,
        assignees: campaign.assignees.map((a) => ({
          ...a.user,
          ...(byAssignee.get(a.userId) ?? { total: 0, remaining: 0 }),
        })),
        unassigned: byAssignee.get("unassigned") ?? { total: 0, remaining: 0 },
        ...stats.get(id)!,
        myQueue: { total: resume.total, resumeIndex: resume.index, resumeLeadId: resume.leadId },
      },
    });
  });

  // ── POST /campaigns/:id/assign — (re)assign ALL leads across the given users ──
  fastify.post(
    "/:id/assign",
    { preHandler: [authenticate, authorize([Role.ADMIN, Role.SUB_ADMIN])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const v = validateBody(AssignCampaignSchema, request.body);
      if (!v.success) return reply.status(400).send({ success: false, ...v.error });
      const { userIds, reason } = v.data;
      const { id: actorId, role: actorRole } = request.user;

      const { campaign, allowed } = await assertCampaignAccess(fastify, id, request.user);
      if (!campaign) {
        return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Campaign not found" } });
      }
      if (!allowed) {
        return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Campaign belongs to another branch" } });
      }

      const users = await fastify.prisma.user.findMany({
        where: { id: { in: userIds }, isActive: true },
        select: { id: true, role: true },
      });
      if (users.length !== new Set(userIds).size) {
        return reply.status(400).send({
          success: false,
          error: { code: "INVALID_INPUT", message: "One or more assignees not found or inactive" },
        });
      }
      // Same rule as bulk-assign: only Admins may assign to managers.
      if (actorRole !== Role.ADMIN && users.some((u) => u.role !== Role.EMPLOYEE)) {
        return reply.status(400).send({
          success: false,
          error: { code: "INVALID_ASSIGNMENT", message: "Only Admins can assign campaigns to Admins or Sub Admins" },
        });
      }

      // Stable assignee order = the order the caller chose.
      const assigneeIds = userIds.filter((u, i) => userIds.indexOf(u) === i);

      const result = await fastify.prisma.$transaction(async (tx) => {
        const leads = await tx.lead.findMany({
          where: { campaignId: id, status: { notIn: [...LOCKED_STATUSES] } },
          select: { id: true, studentName: true, branchId: true, nextFollowUpAt: true, assignedToId: true },
          orderBy: WORK_ORDER,
        });

        const plan = distributeLeadsRoundRobin(leads.map((l) => l.id), assigneeIds);
        const leadById = new Map(leads.map((l) => [l.id, l]));

        // Group updates per assignee so this is N updateMany calls, not N leads.
        const byAssignee = new Map<string, string[]>();
        for (const p of plan) {
          const arr = byAssignee.get(p.assignedToId) ?? [];
          arr.push(p.leadId);
          byAssignee.set(p.assignedToId, arr);
        }
        for (const [assignedToId, leadIds] of byAssignee) {
          await tx.lead.updateMany({ where: { id: { in: leadIds } }, data: { assignedToId } });
        }

        // Keep the auto follow-up task on the new owner.
        for (const p of plan) {
          const lead = leadById.get(p.leadId)!;
          if (lead.assignedToId !== p.assignedToId) {
            await syncLeadFollowUpTask(tx, {
              leadId: lead.id,
              studentName: lead.studentName,
              branchId: lead.branchId,
              assignedToId: p.assignedToId,
              actorUserId: actorId,
              nextFollowUpAt: lead.nextFollowUpAt,
            });
          }
        }

        const changed = plan.filter((p) => leadById.get(p.leadId)!.assignedToId !== p.assignedToId);
        if (changed.length) {
          await tx.assignmentHistory.createMany({
            data: changed.map((p) => ({
              leadId: p.leadId,
              assignedById: actorId,
              assignedFromId: leadById.get(p.leadId)!.assignedToId,
              assignedToId: p.assignedToId,
              reason: reason ?? `Campaign: ${campaign.name}`,
            })),
          });
          await tx.auditLog.createMany({
            data: changed.map((p) => ({
              leadId: p.leadId,
              userId: actorId,
              action: "CAMPAIGN_ASSIGNED",
              oldValue: { assignedToId: leadById.get(p.leadId)!.assignedToId },
              newValue: { assignedToId: p.assignedToId, campaignId: id },
            })),
          });
        }

        // Replace the assignee set. Progress rows for removed users are
        // dropped so a re-added user starts clean.
        await tx.campaignAssignee.deleteMany({ where: { campaignId: id, userId: { notIn: assigneeIds } } });
        await tx.campaignProgress.deleteMany({ where: { campaignId: id, userId: { notIn: assigneeIds } } });
        for (const userId of assigneeIds) {
          await tx.campaignAssignee.upsert({
            where: { campaignId_userId: { campaignId: id, userId } },
            create: { campaignId: id, userId, assignedById: actorId },
            update: {},
          });
        }

        return { assigned: plan.length, changed: changed.length, perAssignee: Object.fromEntries([...byAssignee].map(([k, v]) => [k, v.length])) };
      });

      await invalidateAnalyticsCache(fastify.redis);
      await invalidateActivityCache(fastify.redis, request.user.branchId, actorId);

      return reply.status(200).send({ success: true, data: result });
    },
  );

  // ── PATCH /campaigns/:id — rename / archive ──
  fastify.patch(
    "/:id",
    { preHandler: [authenticate, authorize([Role.ADMIN, Role.SUB_ADMIN])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const v = validateBody(UpdateCampaignSchema, request.body);
      if (!v.success) return reply.status(400).send({ success: false, ...v.error });

      const { campaign, allowed } = await assertCampaignAccess(fastify, id, request.user);
      if (!campaign) {
        return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Campaign not found" } });
      }
      if (!allowed) {
        return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "Campaign belongs to another branch" } });
      }

      const data: { name?: string; isArchived?: boolean } = {};
      if (v.data.isArchived !== undefined) data.isArchived = v.data.isArchived;
      if (v.data.name !== undefined && v.data.name !== campaign.name) {
        const clash = await fastify.prisma.campaign.findFirst({
          where: { branchId: campaign.branchId, name: { equals: v.data.name, mode: "insensitive" }, id: { not: id } },
          select: { id: true },
        });
        if (clash) {
          return reply.status(409).send({
            success: false,
            error: { code: "DUPLICATE_NAME", message: `A campaign named "${v.data.name}" already exists` },
          });
        }
        data.name = v.data.name;
      }

      const updated = await fastify.prisma.campaign.update({ where: { id }, data });
      return reply.status(200).send({ success: true, data: updated });
    },
  );

  // ── GET /campaigns/:id/work?leadId=… — current lead + neighbours + position ──
  // Without leadId → resume where this user left off (per campaign).
  fastify.get("/:id/work", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { leadId } = request.query as { leadId?: string };
    const { campaign, allowed } = await assertCampaignAccess(fastify, id, request.user);
    if (!campaign) {
      return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Campaign not found" } });
    }
    if (!allowed) {
      return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "You are not assigned to this campaign" } });
    }

    const ids = await workLeadIds(fastify, id, request.user);
    if (ids.length === 0) {
      return reply.status(200).send({
        success: true,
        data: { campaign: { id: campaign.id, name: campaign.name }, lead: null, index: -1, total: 0, prevId: null, nextId: null },
      });
    }

    let currentId: string;
    if (leadId && ids.includes(leadId)) {
      currentId = leadId;
    } else {
      const progress = await fastify.prisma.campaignProgress.findUnique({
        where: { campaignId_userId: { campaignId: id, userId: request.user.id } },
      });
      currentId = resolveResumeIndex(ids, progress?.lastLeadId ?? null).leadId!;
    }

    const nb = neighbourIds(ids, currentId);
    const lead = await fastify.prisma.lead.findUnique({ where: { id: currentId }, select: leadSummarySelect });

    // Opening a lead IS progress — persist it so a refresh or a switch to
    // another campaign comes back here.
    await fastify.prisma.campaignProgress.upsert({
      where: { campaignId_userId: { campaignId: id, userId: request.user.id } },
      create: { campaignId: id, userId: request.user.id, lastLeadId: currentId },
      update: { lastLeadId: currentId },
    });

    return reply.status(200).send({
      success: true,
      data: {
        campaign: { id: campaign.id, name: campaign.name },
        lead,
        index: nb.index,
        total: nb.total,
        prevId: nb.prevId,
        nextId: nb.nextId,
      },
    });
  });

  // ── GET /campaigns/:id/queue — the left-hand leads panel of the workspace ──
  // tab=new    → leads nobody has worked yet (status NEW)
  // tab=active → everything else (touched at least once)
  // Both counts are always returned so the tabs can show them. Search and
  // status filter narrow the list; ordering matches the work order so Next
  // walks the panel top to bottom. Campaigns are ≤500 leads (import cap), so
  // the whole tab is returned — no paging to fight with a scroll list.
  fastify.get("/:id/queue", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as {
      tab?: string;
      search?: string;
      searchField?: string;   // all | name | phone | altPhone | email
      status?: string;        // legacy single
      statuses?: string;      // comma-separated, multi-select
      assigneeIds?: string;   // comma-separated user ids, may include "unassigned" (managers only)
      dateFrom?: string;      // YYYY-MM-DD (IST day)
      dateTo?: string;
    };
    const { campaign, allowed } = await assertCampaignAccess(fastify, id, request.user);
    if (!campaign) {
      return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Campaign not found" } });
    }
    if (!allowed) {
      return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: "You are not assigned to this campaign" } });
    }

    const scope = {
      campaignId: id,
      ...(request.user.role === Role.EMPLOYEE ? { assignedToId: request.user.id } : {}),
    };
    const tab = q.tab === "active" ? "active" : "new";
    const search = q.search?.trim();
    const and: Record<string, unknown>[] = [];

    // Tab decides the status universe; a multi-select narrows within it.
    if (tab === "new") {
      and.push({ status: "NEW" });
    } else {
      const picked = (q.statuses ?? q.status ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && s !== "NEW");
      and.push(picked.length > 0 ? { status: { in: picked } } : { status: { not: "NEW" } });
    }

    // Assignee multi-select — managers only; employees are already scoped to themselves.
    if (q.assigneeIds && request.user.role !== Role.EMPLOYEE) {
      const ids = q.assigneeIds.split(",").map((s) => s.trim()).filter(Boolean);
      const users = ids.filter((s) => s !== "unassigned");
      const or: Record<string, unknown>[] = [];
      if (users.length) or.push({ assignedToId: { in: users } });
      if (ids.includes("unassigned")) or.push({ assignedToId: null });
      if (or.length === 1) and.push(or[0]!);
      else if (or.length > 1) and.push({ OR: or });
    }

    // Created-date range, IST day boundaries (matches the leads list).
    if (q.dateFrom || q.dateTo) {
      and.push({
        createdAt: {
          ...(q.dateFrom ? { gte: new Date(`${q.dateFrom}T00:00:00.000+05:30`) } : {}),
          ...(q.dateTo ? { lte: new Date(`${q.dateTo}T23:59:59.999+05:30`) } : {}),
        },
      });
    }

    if (search) {
      const digits = search.replace(/\D/g, "");
      const phoneNeedle = digits.length >= 3 ? digits : search;
      const byField: Record<string, Record<string, unknown>[]> = {
        name: [{ studentName: { contains: search, mode: "insensitive" } }],
        phone: [{ phone: { contains: phoneNeedle } }],
        altPhone: [{ alternatePhone: { contains: phoneNeedle } }, { whatsappNumber: { contains: phoneNeedle } }],
        email: [{ email: { contains: search, mode: "insensitive" } }],
      };
      const field = q.searchField && q.searchField !== "all" ? q.searchField : null;
      and.push({
        OR: field && byField[field]
          ? byField[field]
          : [
              { studentName: { contains: search, mode: "insensitive" } },
              { phone: { contains: phoneNeedle } },
              { email: { contains: search, mode: "insensitive" } },
            ],
      });
    }

    const where = { ...scope, AND: and } as never;

    const [leads, newCount, activeCount] = await Promise.all([
      fastify.prisma.lead.findMany({
        where,
        select: {
          id: true,
          studentName: true,
          phone: true,
          status: true,
          city: true,
          nextFollowUpAt: true,
          createdAt: true,
          assignedTo: { select: { id: true, name: true } },
          courses: { select: { isPrimary: true, course: { select: { name: true } } }, take: 2 },
          interactions: {
            where: { isDeleted: false, type: "CALL" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { callOutcome: true, callDurationSecs: true, createdAt: true, user: { select: { name: true } } },
          },
        },
        orderBy: WORK_ORDER,
        take: 500,
      }),
      fastify.prisma.lead.count({ where: { ...scope, status: "NEW" } }),
      fastify.prisma.lead.count({ where: { ...scope, status: { not: "NEW" } } }),
    ]);

    return reply.status(200).send({
      success: true,
      data: {
        campaign: { id: campaign.id, name: campaign.name },
        tab,
        counts: { new: newCount, active: activeCount },
        leads: leads.map((l) => ({
          id: l.id,
          studentName: l.studentName,
          phone: l.phone,
          status: l.status,
          city: l.city,
          nextFollowUpAt: l.nextFollowUpAt,
          createdAt: l.createdAt,
          assignedTo: l.assignedTo,
          course: l.courses.find((c) => c.isPrimary)?.course.name ?? l.courses[0]?.course.name ?? null,
          lastCall: l.interactions[0]
            ? {
                outcome: l.interactions[0].callOutcome,
                durationSecs: l.interactions[0].callDurationSecs,
                at: l.interactions[0].createdAt,
                by: l.interactions[0].user.name,
              }
            : null,
        })),
      },
    });
  });

  // ── PUT /campaigns/:id/progress — explicit cursor save (Next/Prev clicks) ──
  fastify.put("/:id/progress", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const v = validateBody(CampaignProgressSchema, request.body);
    if (!v.success) return reply.status(400).send({ success: false, ...v.error });

    const { campaign, allowed } = await assertCampaignAccess(fastify, id, request.user);
    if (!campaign || !allowed) {
      return reply.status(campaign ? 403 : 404).send({
        success: false,
        error: { code: campaign ? "FORBIDDEN" : "NOT_FOUND", message: campaign ? "Not assigned to this campaign" : "Campaign not found" },
      });
    }

    const row = await fastify.prisma.campaignProgress.upsert({
      where: { campaignId_userId: { campaignId: id, userId: request.user.id } },
      create: { campaignId: id, userId: request.user.id, lastLeadId: v.data.lastLeadId },
      update: { lastLeadId: v.data.lastLeadId },
    });
    return reply.status(200).send({ success: true, data: { lastLeadId: row.lastLeadId } });
  });

  // ── GET /campaigns/names?branchId= — for the import page's "will be named …" preview ──
  fastify.get(
    "/names",
    { preHandler: [authenticate, authorize([Role.ADMIN, Role.SUB_ADMIN])] },
    async (request, reply) => {
      const branchId = request.user.role === Role.SUB_ADMIN
        ? request.user.branchId
        : ((request.query as { branchId?: string }).branchId ?? request.user.branchId);
      const rows = await fastify.prisma.campaign.findMany({
        where: { branchId },
        select: { name: true },
      });
      const { base } = request.query as { base?: string };
      const names = rows.map((r) => r.name);
      return reply.status(200).send({
        success: true,
        data: { names, ...(base ? { resolved: nextVersionedName(base, names) } : {}) },
      });
    },
  );
}
