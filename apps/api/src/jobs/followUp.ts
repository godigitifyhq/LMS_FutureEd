import type { FastifyInstance } from "fastify";
import { detectOverdueFollowUps, buildFollowUpNotification } from "@lms/core";
import { QUEUES } from "../plugins/bullmq";
import { invalidateAnalyticsCache } from "../services/cache";
import { AUTO_FOLLOW_UP_TASK_TITLE } from "../services/followUpTasks";

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

async function buildBranchFallbackAssigneeMap(
  fastify: FastifyInstance,
  branchIds: string[],
): Promise<Map<string, string>> {
  const assignees = new Map<string, string>();
  if (branchIds.length === 0) return assignees;

  const managers = await fastify.prisma.user.findMany({
    where: {
      branchId: { in: branchIds },
      role: { in: ["ADMIN", "SUB_ADMIN"] },
      isActive: true,
    },
    select: { id: true, branchId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  for (const user of managers) {
    if (!assignees.has(user.branchId)) assignees.set(user.branchId, user.id);
  }

  const missingBranchIds = branchIds.filter((branchId) => !assignees.has(branchId));
  if (missingBranchIds.length === 0) return assignees;

  const fallbackUsers = await fastify.prisma.user.findMany({
    where: {
      branchId: { in: missingBranchIds },
      isActive: true,
    },
    select: { id: true, branchId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  for (const user of fallbackUsers) {
    if (!assignees.has(user.branchId)) assignees.set(user.branchId, user.id);
  }

  return assignees;
}

export function startFollowUpCron(fastify: FastifyInstance): void {
  fastify.log.info("Follow-up cron started — runs every 30 minutes");

  const run = async (): Promise<void> => {
    try {
      // Fetch leads with upcoming/overdue follow-ups
      const leads = await fastify.prisma.lead.findMany({
        where: {
          nextFollowUpAt: { lte: new Date() },
          status: {
            notIn: ["CONFIRMED", "DUPLICATE", "LOST"],
          },
        },
        select: {
          id: true,
          branchId: true,
          studentName: true,
          nextFollowUpAt: true,
          assignedToId: true,
          assignedTo: { select: { email: true } },
        },
      });

      const overdue = detectOverdueFollowUps(
        leads.map((l) => ({
          id: l.id,
          studentName: l.studentName,
          nextFollowUpAt: l.nextFollowUpAt,
          assignedToId: l.assignedToId,
          assignedToEmail: l.assignedTo?.email ?? null,
        })),
      );

      const overdueLeadIds = overdue.map((item) => item.leadId);
      const branchIds = [...new Set(leads.map((lead) => lead.branchId))];
      const [existingAutoTasks, fallbackAssignees] = await Promise.all([
        overdueLeadIds.length > 0
          ? fastify.prisma.task.findMany({
              where: {
                leadId: { in: overdueLeadIds },
                title: AUTO_FOLLOW_UP_TASK_TITLE,
                status: { in: ["PENDING", "IN_PROGRESS"] },
              },
              select: { leadId: true },
            })
          : Promise.resolve([]),
        buildBranchFallbackAssigneeMap(fastify, branchIds),
      ]);

      const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
      const leadsWithOpenTask = new Set(
        existingAutoTasks
          .map((task) => task.leadId)
          .filter((leadId): leadId is string => leadId !== null),
      );

      const taskCreates = overdue.flatMap((item) => {
        if (leadsWithOpenTask.has(item.leadId)) return [];

        const lead = leadsById.get(item.leadId);
        if (!lead || !lead.nextFollowUpAt) return [];

        const fallbackUserId = fallbackAssignees.get(lead.branchId);
        const assignedToId = lead.assignedToId ?? fallbackUserId;
        const createdById = fallbackUserId ?? lead.assignedToId ?? null;

        if (!assignedToId || !createdById) return [];

        return [{
          title: AUTO_FOLLOW_UP_TASK_TITLE,
          description: `Follow up with ${lead.studentName}. This scheduled follow-up is overdue.`,
          assignedToId,
          createdById,
          leadId: lead.id,
          branchId: lead.branchId,
          dueAt: lead.nextFollowUpAt,
        }];
      });

      if (taskCreates.length > 0) {
        await fastify.prisma.task.createMany({ data: taskCreates });
        await invalidateAnalyticsCache(fastify.redis);
      }

      for (const item of overdue) {
        const notification = buildFollowUpNotification(item);
        await fastify.queues[QUEUES.NOTIFICATIONS].add(
          "overdue-followup",
          { ...notification, leadId: item.leadId },
          {
            // jobId deduplicates: same lead won't be re-queued if a job is already pending/active
            jobId: `overdue-${item.leadId}`,
            attempts: 1,
          },
        );
      }

      fastify.log.info(
        `Follow-up cron: ${overdue.length} overdue leads queued, ${taskCreates.length} tasks created`,
      );
    } catch (error) {
      fastify.log.error({ error }, "Follow-up cron failed");
    }
  };

  // Run immediately then every 30 minutes
  void run();
  setInterval(() => void run(), INTERVAL_MS);
}
