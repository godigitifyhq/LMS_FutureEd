import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import api from "@/lib/api";
import toast from "@/lib/toast";
import type {
  LeadStatus,
  LeadDetailResponse,
  LeadInteractionsResponse,
  ConfirmedApplicationResponse,
  ApiError,
} from "@lms/types";

// ── Lead detail ──
export function useLeadDetail(id: string) {
  return useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data } = await api.get<LeadDetailResponse>(`/leads/${id}`);
      return data.data;
    },
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

// ── Interactions ──
export function useLeadInteractions(leadId: string, type?: string) {
  return useQuery({
    queryKey: ["interactions", leadId, type],
    queryFn: async () => {
      const params = type ? `?type=${type}` : "";
      const { data } = await api.get<LeadInteractionsResponse>(
        `/leads/${leadId}/interactions${params}`,
      );
      return data.data;
    },
    enabled: !!leadId,
    refetchInterval: 30_000,
  });
}

// ── Add interaction ──
export function useAddInteraction(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      type: string;
      note?: string;
      callRecordingUrl?: string;
      callDurationSecs?: number;
    }) => {
      await api.post(`/leads/${leadId}/interactions`, body);
    },
    onSuccess: () => {
      toast.success("Interaction added");
      void qc.invalidateQueries({ queryKey: ["interactions", leadId] });
      void qc.invalidateQueries({ queryKey: ["lead", leadId] });
      void qc.invalidateQueries({ queryKey: ["campaign-work"] });
    },
    onError: (err) => toast.error({ title: "Failed to add interaction", message: describeUploadError(err) }),
  });
}

// ── Edit interaction ──
export function useEditInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      leadId: string;
      note: string;
    }) => {
      await api.patch(`/interactions/${params.id}`, { note: params.note });
    },
    onSuccess: (_, vars) => {
      toast.success("Note updated");
      void qc.invalidateQueries({ queryKey: ["interactions", vars.leadId] });
    },
    onError: () => toast.error("Failed to update note"),
  });
}

// ── Transition lead status ──
export function useTransitionLead(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      toStatus: LeadStatus;
      note?: string;
      sendEmailToStudent?: boolean;
      institutionName?: string;
      programName?: string;
      applicationNumber?: string;
    }) => {
      await api.post(`/leads/${leadId}/transition`, params);
    },
    onSuccess: () => {
      toast.success("Status updated");
      void qc.invalidateQueries({ queryKey: ["lead", leadId] });
      void qc.invalidateQueries({ queryKey: ["interactions", leadId] });
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err: unknown) => {
      const apiError = err as { response?: { data?: ApiError } };
      const message =
        apiError?.response?.data?.error?.message ?? "Invalid transition";
      toast.error(message);
    },
  });
}

// ── Update lead info ──
export function useUpdateLead(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      await api.patch(`/leads/${leadId}`, body);
    },
    onSuccess: () => {
      toast.success("Lead updated");
      void qc.invalidateQueries({ queryKey: ["lead", leadId] });
    },
    onError: () => toast.error("Failed to update lead"),
  });
}

// ── Assign lead ──
export function useAssignLeadDetail(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { assignedToId: string; reason?: string }) => {
      await api.post(`/leads/${leadId}/assign`, params);
    },
    onSuccess: () => {
      toast.success("Lead assigned");
      void qc.invalidateQueries({ queryKey: ["lead", leadId] });
      // The transfer shows up in the activity timeline
      void qc.invalidateQueries({ queryKey: ["interactions", leadId] });
    },
    onError: () => toast.error("Failed to assign"),
  });
}

// ── Upload file (recording or document) ──
export const UPLOAD_LIMITS_MB = { recording: 50, document: 10 } as const;

export function useUploadFile() {
  return useMutation({
    mutationFn: async (params: {
      file: File;
      type: "recording" | "document";
    }) => {
      const formData = new FormData();
      formData.append("file", params.file);
      // No manual Content-Type: the browser must set the multipart boundary.
      // A hand-set "multipart/form-data" header yields "Boundary not found".
      const { data } = await api.post<{
        success: true;
        data: { url: string; key: string };
      }>(`/upload/${params.type}`, formData, {
        timeout: 3 * 60_000, // large recordings on slow uplinks
      });
      return data.data;
    },
    onError: (err) => {
      toast.error({ title: "Upload failed", message: describeUploadError(err) });
    },
  });
}

// Turns any upload failure into a sentence the user can act on.
export function describeUploadError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.code === "ECONNABORTED") return "The upload timed out. Check your connection and try again.";
    if (!err.response) return "Network error — the file could not reach the server.";
    const status = err.response.status;
    const serverMsg = (err.response.data as { error?: { message?: string } } | undefined)?.error?.message;
    if (serverMsg) return serverMsg;
    if (status === 413) return "File is too large.";
    if (status === 401) return "Your session expired. Please log in again.";
    return `Server error (${status}). Please try again.`;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}

// ── Confirmed application ──
export function useConfirmedApplication(leadId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["confirmed", leadId],
    queryFn: async () => {
      try {
        const { data } = await api.get<ConfirmedApplicationResponse>(
          `/leads/${leadId}/confirmed`,
        );
        return data.data;
      } catch (error: any) {
        if (error?.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled,
  });
}

export function useUpdateConfirmedApplication(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      await api.patch(`/leads/${leadId}/confirmed`, body);
    },
    onSuccess: () => {
      toast.success("Application saved");
      void qc.invalidateQueries({ queryKey: ["confirmed", leadId] });
    },
    onError: () => toast.error("Failed to save"),
  });
}
