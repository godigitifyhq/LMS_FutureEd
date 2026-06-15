import { useQuery, useMutation } from "@tanstack/react-query";
import api from "@/lib/api";
import toast from "react-hot-toast";

// ── Status ────────────────────────────────────────────────────────────────

export type MetaStatus = {
  leadForms: { configured: boolean; pageConnected: boolean };
  whatsapp: { configured: boolean; wabaConnected: boolean; autoReplyEnabled: boolean };
  webhook: { verifyTokenSet: boolean; appSecretSet: boolean };
};

export function useMetaStatus() {
  return useQuery<MetaStatus>({
    queryKey: ["meta", "status"],
    queryFn: async () => {
      const { data } = await api.get<{ success: true; data: MetaStatus }>(
        "/meta/status",
      );
      return data.data;
    },
    staleTime: 30_000,
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────

export type MetaStatsPeriod = {
  leadForm: number;
  whatsapp: number;
  total: number;
};

export type MetaRecentLead = {
  id: string;
  studentName: string;
  phone: string;
  status: string;
  createdAt: string;
  isFromWhatsApp: boolean;
  metaAdName: string | null;
  assignedTo: { id: string; name: string } | null;
};

export type MetaStats = {
  today: MetaStatsPeriod;
  thisWeek: MetaStatsPeriod;
  thisMonth: MetaStatsPeriod;
  recentLeads: MetaRecentLead[];
};

export function useMetaStats() {
  return useQuery<MetaStats>({
    queryKey: ["meta", "stats"],
    queryFn: async () => {
      const { data } = await api.get<{ success: true; data: MetaStats }>(
        "/meta/stats",
      );
      return data.data;
    },
    refetchInterval: 60_000,
  });
}

// ── Manual sync ───────────────────────────────────────────────────────────

export type SyncResult = {
  total: number;
  created: number;
  duplicates: number;
  skipped: number;
};

export function useSyncMetaForm() {
  return useMutation({
    mutationFn: async (params: { formId: string; since?: string }) => {
      const { data } = await api.post<{ success: true; data: SyncResult }>(
        "/meta/sync-form",
        params,
      );
      return data.data;
    },
    onSuccess: (result) => {
      toast.success(
        `Sync complete — ${result.created} created, ${result.duplicates} duplicates`,
      );
    },
    onError: () => toast.error("Sync failed"),
  });
}

// ── Test WhatsApp lead ────────────────────────────────────────────────────

export function useTestWhatsAppLead() {
  return useMutation({
    mutationFn: async (params: {
      studentName?: string;
      phone?: string;
      message?: string;
      courseName?: string;
    }) => {
      const { data } = await api.post<{
        success: true;
        data: { created?: boolean; leadId?: string; duplicate?: boolean; existingLeadId?: string; skipped?: boolean; reason?: string };
      }>("/meta/test-whatsapp-lead", params);
      return data.data;
    },
    onSuccess: (result) => {
      if (result.created) toast.success(`Test lead created — ID: ${result.leadId}`);
      else if (result.duplicate) toast.success(`Duplicate detected — existing lead: ${result.existingLeadId}`);
      else toast.success(`Skipped: ${result.reason}`);
    },
    onError: () => toast.error("Test lead creation failed"),
  });
}
