"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

type ApiResponse<T = unknown> = { success: true; data: T };

function buildQs(filters: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  return p.toString() ? `?${p.toString()}` : "";
}

// ── My Call Records (drill-through for the dashboard's call cards) ──
export type MyCallRow = {
  id: string;
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

export type MyCallsFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  scope?: "all" | "today";
};

export type MyCallsResponse = {
  rows: MyCallRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalDurationSecs: number;
};

export function useMyCalls(filters: MyCallsFilters) {
  return useQuery({
    queryKey: ["me", "calls", filters],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<MyCallsResponse>>(
        `/me/calls${buildQs(filters as Record<string, string | number | undefined>)}`,
      );
      return data.data;
    },
    staleTime: 30_000,
  });
}

// ── Total Leads Interacted (KPI card, scope: "all") and Today's Report
// "Interacted" tile (scope: "today") drill-through — any interaction type,
// not calls-only. See buildMyInteractionsWhere() on the backend. ──
export type MyInteractedLeadListRow = {
  leadId: string;
  leadName: string;
  leadPhone: string;
  status: string;
  interactionCount: number;
  lastInteractionAt: string;
};

export type MyInteractionsFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  scope?: "all" | "today";
};

export type MyInteractionsResponse = {
  rows: MyInteractedLeadListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function useMyInteractedLeads(filters: MyInteractionsFilters) {
  return useQuery({
    queryKey: ["me", "interactions", "leads", filters],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<MyInteractionsResponse>>(
        `/me/interactions/leads${buildQs(filters as Record<string, string | number | undefined>)}`,
      );
      return data.data;
    },
    staleTime: 30_000,
  });
}
