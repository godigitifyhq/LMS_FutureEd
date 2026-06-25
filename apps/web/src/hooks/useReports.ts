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
  return useQuery({
    queryKey: ["leaderboard", filters],
    queryFn:  () => apiFetch(`/analytics/leaderboard${buildQs(filters as any)}`),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

// ── Employee Detail ──────────────────────────────────────────
export function useEmployeeDetail(employeeId: string, filters: ReportFilters) {
  return useQuery({
    queryKey: ["employee-detail", employeeId, filters],
    queryFn:  () => apiFetch(`/analytics/employee/${employeeId}${buildQs(filters as any)}`),
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Call Report ──────────────────────────────────────────────
export type CallReportFilters = ReportFilters & { outcome?: string };

export function useCallReport(filters: CallReportFilters) {
  return useQuery({
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
  return useQuery({
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
