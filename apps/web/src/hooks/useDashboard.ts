import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export type Period = "today" | "yesterday" | "week" | "last30" | "last90" | "custom";
type ApiResponse<T = unknown> = { success: true; data: T };

// ── Dashboard overview ──
export function useDashboardOverview(
  period: Period,
  branchId?: string,
  dateFrom?: string,
  dateTo?: string,
) {
  return useQuery({
    queryKey: ["analytics", "dashboard", period, branchId, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (branchId) params.set("branchId", branchId);
      if (period === "custom" && dateFrom) params.set("dateFrom", dateFrom);
      if (period === "custom" && dateTo) params.set("dateTo", dateTo);
      const { data } = await api.get<ApiResponse>(
        `/analytics/dashboard?${params}`,
      );
      return data.data;
    },
    enabled: period !== "custom" || (!!dateFrom && !!dateTo),
    refetchInterval: 5 * 60_000, // 5 min
    staleTime: 3 * 60_000,
  });
}

// ── Employee performance ──
export function useEmployeePerformance(period: Period, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ["analytics", "employees", period, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (period === "custom" && dateFrom) params.set("dateFrom", dateFrom);
      if (period === "custom" && dateTo) params.set("dateTo", dateTo);
      const { data } = await api.get<ApiResponse>(`/analytics/employees?${params}`);
      return data.data;
    },
    enabled: period !== "custom" || (!!dateFrom && !!dateTo),
    staleTime: 60_000,
  });
}

// ── Pipeline ──
export function usePipeline(branchId?: string) {
  return useQuery({
    queryKey: ["analytics", "pipeline", branchId],
    queryFn: async () => {
      const params = branchId ? `?branchId=${branchId}` : "";
      const { data } = await api.get<ApiResponse>(
        `/analytics/pipeline${params}`,
      );
      return data.data;
    },
    staleTime: 5 * 60_000,
  });
}

// ── Lead sources ──
export function useSourceReport(period: Period, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ["analytics", "sources", period, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (period === "custom" && dateFrom) params.set("dateFrom", dateFrom);
      if (period === "custom" && dateTo) params.set("dateTo", dateTo);
      const { data } = await api.get<ApiResponse>(`/analytics/sources?${params}`);
      return data.data;
    },
    enabled: period !== "custom" || (!!dateFrom && !!dateTo),
    staleTime: 5 * 60_000,
  });
}

// ── Follow-up compliance (admin/sub-admin only) ──
export function useFollowUpCompliance(enabled = true) {
  return useQuery({
    queryKey: ["analytics", "follow-ups"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse>(`/analytics/follow-ups`);
      return data.data;
    },
    refetchInterval: 5 * 60_000,
    enabled,
  });
}

// ── Trend data ──
export function useTrend(period: Period, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ["analytics", "trend", period, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (period === "custom" && dateFrom) params.set("dateFrom", dateFrom);
      if (period === "custom" && dateTo) params.set("dateTo", dateTo);
      const { data } = await api.get<ApiResponse>(`/analytics/trend?${params}`);
      return data.data;
    },
    enabled: period !== "custom" || (!!dateFrom && !!dateTo),
    staleTime: 5 * 60_000,
  });
}

// ── Activity feed ──
export function useActivityFeed() {
  return useQuery({
    queryKey: ["activity"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse>(`/activity`);
      return data.data;
    },
    refetchInterval: 30_000, // 30 sec
  });
}

// ── Overdue follow-ups for employee ──
export function useMyOverdueLeads() {
  return useQuery({
    queryKey: ["leads", "overdue", "mine"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse>(`/leads/overdue`);
      return data.data;
    },
    refetchInterval: 5 * 60_000,
  });
}

// ── Combined overdue + upcoming follow-ups (all roles) ──
export function useMyFollowUps() {
  return useQuery({
    queryKey: ["leads", "followups"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse>(`/leads/followups`);
      return data.data;
    },
    refetchInterval: 5 * 60_000,
  });
}

// ── Employee call stats (today's calls, minutes, 7-day daily breakdown) ──
export type DailyCallStat = { date: string; callCount: number; totalMinutes: number };
export type MyCallStats = {
  callsToday: number;
  minutesToday: number;
  leadsInteractedToday: number;
  confirmedToday: number;
  newLeadsToday: number;
  daily: DailyCallStat[];
};

export function useMyCallStats() {
  return useQuery({
    queryKey: ["me", "call-stats"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<MyCallStats>>(`/me/call-stats`);
      return data.data as MyCallStats;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
