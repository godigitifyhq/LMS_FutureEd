import type { FastifyInstance } from "fastify";
import { QUEUES } from "../plugins/bullmq";

// Default: 6:30 PM IST = 13:00 UTC
const DEFAULT_HOUR_UTC   = parseInt(process.env["DAILY_REPORT_HOUR_UTC"]   ?? "13", 10);
const DEFAULT_MINUTE_UTC = parseInt(process.env["DAILY_REPORT_MINUTE_UTC"] ?? "0",  10);

export function startDailyReportCron(fastify: FastifyInstance): void {
  const run = async (): Promise<void> => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd   = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      const [employees, admins] = await Promise.all([
        fastify.prisma.user.findMany({
          where: { role: "EMPLOYEE", isActive: true },
          select: { id: true, name: true, email: true },
        }),
        fastify.prisma.user.findMany({
          where: { role: { in: ["ADMIN", "SUB_ADMIN"] }, isActive: true },
          select: { id: true, name: true, email: true },
        }),
      ]);

      if (employees.length === 0) return;

      const employeeIds = employees.map((e) => e.id);

      const [todayInteractions, todayConfirmed, todayNewLeads, overdueLeads] =
        await Promise.all([
          fastify.prisma.interactionLog.findMany({
            where: {
              userId: { in: employeeIds },
              isDeleted: false,
              type: { not: "STATUS_CHANGED" },
              createdAt: { gte: todayStart, lt: todayEnd },
            },
            select: { userId: true, leadId: true, type: true, callDurationSecs: true },
          }),
          fastify.prisma.lead.findMany({
            where: {
              assignedToId: { in: employeeIds },
              status: "CONFIRMED",
              confirmedAt: { gte: todayStart, lt: todayEnd },
            },
            select: { assignedToId: true },
          }),
          fastify.prisma.lead.findMany({
            where: {
              assignedToId: { in: employeeIds },
              createdAt: { gte: todayStart, lt: todayEnd },
            },
            select: { assignedToId: true },
          }),
          fastify.prisma.lead.findMany({
            where: {
              assignedToId: { in: employeeIds },
              nextFollowUpAt: { lte: now },
              status: { notIn: ["CONFIRMED", "DUPLICATE", "LOST"] },
            },
            select: { assignedToId: true },
          }),
        ]);

      const dateLabel = todayStart.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      // Build per-employee stats
      const employeeStats = employees.map((emp) => {
        const empInteractions = todayInteractions.filter((i) => i.userId === emp.id);
        const empCalls        = empInteractions.filter((i) => i.type === "CALL");
        return {
          name:              emp.name,
          email:             emp.email,
          callCount:         empCalls.length,
          callMinutes:       Math.round(empCalls.reduce((s, i) => s + (i.callDurationSecs ?? 0), 0) / 60),
          leadsInteracted:   new Set(empInteractions.map((i) => i.leadId)).size,
          confirmedToday:    todayConfirmed.filter((l) => l.assignedToId === emp.id).length,
          newLeadsToday:     todayNewLeads.filter((l) => l.assignedToId === emp.id).length,
          overdueFollowUps:  overdueLeads.filter((l) => l.assignedToId === emp.id).length,
        };
      });

      // Queue individual reports for each employee
      for (const stat of employeeStats) {
        await fastify.queues[QUEUES.NOTIFICATIONS].add(
          "daily-employee-report",
          { ...stat, date: dateLabel },
          { jobId: `daily-emp-${stat.email}-${todayStart.toISOString().slice(0, 10)}`, attempts: 2 },
        );
      }

      // Queue combined report for each admin
      for (const admin of admins) {
        await fastify.queues[QUEUES.NOTIFICATIONS].add(
          "admin-daily-report",
          { to: admin.email, adminName: admin.name, date: dateLabel, employees: employeeStats },
          { jobId: `daily-admin-${admin.email}-${todayStart.toISOString().slice(0, 10)}`, attempts: 2 },
        );
      }

      fastify.log.info(`Daily report cron: queued ${employeeStats.length} employee + ${admins.length} admin reports`);
    } catch (error) {
      fastify.log.error({ error }, "Daily report cron failed");
    }
  };

  // Schedule for the next configured UTC time, then every 24 hours
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DEFAULT_HOUR_UTC, DEFAULT_MINUTE_UTC, 0),
  );
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const msUntilNext = next.getTime() - now.getTime();

  fastify.log.info(
    `Daily report cron scheduled — first run in ${Math.round(msUntilNext / 60000)}m (${next.toISOString()})`,
  );

  setTimeout(() => {
    void run();
    setInterval(() => void run(), 24 * 60 * 60 * 1000);
  }, msUntilNext);
}
