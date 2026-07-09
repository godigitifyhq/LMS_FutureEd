"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Period } from "./useDashboard";

// ── Shared filter shape ──────────────────────────────────────
export type ReportFilters = {
  period?: Period;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  employeeId?: string;
};

type ApiResponse<T = unknown> = { data: T };

export type LeaderboardRow = {
  rank: number;
  prevRank: number | null;
  rankDelta: number | null;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  designation: string | null;
  team: string | null;
  isOnline: boolean;
  firstCallAt: string | null;
  lastCallAt: string | null;
  lastConnectedCallAt: string | null;
  totalLeads: number;
  confirmedLeads: number;
  lostLeads: number;
  totalCalls: number;
  connectedCalls: number;
  totalCallMinutes: number;
  totalCallSecs: number;
  leadsInteracted: number;
  totalRevenue: number;
  confirmationRate: number;
  overdueFollowUps: number;
  followUpComplianceRate: number;
  tasksPending: number;
  tasksCompleted: number;
};

export type LeaderboardResponse = {
  rows: LeaderboardRow[];
  period: { from: string; to: string };
};

export type EmployeeDetailStats = {
  employeeName: string;
  employeeEmail: string;
  designation: string | null;
  team: string | null;
  isOnline: boolean;
  firstCallAt: string | null;
  lastCallAt: string | null;
  lastConnectedCallAt: string | null;
  totalLeads: number;
  confirmedLeads: number;
  lostLeads: number;
  activeLeads: number;
  totalCalls: number;
  connectedCalls: number;
  missedCalls: number;
  totalCallMinutes: number;
  totalCallSecs: number;
  totalInteractions: number;
  leadsInteracted: number;
  totalRevenue: number;
  overdueFollowUps: number;
  followUpComplianceRate: number;
  confirmationRate: number;
  tasksPending: number;
  tasksCompleted: number;
  tasksOverdue: number;
};

export type DailyCallStat = {
  date: string;
  totalCalls: number;
  connectedCalls: number;
  missedCalls: number;
  totalMinutes: number;
};

export type HourlyCallStat = {
  hour: number;
  totalCalls: number;
};

export type CallEntry = {
  id: string;
  leadId: string | null;
  leadName: string;
  leadPhone: string;
  outcome: string | null;
  durationSecs: number | null;
  recordingUrl: string | null;
  createdAt: string;
};

export type EmployeeDetailResponse = {
  stats: EmployeeDetailStats;
  dailyCalls: DailyCallStat[];
  hourlyCalls: HourlyCallStat[];
  recentCalls: CallEntry[];
  period: { from: string; to: string };
};

export type CallReportRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  outcome: string | null;
  direction: string | null;
  durationSecs: number | null;
  durationLabel: string;
  recordingUrl: string | null;
  createdAt: string;
};

export type CallReportResponse = {
  rows: CallReportRow[];
  totals: {
    calls: number;
    connectedCalls: number;
    totalMinutes: number;
    totalDurationSecs: number;
  };
  period: { from: string; to: string };
};

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

export type TaskReportResponse = {
  rows: TaskReportRow[];
  totals: {
    total: number;
    pending: number;
    completed: number;
    overdue: number;
  };
  period: { from: string; to: string };
};

function buildQs(filters: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") p.set(k, v);
  }
  return p.toString() ? `?${p.toString()}` : "";
}

async function apiFetch<T>(url: string): Promise<ApiResponse<T>> {
  const res = await api.get<ApiResponse<T>>(url);
  return res.data;
}

// ── Leaderboard ──────────────────────────────────────────────
export function useLeaderboard(filters: ReportFilters) {
  return useQuery<ApiResponse<LeaderboardResponse>>({
    queryKey: ["leaderboard", filters],
    queryFn:  () => apiFetch(`/analytics/leaderboard${buildQs(filters as any)}`),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

// ── Employee Detail ──────────────────────────────────────────
export function useEmployeeDetail(employeeId: string, filters: ReportFilters) {
  return useQuery<ApiResponse<EmployeeDetailResponse>>({
    queryKey: ["employee-detail", employeeId, filters],
    queryFn:  () => apiFetch(`/analytics/employee/${employeeId}${buildQs(filters as any)}`),
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Call Report ──────────────────────────────────────────────
export type CallReportFilters = ReportFilters & { outcome?: string };

export function useCallReport(filters: CallReportFilters) {
  return useQuery<ApiResponse<CallReportResponse>>({
    queryKey: ["call-report", filters],
    queryFn:  () => apiFetch(`/analytics/calls${buildQs(filters as any)}`),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 30 * 1000,
  });
}

// ── Task Report ──────────────────────────────────────────────
export type TaskReportFilters = ReportFilters & {
  status?: string;
  overdue?: string;
  title?: string;
};

export function useTaskReport(filters: TaskReportFilters) {
  return useQuery<ApiResponse<TaskReportResponse>>({
    queryKey: ["task-report", filters],
    queryFn:  () => apiFetch(`/analytics/tasks${buildQs(filters as any)}`),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Duplicate Report ─────────────────────────────────────────
export function useDuplicateReport(branchId?: string) {
  return useQuery({
    queryKey: ["duplicate-report", branchId],
    queryFn:  () => apiFetch(`/analytics/duplicates${branchId ? `?branchId=${branchId}` : ""}`),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Conversion Report ────────────────────────────────────────
export function useConversionReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ["conversion-report", filters],
    queryFn:  () => apiFetch(`/analytics/conversions${buildQs(filters as any)}`),
    staleTime: 5 * 60 * 1000,
  });
}
