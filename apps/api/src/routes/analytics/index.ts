import type { FastifyInstance } from "fastify";
import { Prisma } from "@lms/db";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { Role } from "@lms/types";
import {
  getDashboardOverview,
  getEmployeePerformance,
  getPipelineAnalysis,
  getSourceReport,
  getFollowUpCompliance,
  getConfirmedReport,
} from "./service";
import {
  getLeaderboard,
  getEmployeeDetailReport,
  getCallReport,
  getTaskReport,
  getDuplicateReport,
  getConversionReport,
  computeEmployeeStats,
} from "./reporting";
import {
  generateCSV,
  generatePerformancePDF,
  generateConfirmedPDF,
} from "./export";
import { getCached, buildCacheKey } from "./helpers";
import type { Period } from "./helpers";

const CACHE_TTL = 15 * 60; // 15 minutes for most reports
const COMPLIANCE_TTL = 5 * 60; // 5 minutes for follow-up (more real-time)

export async function analyticsRoutes(fastify: FastifyInstance): Promise<void> {
  // Auth guard — all analytics require sub-admin or admin
  const guard = [authenticate, authorize([Role.ADMIN, Role.SUB_ADMIN])];

  // SUB_ADMIN is locked to their own branch; ADMIN may query any branch via q.branchId
  function effectiveBranchId(
    role: string,
    userBranchId: string,
    queryBranchId?: string,
  ): string | undefined {
    if (role === Role.SUB_ADMIN) return userBranchId;
    return queryBranchId;
  }

  // ── GET /analytics/dashboard ──
  fastify.get("/dashboard", { preHandler: guard }, async (request, reply) => {
    const q = request.query as {
      period?: Period;
      dateFrom?: string;
      dateTo?: string;
      branchId?: string;
    };
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    const cacheKey = buildCacheKey("dashboard", {
      period: q.period,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      branchId,
    });

    const data = await getCached(fastify.redis, cacheKey, CACHE_TTL, () =>
      getDashboardOverview({
        prisma: fastify.prisma,
        period: q.period ?? "last30",
        ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
        ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
        ...(branchId !== undefined ? { branchId } : {}),
      }),
    );

    return reply.status(200).send({ success: true, data });
  });

  // ── GET /analytics/employees ──
  fastify.get("/employees", { preHandler: guard }, async (request, reply) => {
    const q = request.query as {
      period?: Period;
      dateFrom?: string;
      dateTo?: string;
      branchId?: string;
    };
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    const cacheKey = buildCacheKey("employees", {
      period: q.period,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      branchId,
    });

    const data = await getCached(fastify.redis, cacheKey, CACHE_TTL, () =>
      getEmployeePerformance({
        prisma: fastify.prisma,
        period: q.period ?? "last30",
        ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
        ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
        ...(branchId !== undefined ? { branchId } : {}),
      }),
    );

    return reply.status(200).send({ success: true, data });
  });

  // ── GET /analytics/pipeline ──
  fastify.get("/pipeline", { preHandler: guard }, async (request, reply) => {
    const q = request.query as { branchId?: string };
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    const cacheKey = buildCacheKey("pipeline", { branchId });

    const data = await getCached(fastify.redis, cacheKey, CACHE_TTL, () =>
      getPipelineAnalysis({
        prisma: fastify.prisma,
        ...(branchId !== undefined ? { branchId } : {}),
      }),
    );

    return reply.status(200).send({ success: true, data });
  });

  // ── GET /analytics/sources ──
  fastify.get("/sources", { preHandler: guard }, async (request, reply) => {
    const q = request.query as {
      period?: Period;
      dateFrom?: string;
      dateTo?: string;
      branchId?: string;
    };
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    const cacheKey = buildCacheKey("sources", {
      period: q.period,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      branchId,
    });

    const data = await getCached(fastify.redis, cacheKey, CACHE_TTL, () =>
      getSourceReport({
        prisma: fastify.prisma,
        period: q.period ?? "last30",
        ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
        ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
        ...(branchId !== undefined ? { branchId } : {}),
      }),
    );

    return reply.status(200).send({ success: true, data });
  });

  // ── GET /analytics/follow-ups ──
  fastify.get("/follow-ups", { preHandler: guard }, async (request, reply) => {
    const q = request.query as { branchId?: string };
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    const cacheKey = buildCacheKey("followups", { branchId });

    const data = await getCached(
      fastify.redis,
      cacheKey,
      COMPLIANCE_TTL, // shorter TTL — more real-time
      () =>
        getFollowUpCompliance({
          prisma: fastify.prisma,
          ...(branchId !== undefined ? { branchId } : {}),
        }),
    );

    return reply.status(200).send({ success: true, data });
  });

  // ── GET /analytics/confirmed ──
  fastify.get("/confirmed", { preHandler: guard }, async (request, reply) => {
    const q = request.query as {
      period?: Period;
      dateFrom?: string;
      dateTo?: string;
      branchId?: string;
    };
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    const cacheKey = buildCacheKey("confirmed", {
      period: q.period,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      branchId,
    });

    const data = await getCached(fastify.redis, cacheKey, CACHE_TTL, () =>
      getConfirmedReport({
        prisma: fastify.prisma,
        period: q.period ?? "last30",
        ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
        ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
        ...(branchId !== undefined ? { branchId } : {}),
      }),
    );

    return reply.status(200).send({ success: true, data });
  });

  // ── GET /analytics/export/csv/:type ──
  fastify.get(
    "/export/csv/:type",
    { preHandler: guard },
    async (request, reply) => {
      const { type } = request.params as { type: string };
      const q = request.query as {
        period?: Period;
        dateFrom?: string;
        dateTo?: string;
        branchId?: string;
      };

      let csv = "";
      let filename = "";

      if (type === "employees") {
        const data = await getEmployeePerformance({
          prisma: fastify.prisma,
          period: q.period ?? "last30",
          ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
          ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
          ...(q.branchId !== undefined ? { branchId: q.branchId } : {}),
        });

        const rows = data.employees.map((e) => ({
          Name: e.employee.name,
          Email: e.employee.email,
          "Total Assigned": e.metrics.totalAssigned,
          Confirmed: e.metrics.confirmed,
          "Confirmation Rate %": e.metrics.confirmationRate,
          "Avg Response Hours": e.metrics.avgResponseHours ?? "N/A",
          "Overdue Follow-ups": e.metrics.overdueFollowUps,
          "Compliance Rate %": e.metrics.followUpComplianceRate,
          "Performance Score": e.metrics.performanceScore,
        }));

        csv = generateCSV(Object.keys(rows[0] ?? {}), rows);
        filename = "employee-performance.csv";
      } else if (type === "confirmed") {
        const data = await getConfirmedReport({
          prisma: fastify.prisma,
          period: q.period ?? "last30",
          ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
          ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
          ...(q.branchId !== undefined ? { branchId: q.branchId } : {}),
        });

        const rows = data.leads.map((l) => ({
          "Student Name": l.studentName,
          Phone: l.phone,
          Course: l.primaryCourse ?? "",
          Counsellor: l.assignedTo?.name ?? "",
          "Confirmed At": l.confirmedAt?.toDateString() ?? "",
          "Booking Amount": l.bookingAmount,
          "Admission Amount": l.admissionAmount,
          "Dues Amount": l.duesAmount,
        }));

        csv = generateCSV(Object.keys(rows[0] ?? {}), rows);
        filename = "confirmed-applications.csv";
      } else {
        return reply.status(400).send({
          success: false,
          error: { code: "INVALID_INPUT", message: "Invalid export type" },
        });
      }

      void reply
        .header("Content-Type", "text/csv")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(csv);
    },
  );

  // GET /analytics/trend
  fastify.get("/trend", { preHandler: guard }, async (request, reply) => {
    const q = request.query as {
      period?: string;
      branchId?: string;
    };

    const days = q.period === "last90" ? 90 : q.period === "last30" ? 30 : 7;
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    type TrendRow = { day: Date; cnt: bigint };

    const branchClause = branchId
      ? Prisma.sql`AND "branchId" = ${branchId}`
      : Prisma.empty;

    const [created, confirmed] = await Promise.all([
      fastify.prisma.$queryRaw<TrendRow[]>(Prisma.sql`
        SELECT DATE("createdAt" AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS cnt
        FROM "Lead"
        WHERE "createdAt" >= ${from}
        ${branchClause}
        GROUP BY day
        ORDER BY day
      `),
      fastify.prisma.$queryRaw<TrendRow[]>(Prisma.sql`
        SELECT DATE("confirmedAt" AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS cnt
        FROM "Lead"
        WHERE status = 'CONFIRMED'
          AND "confirmedAt" >= ${from}
        ${branchClause}
        GROUP BY day
        ORDER BY day
      `),
    ]);

    // Build date scaffold
    const dateMap: Record<string, { created: number; confirmed: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0]!;
      dateMap[key] = { created: 0, confirmed: 0 };
    }

    for (const row of created) {
      const key = new Date(row.day).toISOString().split("T")[0]!;
      if (dateMap[key]) dateMap[key]!.created += Number(row.cnt);
    }
    for (const row of confirmed) {
      const key = new Date(row.day).toISOString().split("T")[0]!;
      if (dateMap[key]) dateMap[key]!.confirmed += Number(row.cnt);
    }

    const trend = Object.entries(dateMap).map(([date, counts]) => ({
      date,
      ...counts,
    }));

    return reply.status(200).send({ success: true, data: { trend } });
  });

  // ── GET /analytics/export/pdf/:type ──
  fastify.get(
    "/export/pdf/:type",
    { preHandler: guard },
    async (request, reply) => {
      const { type } = request.params as { type: string };
      const q = request.query as {
        period?: Period;
        dateFrom?: string;
        dateTo?: string;
        branchId?: string;
      };

      void reply.header("Content-Type", "application/pdf");

      if (type === "employees") {
        const data = await getEmployeePerformance({
          prisma: fastify.prisma,
          period: q.period ?? "last30",
          ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
          ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
          ...(q.branchId !== undefined ? { branchId: q.branchId } : {}),
        });

        void reply.header(
          "Content-Disposition",
          'attachment; filename="employee-performance.pdf"',
        );
        generatePerformancePDF(data, reply.raw);
      } else if (type === "confirmed") {
        const data = await getConfirmedReport({
          prisma: fastify.prisma,
          period: q.period ?? "last30",
          ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
          ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
          ...(q.branchId !== undefined ? { branchId: q.branchId } : {}),
        });

        void reply.header(
          "Content-Disposition",
          'attachment; filename="confirmed-applications.pdf"',
        );
        generateConfirmedPDF(data, reply.raw);
      } else {
        return reply.status(400).send({
          success: false,
          error: { code: "INVALID_INPUT", message: "Invalid export type" },
        });
      }
    },
  );

  // ══════════════════════════════════════════════════════════════
  // NEW REPORTING ROUTES
  // ══════════════════════════════════════════════════════════════

  const LEADERBOARD_TTL = 5 * 60;  // 5 min — near-real-time
  const REPORT_TTL      = 15 * 60; // 15 min — historical

  // ── GET /analytics/leaderboard ──
  fastify.get("/leaderboard", { preHandler: guard }, async (request, reply) => {
    const q = request.query as {
      period?: Period;
      dateFrom?: string;
      dateTo?: string;
      branchId?: string;
    };
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    const cacheKey = buildCacheKey("leaderboard", {
      period: q.period, dateFrom: q.dateFrom, dateTo: q.dateTo, branchId,
    });

    const data = await getCached(fastify.redis, cacheKey, LEADERBOARD_TTL, () =>
      getLeaderboard({
        prisma: fastify.prisma,
        period: q.period ?? "last30",
        ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
        ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
        ...(branchId !== undefined ? { branchId } : {}),
      }),
    );

    return reply.status(200).send({ success: true, data });
  });

  // ── GET /analytics/employee/:id ──
  fastify.get("/employee/:id", { preHandler: guard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as {
      period?: Period;
      dateFrom?: string;
      dateTo?: string;
      branchId?: string;
    };
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    const cacheKey = buildCacheKey("employee-detail", {
      id, period: q.period, dateFrom: q.dateFrom, dateTo: q.dateTo, branchId,
    });

    const data = await getCached(fastify.redis, cacheKey, LEADERBOARD_TTL, () =>
      getEmployeeDetailReport({
        prisma: fastify.prisma,
        period: q.period ?? "last30",
        ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
        ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
        ...(branchId !== undefined ? { branchId } : {}),
        employeeId: id,
      }),
    );

    if (!data) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Employee not found" },
      });
    }

    return reply.status(200).send({ success: true, data });
  });

  // ── GET /analytics/calls ──
  fastify.get("/calls", { preHandler: guard }, async (request, reply) => {
    const q = request.query as {
      period?: Period;
      dateFrom?: string;
      dateTo?: string;
      branchId?: string;
      employeeId?: string;
      outcome?: string;
    };
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    const cacheKey = buildCacheKey("calls", {
      period: q.period, dateFrom: q.dateFrom, dateTo: q.dateTo, branchId,
      employeeId: q.employeeId, outcome: q.outcome,
    });

    const data = await getCached(fastify.redis, cacheKey, LEADERBOARD_TTL, () =>
      getCallReport({
        prisma: fastify.prisma,
        period: q.period ?? "last30",
        ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
        ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
        ...(branchId !== undefined ? { branchId } : {}),
        ...(q.employeeId !== undefined ? { employeeId: q.employeeId } : {}),
        ...(q.outcome !== undefined ? { outcome: q.outcome } : {}),
      }),
    );

    return reply.status(200).send({ success: true, data });
  });

  // ── GET /analytics/tasks ──
  fastify.get("/tasks", { preHandler: guard }, async (request, reply) => {
    const q = request.query as {
      period?: Period;
      dateFrom?: string;
      dateTo?: string;
      branchId?: string;
      employeeId?: string;
      status?: string;
      overdue?: string;
      title?: string;
    };
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    const cacheKey = buildCacheKey("tasks", {
      period: q.period, dateFrom: q.dateFrom, dateTo: q.dateTo, branchId,
      employeeId: q.employeeId, status: q.status, overdue: q.overdue, title: q.title,
    });

    const data = await getCached(fastify.redis, cacheKey, REPORT_TTL, () =>
      getTaskReport({
        prisma: fastify.prisma,
        period: q.period ?? "last30",
        ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
        ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
        ...(branchId !== undefined ? { branchId } : {}),
        ...(q.employeeId !== undefined ? { employeeId: q.employeeId } : {}),
        ...(q.status !== undefined ? { status: q.status } : {}),
        ...(q.overdue === "true" ? { overdue: true } : {}),
        ...(q.title !== undefined ? { title: q.title } : {}),
      }),
    );

    return reply.status(200).send({ success: true, data });
  });

  // ── GET /analytics/duplicates ──
  fastify.get("/duplicates", { preHandler: guard }, async (request, reply) => {
    const q = request.query as { branchId?: string };
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    const cacheKey = buildCacheKey("duplicates", { branchId });

    const data = await getCached(fastify.redis, cacheKey, REPORT_TTL, () =>
      getDuplicateReport({
        prisma: fastify.prisma,
        ...(branchId !== undefined ? { branchId } : {}),
      }),
    );

    return reply.status(200).send({ success: true, data });
  });

  // ── GET /analytics/conversions ──
  fastify.get("/conversions", { preHandler: guard }, async (request, reply) => {
    const q = request.query as {
      period?: Period;
      dateFrom?: string;
      dateTo?: string;
      branchId?: string;
    };
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    const cacheKey = buildCacheKey("conversions", {
      period: q.period, dateFrom: q.dateFrom, dateTo: q.dateTo, branchId,
    });

    const data = await getCached(fastify.redis, cacheKey, REPORT_TTL, () =>
      getConversionReport({
        prisma: fastify.prisma,
        period: q.period ?? "last30",
        ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
        ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
        ...(branchId !== undefined ? { branchId } : {}),
      }),
    );

    return reply.status(200).send({ success: true, data });
  });

  // ── POST /analytics/duplicate/:id/mark ── (soft-link merge — Q7b)
  fastify.post(
    "/duplicate/:id/mark",
    { preHandler: guard },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { originalId } = request.body as { originalId?: string };

      const lead = await fastify.prisma.lead.findFirst({
        where: {
          id,
          ...(request.user.role === Role.SUB_ADMIN
            ? { branchId: request.user.branchId }
            : {}),
        },
      });

      if (!lead) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Lead not found" },
        });
      }

      await fastify.prisma.lead.update({
        where: { id },
        data: {
          isDuplicate: true,
          status: "DUPLICATE",
          ...(originalId ? { duplicateOfId: originalId } : {}),
        },
      });

      // Invalidate duplicate report cache
      await fastify.redis.del(buildCacheKey("duplicates", {
        branchId: lead.branchId,
      }));

      return reply.status(200).send({ success: true });
    },
  );

  // ══════════════════════════════════════════════════════════════
  // NEW CSV EXPORTS — extends existing /export/csv/:type pattern
  // ══════════════════════════════════════════════════════════════

  // These are new type cases injected by extending the existing export route.
  // They live here so the existing route can be kept as-is (we append below).

  fastify.get("/export/csv/leaderboard", { preHandler: guard }, async (request, reply) => {
    const q = request.query as { period?: Period; dateFrom?: string; dateTo?: string; branchId?: string };
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    const data = await computeEmployeeStats({
      prisma: fastify.prisma,
      period: q.period ?? "last30",
      ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
      ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
      ...(branchId !== undefined ? { branchId } : {}),
    });

    const rows = data.map((s, i) => ({
      Rank: i + 1,
      Name: s.employeeName,
      Email: s.employeeEmail,
      Designation: s.designation ?? "",
      Team: s.team ?? "",
      "Last Call": s.lastCallAt
        ? new Date(s.lastCallAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
        : "",
      "Last Pickup": s.lastConnectedCallAt
        ? new Date(s.lastConnectedCallAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
        : "",
      "Total Leads": s.totalLeads,
      Confirmed: s.confirmedLeads,
      Lost: s.lostLeads,
      "Conversion %": s.confirmationRate,
      "Total Calls": s.totalCalls,
      "Connected Calls": s.connectedCalls,
      "Call Minutes": s.totalCallMinutes,
      "Leads Interacted": s.leadsInteracted,
      "Revenue (₹)": s.totalRevenue,
      "Overdue Follow-ups": s.overdueFollowUps,
      "Compliance %": s.followUpComplianceRate,
    }));

    const csv = generateCSV(Object.keys(rows[0] ?? {}), rows);
    void reply
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", 'attachment; filename="leaderboard.csv"')
      .send(csv);
  });

  fastify.get("/export/csv/calls", { preHandler: guard }, async (request, reply) => {
    const q = request.query as { period?: Period; dateFrom?: string; dateTo?: string; branchId?: string; employeeId?: string; outcome?: string };
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    const data = await getCallReport({
      prisma: fastify.prisma,
      period: q.period ?? "last30",
      ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
      ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
      ...(branchId !== undefined ? { branchId } : {}),
      ...(q.employeeId !== undefined ? { employeeId: q.employeeId } : {}),
      ...(q.outcome !== undefined ? { outcome: q.outcome } : {}),
    });

    const rows = data.rows.map((r) => ({
      Employee: r.employeeName,
      "Lead Name": r.leadName,
      "Lead Phone": r.leadPhone,
      Outcome: r.outcome ?? "—",
      Direction: r.direction ?? "—",
      "Duration": r.durationLabel,
      "Duration (secs)": r.durationSecs ?? 0,
      "Recording URL": r.recordingUrl ?? "",
      "Date & Time": new Date(r.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    }));

    const csv = generateCSV(Object.keys(rows[0] ?? {}), rows);
    void reply
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", 'attachment; filename="call-report.csv"')
      .send(csv);
  });

  fastify.get("/export/csv/tasks", { preHandler: guard }, async (request, reply) => {
    const q = request.query as { period?: Period; dateFrom?: string; dateTo?: string; branchId?: string; employeeId?: string; status?: string; overdue?: string; title?: string };
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    const data = await getTaskReport({
      prisma: fastify.prisma,
      period: q.period ?? "last30",
      ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
      ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
      ...(branchId !== undefined ? { branchId } : {}),
      ...(q.employeeId !== undefined ? { employeeId: q.employeeId } : {}),
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.overdue === "true" ? { overdue: true } : {}),
      ...(q.title !== undefined ? { title: q.title } : {}),
    });

    const rows = data.rows.map((r) => ({
      Title: r.title,
      Assignee: r.assigneeName,
      Status: r.status,
      "Lead": r.leadName ?? "",
      "Due At": r.dueAt ? new Date(r.dueAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
      "Completed At": r.completedAt ? new Date(r.completedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
      Overdue: r.isOverdue ? "Yes" : "No",
    }));

    const csv = generateCSV(Object.keys(rows[0] ?? {}), rows);
    void reply
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", 'attachment; filename="task-report.csv"')
      .send(csv);
  });

  fastify.get("/export/csv/duplicates", { preHandler: guard }, async (request, reply) => {
    const q = request.query as { branchId?: string };
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    const data = await getDuplicateReport({
      prisma: fastify.prisma,
      ...(branchId !== undefined ? { branchId } : {}),
    });

    const rows = data.rows.map((r) => ({
      "Duplicate Lead": r.duplicateName,
      "Duplicate Phone": r.duplicatePhone,
      Status: r.duplicateStatus,
      "Original Lead": r.originalName ?? "",
      "Original Phone": r.originalPhone ?? "",
      "Assigned To": r.assigneeName ?? "",
      "Created At": new Date(r.duplicateCreatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    }));

    const csv = generateCSV(Object.keys(rows[0] ?? {}), rows);
    void reply
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", 'attachment; filename="duplicate-leads.csv"')
      .send(csv);
  });

  fastify.get("/export/csv/conversions", { preHandler: guard }, async (request, reply) => {
    const q = request.query as { period?: Period; dateFrom?: string; dateTo?: string; branchId?: string };
    const branchId = effectiveBranchId(request.user.role, request.user.branchId, q.branchId);

    const data = await getConversionReport({
      prisma: fastify.prisma,
      period: q.period ?? "last30",
      ...(q.dateFrom !== undefined ? { dateFrom: q.dateFrom } : {}),
      ...(q.dateTo !== undefined ? { dateTo: q.dateTo } : {}),
      ...(branchId !== undefined ? { branchId } : {}),
    });

    const rows = data.rows.map((r) => ({
      Employee: r.employeeName,
      "Total Leads": r.totalLeads,
      Confirmed: r.confirmedLeads,
      "Conversion %": r.conversionRate,
      "Revenue (₹)": r.revenue,
      "Avg Revenue (₹)": r.avgRevenue,
    }));

    const csv = generateCSV(Object.keys(rows[0] ?? {}), rows);
    void reply
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", 'attachment; filename="conversion-report.csv"')
      .send(csv);
  });
}
