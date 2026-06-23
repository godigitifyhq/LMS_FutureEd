import type { PrismaClient } from "@lms/db";
import type { Period } from "./helpers";
import { getDateRange } from "./helpers";

// ═══════════════════════════════════════
// DASHBOARD OVERVIEW
// All queries run in parallel — never sequential
// ═══════════════════════════════════════

export async function getDashboardOverview(params: {
  prisma: PrismaClient;
  period: Period;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}) {
  const { prisma, branchId } = params;
  const { from, to } = getDateRange(
    params.period,
    params.dateFrom,
    params.dateTo,
  );

  const branchFilter = branchId ? { branchId } : {};
  const dateFilter = { createdAt: { gte: from, lte: to } };

  const [
    totalLeadsInPeriod,
    confirmedInPeriod,
    lostInPeriod,
    unassignedCount,
    overdueCount,
    newToday,
    totalActiveLeads,
    interestedCount,
    statusBreakdown,
  ] = await Promise.all([
    // Total leads created in period
    prisma.lead.count({
      where: { ...branchFilter, ...dateFilter },
    }),

    // Confirmed in period
    prisma.lead.count({
      where: {
        ...branchFilter,
        status: "CONFIRMED",
        confirmedAt: { gte: from, lte: to },
      },
    }),

    // Lost in period
    prisma.lead.count({
      where: {
        ...branchFilter,
        status: "LOST",
        updatedAt: { gte: from, lte: to },
      },
    }),

    // Currently unassigned (not terminal status)
    prisma.lead.count({
      where: {
        ...branchFilter,
        assignedToId: null,
        status: { notIn: ["CONFIRMED", "DUPLICATE", "LOST"] },
      },
    }),

    // Overdue follow-ups right now
    prisma.lead.count({
      where: {
        ...branchFilter,
        nextFollowUpAt: { lte: new Date() },
        status: { notIn: ["CONFIRMED", "DUPLICATE", "LOST"] },
      },
    }),

    // New leads today specifically
    prisma.lead.count({
      where: {
        ...branchFilter,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),

    // Total active leads (not terminal)
    prisma.lead.count({
      where: {
        ...branchFilter,
        status: { notIn: ["CONFIRMED", "DUPLICATE", "LOST"] },
      },
    }),

    // Interested leads right now
    prisma.lead.count({
      where: { ...branchFilter, status: "INTERESTED" },
    }),

    // Count per status for pipeline view
    prisma.lead.groupBy({
      by: ["status"],
      where: branchFilter,
      _count: { _all: true },
    }),
  ]);

  // Conversion rate for the period
  const conversionRate =
    totalLeadsInPeriod > 0
      ? Math.round((confirmedInPeriod / totalLeadsInPeriod) * 100 * 10) / 10
      : 0;

  return {
    summary: {
      totalLeadsInPeriod,
      confirmedInPeriod,
      lostInPeriod,
      unassignedCount,
      overdueCount,
      newToday,
      totalActiveLeads,
      interestedCount,
      conversionRate,
    },
    pipeline: statusBreakdown.map((s) => ({
      status: s.status,
      count: s._count._all,
    })),
  };
}

// ═══════════════════════════════════════
// EMPLOYEE PERFORMANCE
// Confirmation rate + response time + follow-up compliance
// ═══════════════════════════════════════

export async function getEmployeePerformance(params: {
  prisma: PrismaClient;
  period: Period;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}) {
  const { prisma, branchId } = params;
  const { from, to } = getDateRange(
    params.period,
    params.dateFrom,
    params.dateTo,
  );

  const branchFilter = branchId ? { branchId } : {};

  // Fetch all active employees in branch
  const employees = await prisma.user.findMany({
    where: {
      ...branchFilter,
      role: "EMPLOYEE",
      isActive: true,
    },
    select: { id: true, name: true, email: true },
  });

  // Fetch all lead data in bulk — one query, process in JS
  // This avoids N+1 (one query per employee)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const employeeIds = employees.map((e) => e.id);

  const [allLeads, allInteractions, overdueLeads, allEmployeeInteractions, last7DayInteractions] =
    await Promise.all([
      prisma.lead.findMany({
        where: {
          ...branchFilter,
          assignedToId: { in: employeeIds },
          createdAt: { gte: from, lte: to },
        },
        select: {
          id: true,
          assignedToId: true,
          status: true,
          confirmedAt: true,
          createdAt: true,
          nextFollowUpAt: true,
        },
      }),

      // First interaction per lead — for response time calculation
      prisma.interactionLog.findMany({
        where: {
          lead: {
            assignedToId: { in: employeeIds },
            createdAt: { gte: from, lte: to },
          },
          type: { not: "STATUS_CHANGED" },
          isDeleted: false,
        },
        select: { id: true, leadId: true, userId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),

      // Leads with overdue follow-ups per employee
      prisma.lead.findMany({
        where: {
          ...branchFilter,
          assignedToId: { in: employeeIds },
          nextFollowUpAt: { lte: new Date() },
          status: { notIn: ["CONFIRMED", "DUPLICATE", "LOST"] },
        },
        select: { assignedToId: true },
      }),

      // All interactions BY employee during period — for call/engagement stats
      prisma.interactionLog.findMany({
        where: {
          userId: { in: employeeIds },
          createdAt: { gte: from, lte: to },
          isDeleted: false,
          type: { not: "STATUS_CHANGED" },
        },
        select: {
          userId: true,
          leadId: true,
          type: true,
          callDurationSecs: true,
          createdAt: true,
        },
      }),

      // Last 7 days interactions for daily activity chart (always fixed window)
      prisma.interactionLog.findMany({
        where: {
          userId: { in: employeeIds },
          createdAt: { gte: sevenDaysAgo },
          isDeleted: false,
          type: { not: "STATUS_CHANGED" },
        },
        select: {
          userId: true,
          leadId: true,
          type: true,
          callDurationSecs: true,
          createdAt: true,
        },
      }),
    ]);

  // Process in JS — group by employee
  const metrics = employees.map((employee) => {
    const employeeLeads = allLeads.filter(
      (l) => l.assignedToId === employee.id,
    );
    const totalAssigned = employeeLeads.length;
    const confirmed = employeeLeads.filter(
      (l) => l.status === "CONFIRMED",
    ).length;
    const lost = employeeLeads.filter((l) => l.status === "LOST").length;
    const active = employeeLeads.filter(
      (l) => !["CONFIRMED", "LOST", "DUPLICATE"].includes(l.status),
    ).length;

    const confirmationRate =
      totalAssigned > 0
        ? Math.round((confirmed / totalAssigned) * 100 * 10) / 10
        : 0;

    // Response time: avg hours from lead creation to first interaction
    const responseTimes: number[] = [];
    for (const lead of employeeLeads) {
      const firstInteraction = allInteractions.find(
        (i) => i.leadId === lead.id && i.userId === employee.id,
      );
      if (firstInteraction) {
        const diffHours =
          (firstInteraction.createdAt.getTime() - lead.createdAt.getTime()) /
          (1000 * 60 * 60);
        responseTimes.push(diffHours);
      }
    }

    const avgResponseHours =
      responseTimes.length > 0
        ? Math.round(
            (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) *
              10,
          ) / 10
        : null;

    // Follow-up compliance
    const employeeOverdue = overdueLeads.filter(
      (l) => l.assignedToId === employee.id,
    ).length;

    const followUpComplianceRate =
      totalAssigned > 0
        ? Math.round(
            ((totalAssigned - employeeOverdue) / totalAssigned) * 100 * 10,
          ) / 10
        : 100;

    // Performance score — weighted average
    const performanceScore = Math.round(
      confirmationRate * 0.5 +
        followUpComplianceRate * 0.3 +
        (avgResponseHours !== null
          ? Math.max(0, 100 - avgResponseHours * 2) * 0.2
          : 0),
    );

    // ── Call & engagement stats (filtered by interaction date in period) ──
    const empInteractions = allEmployeeInteractions.filter(
      (i) => i.userId === employee.id,
    );
    const empCalls = empInteractions.filter((i) => i.type === "CALL");
    const callCount = empCalls.length;
    const callMinutes = Math.round(
      empCalls.reduce((sum, i) => sum + (i.callDurationSecs ?? 0), 0) / 60,
    );
    const leadsInteracted = new Set(empInteractions.map((i) => i.leadId)).size;

    // ── 7-day daily activity for sparkline chart ──
    const empDailyLogs = last7DayInteractions.filter(
      (i) => i.userId === employee.id,
    );
    const dailyActivity = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + idx + 1);
      const dateStr = d.toISOString().split("T")[0]!;
      const dayLogs = empDailyLogs.filter(
        (i) => i.createdAt.toISOString().split("T")[0] === dateStr,
      );
      const dayCalls = dayLogs.filter((i) => i.type === "CALL");
      return {
        date: dateStr,
        interactions: dayLogs.length,
        calls: dayCalls.length,
        minutes: Math.round(
          dayCalls.reduce((sum, i) => sum + (i.callDurationSecs ?? 0), 0) / 60,
        ),
      };
    });

    return {
      employee: { id: employee.id, name: employee.name, email: employee.email },
      metrics: {
        totalAssigned,
        confirmed,
        lost,
        active,
        confirmationRate,
        avgResponseHours,
        overdueFollowUps: employeeOverdue,
        followUpComplianceRate,
        performanceScore,
        callCount,
        callMinutes,
        leadsInteracted,
        dailyActivity,
      },
    };
  });

  // Sort by performance score descending — worst performers at bottom
  metrics.sort(
    (a, b) => b.metrics.performanceScore - a.metrics.performanceScore,
  );

  return { employees: metrics, period: { from, to } };
}

// ═══════════════════════════════════════
// PIPELINE ANALYSIS
// Status breakdown + avg days per stage
// ═══════════════════════════════════════

export async function getPipelineAnalysis(params: {
  prisma: PrismaClient;
  branchId?: string;
}) {
  const { prisma, branchId } = params;
  const branchFilter = branchId ? { branchId } : {};

  const [statusCounts, recentTransitions] = await Promise.all([
    // Current count per status
    prisma.lead.groupBy({
      by: ["status"],
      where: branchFilter,
      _count: { _all: true },
    }),

    // Recent status change interactions for avg time calculation
    prisma.interactionLog.findMany({
      where: {
        type: "STATUS_CHANGED",
        statusBefore: { not: null },
        statusAfter: { not: null },
        lead: branchFilter,
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      select: {
        statusBefore: true,
        statusAfter: true,
        createdAt: true,
        leadId: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Calculate avg days spent in each stage
  // Group transitions by lead → calculate time between consecutive transitions
  const leadTimelines: Record<string, Array<{ status: string; at: Date }>> = {};

  for (const t of recentTransitions) {
    if (!t.leadId || !t.statusBefore || !t.statusAfter) continue;
    if (!leadTimelines[t.leadId]) leadTimelines[t.leadId] = [];
    leadTimelines[t.leadId]!.push({ status: t.statusBefore, at: t.createdAt });
  }

  const stageTimings: Record<string, number[]> = {};

  for (const timeline of Object.values(leadTimelines)) {
    for (let i = 0; i < timeline.length - 1; i++) {
      const current = timeline[i]!;
      const next = timeline[i + 1]!;
      const daysInStage =
        (next.at.getTime() - current.at.getTime()) / (1000 * 60 * 60 * 24);
      if (!stageTimings[current.status]) stageTimings[current.status] = [];
      stageTimings[current.status]!.push(daysInStage);
    }
  }

  const avgDaysPerStage: Record<string, number> = {};
  for (const [status, times] of Object.entries(stageTimings)) {
    avgDaysPerStage[status] =
      Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10;
  }

  return {
    statusBreakdown: statusCounts.map((s) => ({
      status: s.status,
      count: s._count._all,
      avgDaysInStage: avgDaysPerStage[s.status] ?? null,
    })),
  };
}

// ═══════════════════════════════════════
// SOURCE REPORT
// Leads per source + conversion rate
// ═══════════════════════════════════════

export async function getSourceReport(params: {
  prisma: PrismaClient;
  period: Period;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}) {
  const { prisma, branchId } = params;
  const { from, to } = getDateRange(
    params.period,
    params.dateFrom,
    params.dateTo,
  );
  const branchFilter = branchId ? { branchId } : {};

  const [allSources, leadsBySource] = await Promise.all([
    prisma.leadSourceType.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    }),

    prisma.lead.groupBy({
      by: ["sourceId", "status"],
      where: {
        ...branchFilter,
        createdAt: { gte: from, lte: to },
      },
      _count: { _all: true },
    }),
  ]);

  // Build source report — group by sourceId then calculate rates
  const sourceMap: Record<
    string,
    { total: number; confirmed: number; lost: number }
  > = {};

  for (const row of leadsBySource) {
    const key = row.sourceId ?? "unknown";
    if (!sourceMap[key]) sourceMap[key] = { total: 0, confirmed: 0, lost: 0 };
    sourceMap[key]!.total += row._count._all;
    if (row.status === "CONFIRMED")
      sourceMap[key]!.confirmed += row._count._all;
    if (row.status === "LOST") sourceMap[key]!.lost += row._count._all;
  }

  const report = allSources.map((source) => {
    const data = sourceMap[source.id] ?? { total: 0, confirmed: 0, lost: 0 };
    const conversionRate =
      data.total > 0
        ? Math.round((data.confirmed / data.total) * 100 * 10) / 10
        : 0;

    return {
      source: { id: source.id, name: source.name },
      total: data.total,
      confirmed: data.confirmed,
      lost: data.lost,
      conversionRate,
    };
  });

  // Sort by total descending
  report.sort((a, b) => b.total - a.total);

  return { sources: report, period: { from, to } };
}

// ═══════════════════════════════════════
// FOLLOW-UP COMPLIANCE
// Overdue + never acted + scheduled-never-updated
// ═══════════════════════════════════════

export async function getFollowUpCompliance(params: {
  prisma: PrismaClient;
  branchId?: string;
}) {
  const { prisma, branchId } = params;
  const now = new Date();
  const branchFilter = branchId ? { branchId } : {};

  const overdueLeads = await prisma.lead.findMany({
    where: {
      ...branchFilter,
      nextFollowUpAt: { lte: now },
      status: { notIn: ["CONFIRMED", "DUPLICATE", "LOST"] },
    },
    select: {
      id: true,
      studentName: true,
      phone: true,
      status: true,
      nextFollowUpAt: true,
      assignedTo: { select: { id: true, name: true } },
      createdAt: true,
    },
    orderBy: { nextFollowUpAt: "asc" },
  });

  const interactionRecency = overdueLeads.length
    ? await prisma.interactionLog.groupBy({
        by: ["leadId"],
        where: {
          isDeleted: false,
          leadId: { in: overdueLeads.map((lead) => lead.id) },
        },
        _max: { createdAt: true },
      })
    : [];

  const latestInteractionByLead = new Map(
    interactionRecency.map((row) => [row.leadId, row._max.createdAt]),
  );

  const scheduledNeverActed = overdueLeads.filter((lead) => {
    const nextFollowUpAt = lead.nextFollowUpAt;
    if (!nextFollowUpAt) return false;

    const latestInteraction = latestInteractionByLead.get(lead.id);
    return !latestInteraction || latestInteraction < nextFollowUpAt;
  });

  const employeeOverdueSummary = await prisma.lead.groupBy({
    by: ["assignedToId"],
    where: {
      ...branchFilter,
      nextFollowUpAt: { lte: now },
      status: { notIn: ["CONFIRMED", "DUPLICATE", "LOST"] },
      assignedToId: { not: null },
    },
    _count: { _all: true },
  });

  // Enrich employee summary with names
  const employeeIds = employeeOverdueSummary
    .map((e) => e.assignedToId)
    .filter(Boolean) as string[];

  const employees = await prisma.user.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, name: true },
  });

  const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e.name]));

  const employeeWise = employeeOverdueSummary.map((row) => ({
    employeeId: row.assignedToId,
    employeeName: row.assignedToId
      ? (employeeMap[row.assignedToId] ?? "Unknown")
      : "Unassigned",
    overdueCount: row._count._all,
  }));

  employeeWise.sort((a, b) => b.overdueCount - a.overdueCount);

  return {
    totalOverdue: overdueLeads.length,
    neverActedCount: scheduledNeverActed.length,
    overdueLeads,
    neverActedLeads: scheduledNeverActed,
    employeeWise,
  };
}

// ═══════════════════════════════════════
// CONFIRMED APPLICATIONS REPORT
// Fees collected + dues + document status
// ═══════════════════════════════════════

export async function getConfirmedReport(params: {
  prisma: PrismaClient;
  period: Period;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}) {
  const { prisma, branchId } = params;
  const { from, to } = getDateRange(
    params.period,
    params.dateFrom,
    params.dateTo,
  );
  const branchFilter = branchId ? { branchId } : {};

  const confirmedLeads = await prisma.lead.findMany({
    where: {
      ...branchFilter,
      status: "CONFIRMED",
      confirmedAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      studentName: true,
      phone: true,
      confirmedAt: true,
      confirmedById: true,
      assignedTo: { select: { id: true, name: true } },
      courses: {
        where: { isPrimary: true },
        select: { course: { select: { name: true } } },
      },
      confirmedApplication: {
        select: {
          id: true,
          aadharNo: true,
          apaarId: true,
          bookingAmount: true,
          admissionAmount: true,
          duesAmount: true,
          dueDate: true,
          documents: {
            select: {
              isVerified: true,
              documentType: { select: { name: true, isRequired: true } },
            },
          },
        },
      },
    },
    orderBy: { confirmedAt: "desc" },
  });

  // Aggregate fee totals
  let totalBookingCollected = 0;
  let totalAdmissionCollected = 0;
  let totalDuesPending = 0;
  let totalDocumentsRequired = 0;
  let totalDocumentsVerified = 0;
  let incompleteDocuments = 0;

  for (const lead of confirmedLeads) {
    const app = lead.confirmedApplication;
    if (!app) continue;

    totalBookingCollected += app.bookingAmount ?? 0;
    totalAdmissionCollected += app.admissionAmount ?? 0;
    totalDuesPending += app.duesAmount ?? 0;

    const requiredDocs = app.documents.filter((d) => d.documentType.isRequired);
    const verifiedDocs = app.documents.filter((d) => d.isVerified);

    totalDocumentsRequired += requiredDocs.length;
    totalDocumentsVerified += verifiedDocs.length;

    const hasIncomplete = requiredDocs.some((d) => !d.isVerified);
    if (hasIncomplete) incompleteDocuments++;
  }

  return {
    period: { from, to },
    summary: {
      totalConfirmed: confirmedLeads.length,
      totalBookingCollected,
      totalAdmissionCollected,
      totalFeesCollected: totalBookingCollected + totalAdmissionCollected,
      totalDuesPending,
      documentsCompliance: {
        required: totalDocumentsRequired,
        verified: totalDocumentsVerified,
        leadsWithIncompleteDocuments: incompleteDocuments,
      },
    },
    leads: confirmedLeads.map((l) => ({
      id: l.id,
      studentName: l.studentName,
      phone: l.phone,
      confirmedAt: l.confirmedAt,
      assignedTo: l.assignedTo,
      primaryCourse: l.courses[0]?.course.name ?? null,
      aadharNo: l.confirmedApplication?.aadharNo ?? null,
      apaarId: l.confirmedApplication?.apaarId ?? null,
      bookingAmount: l.confirmedApplication?.bookingAmount ?? 0,
      admissionAmount: l.confirmedApplication?.admissionAmount ?? 0,
      duesAmount: l.confirmedApplication?.duesAmount ?? 0,
      dueDate: l.confirmedApplication?.dueDate ?? null,
      documentsVerified:
        l.confirmedApplication?.documents.filter((d) => d.isVerified).length ??
        0,
      documentsTotal: l.confirmedApplication?.documents.length ?? 0,
    })),
  };
}
