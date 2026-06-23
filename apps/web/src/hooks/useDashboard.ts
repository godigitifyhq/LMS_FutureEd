import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export type Period = "today" | "week" | "last30" | "last90" | "custom";
type ApiResponse<T = unknown> = { success: true; data: T };

// ── Dashboard overview ──
export function useDashboardOverview(period: Period, branchId?: string) {
  return useQuery({
    queryKey: ["analytics", "dashboard", period, branchId],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (branchId) params.set("branchId", branchId);
      const { data } = await api.get<ApiResponse>(
        `/analytics/dashboard?${params}`,
      );
      return data.data;
    },
    refetchInterval: 5 * 60_000, // 5 min
    staleTime: 3 * 60_000,
  });
}

// ── Employee performance ──
export function useEmployeePerformance(period: Period) {
  return useQuery({
    queryKey: ["analytics", "employees", period],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse>(
        `/analytics/employees?period=${period}`,
      );
      return data.data;
    },
    staleTime: 60_000, // 1 min — keeps data fresh across period switches
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
export function useSourceReport(period: Period) {
  return useQuery({
    queryKey: ["analytics", "sources", period],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse>(
        `/analytics/sources?period=${period}`,
      );
      return data.data;
    },
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
export function useTrend(period: Period) {
  return useQuery({
    queryKey: ["analytics", "trend", period],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse>(
        `/analytics/trend?period=${period}`,
      );
      return data.data;
    },
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
