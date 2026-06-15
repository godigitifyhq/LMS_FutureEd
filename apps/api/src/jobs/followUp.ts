import type { FastifyInstance } from "fastify";
import { detectOverdueFollowUps, buildFollowUpNotification } from "@lms/core";
import { QUEUES } from "../plugins/bullmq";

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

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
        `Follow-up cron: ${overdue.length} overdue leads queued`,
      );
    } catch (error) {
      fastify.log.error({ error }, "Follow-up cron failed");
    }
  };

  // Run immediately then every 30 minutes
  void run();
  setInterval(() => void run(), INTERVAL_MS);
}
