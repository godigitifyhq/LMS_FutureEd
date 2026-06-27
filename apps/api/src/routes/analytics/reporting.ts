/**
 * Reporting module — all new analytics service functions.
 *
 * SINGLE-SOURCE-OF-TRUTH RULE:
 *   Every metric here is computed by exactly one function.
 *   The leaderboard, employee detail report, call report, and CSV export
 *   ALL call the same underlying aggregation — they do NOT re-implement it.
 *
 * Composition chain:
 *   getLeaderboard()          → calls computeEmployeeStats() per employee
 *   getEmployeeDetailReport() → calls computeEmployeeStats() for one employee
 *   getCallReport()           → calls computeCallRows()
 *   getTaskReport()           → standalone
 *   getDuplicateReport()      → standalone
 *   getConversionReport()     → composes getConfirmedReport() data
 */

import type { PrismaClient } from "@lms/db";
import { getDateRange } from "./helpers";
import type { Period } from "./helpers";

// ── IST offset — India Standard Time is UTC+5:30.
// Used to resolve "today", "start of day" correctly for IST.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Returns { from, to } in UTC corresponding to the period boundaries in IST. */
function getDateRangeIST(
  period: Period,
  dateFrom?: string,
  dateTo?: string,
): { from: Date; to: Date } {
  // getDateRange already works in UTC. For today/week presets we override
  // with IST-aligned midnight boundaries.
  if (period === "today") {
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    // Start of today in IST = YYYY-MM-DD 00:00:00 IST = UTC minus 5.5 h
    const todayIST = new Date(
      Date.UTC(
        nowIST.getUTCFullYear(),
        nowIST.getUTCMonth(),
        nowIST.getUTCDate(),
        0, 0, 0, 0,
      ) - IST_OFFSET_MS,
    );
    const endIST = new Date(todayIST.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { from: todayIST, to: endIST };
  }
  // For all other presets, the existing getDateRange is fine.
  return getDateRange(period, dateFrom, dateTo);
}

// ══════════════════════════════════════════════════════════════
// SHARED EMPLOYEE STATS — the ONLY place employee KPIs are computed
// ══════════════════════════════════════════════════════════════

export type EmployeeStats = {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  designation: string | null;
  team: string | null;
  isOnline: boolean; // lastActiveAt within last 5 minutes
  lastActiveAt: Date | null;
  firstCallAt: Date | null;
  lastCallAt: Date | null;
  lastConnectedCallAt: Date | null;

  // Leads
  totalLeads: number;
  newLeads: number;
  confirmedLeads: number;
  lostLeads: number;
  activeLeads: number; // not confirmed / not lost / not duplicate

  // Calls
  totalCalls: number;       // CALL interactions
  connectedCalls: number;   // outcome = CONNECTED (or no outcome set, backward compat)
  missedCalls: number;      // outcome != CONNECTED
  totalCallMinutes: number;

  // Interactions
  totalInteractions: number; // all non-STATUS_CHANGED interactions
  leadsInteracted: number;   // unique leads touched

  // Revenue (from ConfirmedApplication)
  totalRevenue: number; // bookingAmount + admissionAmount for confirmed leads

  // Follow-up compliance
  overdueFollowUps: number;
  followUpComplianceRate: number; // 0–100

  // Conversion
  confirmationRate: number; // 0–100

  // Tasks
  tasksPending: number;
  tasksCompleted: number;
  tasksOverdue: number;
};

/**
 * Core aggregation — single source of truth for all employee KPIs.
 * Called by getLeaderboard() and getEmployeeDetailReport() and CSV export.
 */
export async function computeEmployeeStats(params: {
  prisma: PrismaClient;
  period: Period;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  employeeId?: string; // omit for all employees
}): Promise<EmployeeStats[]> {
  const { prisma, branchId, employeeId } = params;
  const { from, to } = getDateRangeIST(
    params.period,
    params.dateFrom,
    params.dateTo,
  );

  const branchFilter = branchId ? { branchId } : {};
  const employeeFilter = employeeId ? { id: employeeId } : {};

  const now = new Date();
  const onlineThreshold = new Date(now.getTime() - 5 * 60 * 1000); // 5 min window

  // Fetch all staff (employees + admin/sub-admin) — historical reports include deactivated
  const employees = await prisma.user.findMany({
    where: { ...branchFilter, ...employeeFilter, role: { in: ["EMPLOYEE", "ADMIN", "SUB_ADMIN"] } },
    select: {
      id: true,
      name: true,
      email: true,
      designation: true,
      team: true,
      lastActiveAt: true,
    },
  });

  if (employees.length === 0) return [];

  const ids = employees.map((e) => e.id);

  // All parallel — zero sequential awaits
  const [
    leads,
    interactions,
    overdueLeads,
    tasks,
  ] = await Promise.all([
    // Leads created in period, including revenue data — single source for confirmedLeads + revenue
    prisma.lead.findMany({
      where: {
        ...branchFilter,
        assignedToId: { in: ids },
        createdAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        assignedToId: true,
        status: true,
        createdAt: true,
        confirmedApplication: {
          select: { bookingAmount: true, admissionAmount: true },
        },
      },
    }),

    // Non-status interactions in period, by these employees
    prisma.interactionLog.findMany({
      where: {
        userId: { in: ids },
        createdAt: { gte: from, lte: to },
        isDeleted: false,
        type: { not: "STATUS_CHANGED" },
      },
      select: {
        userId: true,
        leadId: true,
        type: true,
        createdAt: true,
        callDurationSecs: true,
        callOutcome: true,
      },
    }),

    // Overdue follow-ups (no period filter — current state)
    prisma.lead.findMany({
      where: {
        ...branchFilter,
        assignedToId: { in: ids },
        nextFollowUpAt: { lte: now },
        status: { notIn: ["CONFIRMED", "DUPLICATE", "LOST"] },
      },
      select: { assignedToId: true },
    }),

    // Tasks in period
    prisma.task.findMany({
      where: {
        ...branchFilter,
        assignedToId: { in: ids },
        createdAt: { gte: from, lte: to },
      },
      select: {
        assignedToId: true,
        status: true,
        dueAt: true,
        completedAt: true,
      },
    }),
  ]);

  // Aggregate per-employee
  return employees.map((emp) => {
    const empLeads      = leads.filter((l) => l.assignedToId === emp.id);
    const empInt        = interactions.filter((i) => i.userId === emp.id);
    const empCalls      = empInt.filter((i) => i.type === "CALL");
    const empOverdue    = overdueLeads.filter((l) => l.assignedToId === emp.id);
    const empTasks      = tasks.filter((t) => t.assignedToId === emp.id);

    const totalLeads      = empLeads.length;
    const confirmedLeads  = empLeads.filter((l) => l.status === "CONFIRMED").length;
    const lostLeads       = empLeads.filter((l) => l.status === "LOST").length;
    const newLeads        = empLeads.filter((l) => l.status === "NEW").length;
    const activeLeads     = empLeads.filter(
      (l) => !["CONFIRMED", "LOST", "DUPLICATE"].includes(l.status),
    ).length;

    const totalCalls     = empCalls.length;
    // Backward compat: if callOutcome is null (pre-migration calls), count as connected
    const connectedCalls = empCalls.filter(
      (c) => !c.callOutcome || c.callOutcome === "CONNECTED",
    ).length;
    const missedCalls    = totalCalls - connectedCalls;
    const totalCallMinutes = Math.round(
      empCalls.reduce((s, c) => s + (c.callDurationSecs ?? 0), 0) / 60,
    );
    const firstCallAt = empCalls.reduce<Date | null>(
      (earliest, call) =>
        !earliest || call.createdAt < earliest ? call.createdAt : earliest,
      null,
    );
    const lastCallAt = empCalls.reduce<Date | null>(
      (latest, call) =>
        !latest || call.createdAt > latest ? call.createdAt : latest,
      null,
    );
    const lastConnectedCallAt = empCalls.reduce<Date | null>(
      (latest, call) => {
        if (call.callOutcome && call.callOutcome !== "CONNECTED") {
          return latest;
        }
        return !latest || call.createdAt > latest ? call.createdAt : latest;
      },
      null,
    );

    const totalInteractions = empInt.length;
    const leadsInteracted   = new Set(empInt.map((i) => i.leadId)).size;

    // Revenue from confirmed leads created in the same period — consistent with confirmedLeads count
    const totalRevenue = empLeads.reduce((s, l) => {
      if (l.status !== "CONFIRMED") return s;
      const app = l.confirmedApplication;
      return s + (app?.bookingAmount ?? 0) + (app?.admissionAmount ?? 0);
    }, 0);

    const overdueFollowUps = empOverdue.length;
    // Clamp to [0, 100] — overdueFollowUps is ALL-TIME while totalLeads is period-scoped,
    // so the raw formula can go negative when an employee has more historical overdue than new leads.
    const followUpComplianceRate = totalLeads > 0
      ? Math.max(0, Math.min(100, Math.round(((totalLeads - overdueFollowUps) / totalLeads) * 100 * 10) / 10))
      : 100;
    const confirmationRate = totalLeads > 0
      ? Math.round((confirmedLeads / totalLeads) * 100 * 10) / 10
      : 0;

    const tasksPending   = empTasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS").length;
    const tasksCompleted = empTasks.filter((t) => t.status === "COMPLETED").length;
    const tasksOverdue   = empTasks.filter(
      (t) => t.status !== "COMPLETED" && t.status !== "CANCELLED" && t.dueAt && t.dueAt < now,
    ).length;

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      employeeEmail: emp.email,
      designation: emp.designation,
      team: emp.team,
      isOnline: emp.lastActiveAt ? emp.lastActiveAt >= onlineThreshold : false,
      lastActiveAt: emp.lastActiveAt,
      firstCallAt,
      lastCallAt,
      lastConnectedCallAt,
      totalLeads,
      newLeads,
      confirmedLeads,
      lostLeads,
      activeLeads,
      totalCalls,
      connectedCalls,
      missedCalls,
      totalCallMinutes,
      totalInteractions,
      leadsInteracted,
      totalRevenue,
      overdueFollowUps,
      followUpComplianceRate,
      confirmationRate,
      tasksPending,
      tasksCompleted,
      tasksOverdue,
    };
  });
}

// ══════════════════════════════════════════════════════════════
// LEADERBOARD
// ══════════════════════════════════════════════════════════════

export type LeaderboardRow = EmployeeStats & {
  rank: number;
  prevRank: number | null; // rank in the previous equivalent period
  rankDelta: number | null; // positive = moved up
};

/** Sort key: confirmation rate → total leads → connected calls */
function leaderboardScore(s: EmployeeStats): number {
  return s.confirmationRate * 1000 + s.totalLeads * 10 + s.connectedCalls;
}

export async function getLeaderboard(params: {
  prisma: PrismaClient;
  period: Period;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}): Promise<{ rows: LeaderboardRow[]; period: { from: string; to: string } }> {
  const { from, to } = getDateRangeIST(params.period, params.dateFrom, params.dateTo);

  // Current period stats
  const current = await computeEmployeeStats(params);
  const sorted  = [...current].sort((a, b) => leaderboardScore(b) - leaderboardScore(a));

  // Previous period (same duration, shifted back)
  const durationMs = to.getTime() - from.getTime();
  const prevFrom   = new Date(from.getTime() - durationMs);
  const prevTo     = new Date(from.getTime() - 1);
  const prev = await computeEmployeeStats({
    ...params,
    period: "custom",
    dateFrom: prevFrom.toISOString().split("T")[0]!,
    dateTo:   prevTo.toISOString().split("T")[0]!,
  });
  const prevSorted = [...prev].sort((a, b) => leaderboardScore(b) - leaderboardScore(a));
  const prevRankMap = new Map(prevSorted.map((s, i) => [s.employeeId, i + 1]));

  const rows: LeaderboardRow[] = sorted.map((s, i) => {
    const rank     = i + 1;
    const prevRank = prevRankMap.get(s.employeeId) ?? null;
    return {
      ...s,
      rank,
      prevRank,
      rankDelta: prevRank !== null ? prevRank - rank : null,
    };
  });

  return {
    rows,
    period: {
      from: from.toISOString().split("T")[0]!,
      to:   to.toISOString().split("T")[0]!,
    },
  };
}

// ══════════════════════════════════════════════════════════════
// EMPLOYEE DETAIL REPORT
// ══════════════════════════════════════════════════════════════

export type DailyCallStat = {
  date: string;
  totalCalls: number;
  connectedCalls: number;
  missedCalls: number;
  totalMinutes: number;
};

export type HourlyCallStat = {
  hour: number; // 0–23
  totalCalls: number;
};

export type EmployeeDetailReport = {
  stats: EmployeeStats;
  dailyCalls: DailyCallStat[];  // one entry per day in period
  hourlyCalls: HourlyCallStat[]; // distribution over 24 hours
  recentCalls: {
    id: string;
    leadId: string | null;
    leadName: string;
    leadPhone: string;
    outcome: string | null;
    durationSecs: number | null;
    recordingUrl: string | null;
    createdAt: string;
  }[];
  period: { from: string; to: string };
};

export async function getEmployeeDetailReport(params: {
  prisma: PrismaClient;
  period: Period;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  employeeId: string;
}): Promise<EmployeeDetailReport | null> {
  const { prisma, branchId, employeeId } = params;
  const { from, to } = getDateRangeIST(params.period, params.dateFrom, params.dateTo);

  // Stats (reuses the single-source function)
  const statsArr = await computeEmployeeStats({ ...params });
  const stats = statsArr[0];
  if (!stats) return null;

  // Call-level detail
  const calls = await prisma.interactionLog.findMany({
    where: {
      userId: employeeId,
      type: "CALL",
      isDeleted: false,
      createdAt: { gte: from, lte: to },
      ...(branchId ? { lead: { branchId } } : {}),
    },
    select: {
      id: true,
      callDurationSecs: true,
      callOutcome: true,
      callRecordingUrl: true,
      createdAt: true,
      lead: { select: { id: true, studentName: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Build daily buckets
  const msPerDay   = 24 * 60 * 60 * 1000;
  const periodDays = Math.ceil((to.getTime() - from.getTime()) / msPerDay) + 1;

  const dailyCalls: DailyCallStat[] = Array.from({ length: periodDays }, (_, idx) => {
    const d      = new Date(from.getTime() + idx * msPerDay);
    const dStr   = d.toISOString().split("T")[0]!;
    const dayLogs = calls.filter(
      (c) => c.createdAt.toISOString().split("T")[0] === dStr,
    );
    const connected = dayLogs.filter(
      (c) => !c.callOutcome || c.callOutcome === "CONNECTED",
    ).length;
    return {
      date:           dStr,
      totalCalls:     dayLogs.length,
      connectedCalls: connected,
      missedCalls:    dayLogs.length - connected,
      totalMinutes:   Math.round(
        dayLogs.reduce((s, c) => s + (c.callDurationSecs ?? 0), 0) / 60,
      ),
    };
  });

  // Hourly distribution (IST-adjusted)
  const hourlyCalls: HourlyCallStat[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    totalCalls: calls.filter((c) => {
      const hourIST = Math.floor(
        (c.createdAt.getTime() + IST_OFFSET_MS) / (60 * 60 * 1000),
      ) % 24;
      return hourIST === h;
    }).length,
  }));

  const recentCalls = calls.slice(0, 50).map((c) => ({
    id:           c.id,
    leadId:       c.lead?.id ?? null,
    leadName:     c.lead?.studentName ?? "Unknown",
    leadPhone:    c.lead?.phone ?? "—",
    outcome:      c.callOutcome,
    durationSecs: c.callDurationSecs,
    recordingUrl: c.callRecordingUrl,
    createdAt:    c.createdAt.toISOString(),
  }));

  return {
    stats,
    dailyCalls,
    hourlyCalls,
    recentCalls,
    period: {
      from: from.toISOString().split("T")[0]!,
      to:   to.toISOString().split("T")[0]!,
    },
  };
}

// ══════════════════════════════════════════════════════════════
// CALL REPORT
// ══════════════════════════════════════════════════════════════

export type CallRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  outcome: string | null;
  direction: string | null;
  durationSecs: number | null;
  durationLabel: string; // "3m 20s"
  recordingUrl: string | null;
  createdAt: string;
};

export async function getCallReport(params: {
  prisma: PrismaClient;
  period: Period;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  employeeId?: string;
  outcome?: string;
}): Promise<{ rows: CallRow[]; totals: { calls: number; connectedCalls: number; totalMinutes: number }; period: { from: string; to: string } }> {
  const { prisma, branchId, employeeId, outcome } = params;
  const { from, to } = getDateRangeIST(params.period, params.dateFrom, params.dateTo);

  const rows = await prisma.interactionLog.findMany({
    where: {
      type: "CALL",
      isDeleted: false,
      createdAt: { gte: from, lte: to },
      ...(employeeId ? { userId: employeeId } : {}),
      ...(outcome ? { callOutcome: outcome as any } : {}),
      user: { role: { in: ["EMPLOYEE", "ADMIN", "SUB_ADMIN"] }, ...(branchId ? { branchId } : {}) },
    },
    select: {
      id: true,
      callDurationSecs: true,
      callOutcome: true,
      callDirection: true,
      callRecordingUrl: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
      lead: { select: { id: true, studentName: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000, // per Q9 — max realistic rows
  });

  function fmtDuration(secs: number | null): string {
    if (!secs) return "—";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  const callRows: CallRow[] = rows.map((r) => ({
    id:           r.id,
    employeeId:   r.user.id,
    employeeName: r.user.name,
    leadId:       r.lead?.id ?? "",
    leadName:     r.lead?.studentName ?? "Unknown",
    leadPhone:    r.lead?.phone ?? "—",
    outcome:      r.callOutcome,
    direction:    r.callDirection,
    durationSecs: r.callDurationSecs,
    durationLabel: fmtDuration(r.callDurationSecs),
    recordingUrl: r.callRecordingUrl,
    createdAt:    r.createdAt.toISOString(),
  }));

  const connectedCalls = callRows.filter(
    (r) => !r.outcome || r.outcome === "CONNECTED",
  ).length;

  return {
    rows: callRows,
    totals: {
      calls:          callRows.length,
      connectedCalls,
      totalMinutes:   Math.round(
        callRows.reduce((s, r) => s + (r.durationSecs ?? 0), 0) / 60,
      ),
    },
    period: {
      from: from.toISOString().split("T")[0]!,
      to:   to.toISOString().split("T")[0]!,
    },
  };
}

// ══════════════════════════════════════════════════════════════
// TASK REPORT
// ══════════════════════════════════════════════════════════════

export type TaskReportRow = {
  id: string;
  title: string;
  status: string;
  assigneeName: string;
  assigneeId: string;
  leadName: string | null;
  leadId: string | null;
  dueAt: string | null;
  completedAt: string | null;
  isOverdue: boolean;
  createdAt: string;
};

export async function getTaskReport(params: {
  prisma: PrismaClient;
  period: Period;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  employeeId?: string;
  status?: string;
  overdue?: boolean;
  title?: string;
}): Promise<{
  rows: TaskReportRow[];
  totals: { total: number; pending: number; completed: number; overdue: number };
  period: { from: string; to: string };
}> {
  const { prisma, branchId, employeeId, status, overdue, title } = params;
  const { from, to } = getDateRangeIST(params.period, params.dateFrom, params.dateTo);
  const now = new Date();

  const rows = await prisma.task.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      ...(employeeId ? { assignedToId: employeeId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(title
        ? { title: { contains: title, mode: "insensitive" as const } }
        : {}),
      ...(overdue
        ? {
            dueAt: { lt: now },
            status: { notIn: ["COMPLETED", "CANCELLED"] },
          }
        : {}),
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      title: true,
      status: true,
      dueAt: true,
      completedAt: true,
      createdAt: true,
      assignedTo: { select: { id: true, name: true } },
      lead: { select: { id: true, studentName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const taskRows: TaskReportRow[] = rows.map((r) => ({
    id:           r.id,
    title:        r.title,
    status:       r.status,
    assigneeId:   r.assignedTo.id,
    assigneeName: r.assignedTo.name,
    leadId:       r.lead?.id ?? null,
    leadName:     r.lead?.studentName ?? null,
    dueAt:        r.dueAt?.toISOString() ?? null,
    completedAt:  r.completedAt?.toISOString() ?? null,
    isOverdue:    r.status !== "COMPLETED" && r.status !== "CANCELLED" &&
                  !!r.dueAt && r.dueAt < now,
    createdAt:    r.createdAt.toISOString(),
  }));

  const total     = taskRows.length;
  const pending   = taskRows.filter((r) => r.status === "PENDING" || r.status === "IN_PROGRESS").length;
  const completed = taskRows.filter((r) => r.status === "COMPLETED").length;
  const overdueCount = taskRows.filter((r) => r.isOverdue).length;

  return {
    rows: taskRows,
    totals: { total, pending, completed, overdue: overdueCount },
    period: {
      from: from.toISOString().split("T")[0]!,
      to:   to.toISOString().split("T")[0]!,
    },
  };
}

// ══════════════════════════════════════════════════════════════
// DUPLICATE LEAD REPORT
// ══════════════════════════════════════════════════════════════

export type DuplicateLeadRow = {
  duplicateId: string;
  duplicateName: string;
  duplicatePhone: string;
  duplicateStatus: string;
  duplicateCreatedAt: string;
  originalId: string | null;
  originalName: string | null;
  originalPhone: string | null;
  assigneeName: string | null;
  assigneeId: string | null;
};

export async function getDuplicateReport(params: {
  prisma: PrismaClient;
  branchId?: string;
}): Promise<{ rows: DuplicateLeadRow[]; total: number }> {
  const { prisma, branchId } = params;

  const duplicates = await prisma.lead.findMany({
    where: {
      isDuplicate: true,
      ...(branchId ? { branchId } : {}),
    },
    select: {
      id: true,
      studentName: true,
      phone: true,
      status: true,
      createdAt: true,
      duplicateOfId: true,
      assignedTo: { select: { id: true, name: true } },
      duplicateOf: { select: { id: true, studentName: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const rows: DuplicateLeadRow[] = duplicates.map((d) => ({
    duplicateId:        d.id,
    duplicateName:      d.studentName,
    duplicatePhone:     d.phone,
    duplicateStatus:    d.status,
    duplicateCreatedAt: d.createdAt.toISOString(),
    originalId:         d.duplicateOf?.id ?? null,
    originalName:       d.duplicateOf?.studentName ?? null,
    originalPhone:      d.duplicateOf?.phone ?? null,
    assigneeId:         d.assignedTo?.id ?? null,
    assigneeName:       d.assignedTo?.name ?? null,
  }));

  return { rows, total: rows.length };
}

// ══════════════════════════════════════════════════════════════
// CONVERSION / REVENUE REPORT
// ══════════════════════════════════════════════════════════════

export type ConversionReportRow = {
  employeeId: string;
  employeeName: string;
  totalLeads: number;
  confirmedLeads: number;
  conversionRate: number;
  revenue: number; // bookingAmount + admissionAmount
  avgRevenue: number;
};

export type ConversionReport = {
  rows: ConversionReportRow[];
  totals: {
    totalLeads: number;
    confirmedLeads: number;
    overallConversionRate: number;
    totalRevenue: number;
  };
  dailyTrend: { date: string; confirmed: number; revenue: number }[];
  sourceBreakdown: { sourceName: string; confirmed: number; revenue: number }[];
  period: { from: string; to: string };
};

export async function getConversionReport(params: {
  prisma: PrismaClient;
  period: Period;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}): Promise<ConversionReport> {
  const { prisma, branchId } = params;
  const { from, to } = getDateRangeIST(params.period, params.dateFrom, params.dateTo);
  const branchFilter = branchId ? { branchId } : {};

  const [confirmedLeads, allLeadsByEmployee] = await Promise.all([
    prisma.lead.findMany({
      where: {
        ...branchFilter,
        status: "CONFIRMED",
        confirmedAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        confirmedAt: true,
        assignedToId: true,
        assignedTo: { select: { id: true, name: true } },
        source: { select: { name: true } },
        confirmedApplication: {
          select: { bookingAmount: true, admissionAmount: true },
        },
      },
    }),
    prisma.lead.groupBy({
      by: ["assignedToId"],
      where: {
        ...branchFilter,
        createdAt: { gte: from, lte: to },
        assignedToId: { not: null },
      },
      _count: { id: true },
    }),
  ]);

  // Employee rows
  const leadCountMap = new Map(
    allLeadsByEmployee.map((r) => [r.assignedToId!, r._count.id]),
  );
  const employeeMap = new Map<string, { name: string; confirmed: number; revenue: number }>();

  for (const lead of confirmedLeads) {
    const id = lead.assignedToId;
    if (!id) continue;
    const revenue =
      (lead.confirmedApplication?.bookingAmount ?? 0) +
      (lead.confirmedApplication?.admissionAmount ?? 0);
    const entry = employeeMap.get(id) ?? {
      name:      lead.assignedTo?.name ?? "Unknown",
      confirmed: 0,
      revenue:   0,
    };
    entry.confirmed++;
    entry.revenue += revenue;
    employeeMap.set(id, entry);
  }

  const rows: ConversionReportRow[] = Array.from(employeeMap.entries()).map(
    ([empId, data]) => {
      const totalLeads = leadCountMap.get(empId) ?? 0;
      return {
        employeeId:     empId,
        employeeName:   data.name,
        totalLeads,
        confirmedLeads: data.confirmed,
        conversionRate: totalLeads > 0
          ? Math.round((data.confirmed / totalLeads) * 100 * 10) / 10
          : 0,
        revenue:        Math.round(data.revenue),
        avgRevenue:     data.confirmed > 0
          ? Math.round(data.revenue / data.confirmed)
          : 0,
      };
    },
  ).sort((a, b) => b.revenue - a.revenue);

  // Daily trend
  const msPerDay   = 24 * 60 * 60 * 1000;
  const periodDays = Math.min(
    Math.ceil((to.getTime() - from.getTime()) / msPerDay) + 1,
    91,
  );
  const dailyTrend = Array.from({ length: periodDays }, (_, idx) => {
    const d    = new Date(from.getTime() + idx * msPerDay);
    const dStr = d.toISOString().split("T")[0]!;
    const dayLeads = confirmedLeads.filter(
      (l) => l.confirmedAt?.toISOString().split("T")[0] === dStr,
    );
    return {
      date:      dStr,
      confirmed: dayLeads.length,
      revenue:   Math.round(
        dayLeads.reduce(
          (s, l) =>
            s +
            (l.confirmedApplication?.bookingAmount ?? 0) +
            (l.confirmedApplication?.admissionAmount ?? 0),
          0,
        ),
      ),
    };
  });

  // Source breakdown
  const sourceMap = new Map<string, { confirmed: number; revenue: number }>();
  for (const lead of confirmedLeads) {
    const name = lead.source?.name ?? "Direct / Other";
    const rev  =
      (lead.confirmedApplication?.bookingAmount ?? 0) +
      (lead.confirmedApplication?.admissionAmount ?? 0);
    const entry = sourceMap.get(name) ?? { confirmed: 0, revenue: 0 };
    entry.confirmed++;
    entry.revenue += rev;
    sourceMap.set(name, entry);
  }
  const sourceBreakdown = Array.from(sourceMap.entries())
    .map(([sourceName, v]) => ({ sourceName, confirmed: v.confirmed, revenue: Math.round(v.revenue) }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue     = rows.reduce((s, r) => s + r.revenue, 0);
  const totalConfirmed   = confirmedLeads.length;
  const totalLeadsInPeriod = Array.from(leadCountMap.values()).reduce((s, n) => s + n, 0);

  return {
    rows,
    totals: {
      totalLeads:             totalLeadsInPeriod,
      confirmedLeads:         totalConfirmed,
      overallConversionRate:  totalLeadsInPeriod > 0
        ? Math.round((totalConfirmed / totalLeadsInPeriod) * 100 * 10) / 10
        : 0,
      totalRevenue,
    },
    dailyTrend,
    sourceBreakdown,
    period: {
      from: from.toISOString().split("T")[0]!,
      to:   to.toISOString().split("T")[0]!,
    },
  };
}

// ══════════════════════════════════════════════════════════════
// LEADERBOARD SUMMARY — for daily email cron
// ══════════════════════════════════════════════════════════════

export async function getLeaderboardSummaryForEmail(params: {
  prisma: PrismaClient;
  branchId?: string;
}): Promise<{ rows: (EmployeeStats & { rank: number })[]; date: string }> {
  const stats = await computeEmployeeStats({
    ...params,
    period: "today",
  });
  const sorted = [...stats]
    .sort((a, b) => leaderboardScore(b) - leaderboardScore(a))
    .map((s, i) => ({ ...s, rank: i + 1 }));

  return {
    rows: sorted,
    date: new Date().toISOString().split("T")[0]!,
  };
}
