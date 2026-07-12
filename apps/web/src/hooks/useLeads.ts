import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Role } from "@lms/types";
import type { LeadStatus } from "@lms/types";
import { useAuthStore } from "@/store/auth";
import toast from "react-hot-toast";

export type LeadSummary = {
  id: string;
  studentName: string;
  phone: string;
  email: string | null;
  status: LeadStatus;
  nextFollowUpAt: string | null;
  createdAt: string;
  isDuplicate: boolean;
  source: { id: string; name: string } | null;
  assignedTo: { id: string; name: string; email: string; role: Role } | null;
  createdBy: { id: string; name: string };
  courses: Array<{ isPrimary: boolean; course: { id: string; name: string } }>;
};

export type LeadListResponse = {
  leads: LeadSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type LeadFilters = {
  page?: number;
  pageSize?: number;
  status?: LeadStatus;
  statuses?: string;            // comma-separated e.g. "ATTEMPTED_CONTACT,CONNECTED"
  interactionType?: string;     // e.g. "CALL" — leads with at least one of this type (any user)
  interactedByUserId?: string; // leads where this specific user logged any interaction
  assignedToId?: string;
  courseId?: string;
  sourceId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  overdue?: boolean;
  showAllStatuses?: boolean;   // bypass ALL status exclusion (Total Leads card)
  excludeTerminal?: boolean;   // exclude only CONFIRMED/DUPLICATE/LOST — matches dashboard active count
  excludeUnassigned?: boolean; // only leads that have an assignee — leaderboard "Assigned" drill-throughs
  upcoming?: boolean;          // show leads with follow-up due in next 7 days
  interactedByOwner?: boolean; // leads whose current assignee logged an interaction on them — Employee Performance "Leads Interacted" drill-through
};

// ── Lead list with auto-refresh ──
export function useLeadList(filters: LeadFilters) {
  return useQuery({
    queryKey: ["leads", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== "") params.set(k, String(v));
      });
      const { data } = await api.get<{ success: true; data: LeadListResponse }>(
        `/leads?${params.toString()}`,
      );
      return data.data;
    },
    refetchInterval: 30_000, // auto-refresh every 30 seconds
  });
}

// ── Quick assign ──
export function useAssignLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      leadId: string;
      assignedToId: string;
      reason?: string;
    }) => {
      await api.post(`/leads/${params.leadId}/assign`, {
        assignedToId: params.assignedToId,
        reason: params.reason,
      });
    },
    onSuccess: () => {
      toast.success("Lead assigned successfully");
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Failed to assign lead"),
  });
}

// ── Quick interaction (note) ──
export function useAddInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      leadId: string;
      type: string;
      note: string;
    }) => {
      await api.post(`/leads/${params.leadId}/interactions`, {
        type: params.type,
        note: params.note,
      });
    },
    onSuccess: () => {
      toast.success("Note added");
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Failed to add note"),
  });
}

// ── Mark follow-up done ──
export function useMarkFollowUpDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { leadId: string }) => {
      await api.patch(`/leads/${params.leadId}`, { nextFollowUpAt: null });
      await api.post(`/leads/${params.leadId}/interactions`, {
        type: "NOTE",
        note: "Follow-up completed",
      });
    },
    onSuccess: () => {
      toast.success("Follow-up marked as done");
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Failed to update"),
  });
}

// ── Fetch employees for assign dropdown ──
export function useEmployeeList() {
  return useQuery({
    queryKey: ["users", "employees"],
    queryFn: async () => {
      const { data } = await api.get<{
        success: true;
        data: { users: Array<{ id: string; name: string; role: string }> };
      }>("/users?role=EMPLOYEE&isActive=true");
      return data.data.users;
    },
    staleTime: 5 * 60_000,
  });
}

// ── Fetch all staff (employees + admin/sub-admin) for analytics filters ──
export function useStaffList() {
  return useQuery({
    queryKey: ["users", "staff"],
    queryFn: async () => {
      const { data } = await api.get<{
        success: true;
        data: { users: Array<{ id: string; name: string; role: string }> };
      }>("/users?isActive=true");
      return data.data.users;
    },
    staleTime: 5 * 60_000,
  });
}

// ── Fetch users eligible as an assign-lead target for the current actor ──
// Admins may assign leads to Admins, Sub Admins, or Employees.
// Sub Admins may only assign leads to Employees.
export function useAssignableUsers() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === Role.ADMIN;
  return useQuery({
    queryKey: ["users", "assignable", isAdmin],
    queryFn: async () => {
      const qs = isAdmin ? "isActive=true" : "role=EMPLOYEE&isActive=true";
      const { data } = await api.get<{
        success: true;
        data: { users: Array<{ id: string; name: string; role: string }> };
      }>(`/users?${qs}`);
      return data.data.users;
    },
    staleTime: 5 * 60_000,
  });
}

// ── Get single lead ──
export type Lead = LeadSummary & {
  dobDay: number;
  dobMonth: number;
  dobYear: number;
  fatherName: string;
  qualification: string;
  schoolCollege: string;
  board: string;
  passingYear: number;
  marksPercentage: number;
  address: string;
  alternatePhone: string;
  whatsappPhone: string;
  otherSource?: string;
  courses: Array<{ isPrimary: boolean; course: { id: string; name: string } }>;
  duplicateOf?: { id: string; studentName: string };
};

export function useLead(leadId: string | null | undefined) {
  return useQuery({
    queryKey: ["leads", leadId],
    queryFn: async () => {
      if (!leadId) throw new Error("Lead ID is required");
      const { data } = await api.get<{ success: true; data: Lead }>(
        `/leads/${leadId}`,
      );
      return data.data;
    },
    enabled: !!leadId,
  });
}

// ── Create lead ──
export type CreateLeadParams = {
  studentName: string;
  phone: string;
  dobDay: number;
  dobMonth: number;
  dobYear: number;
  fatherName: string;
  courseIds: string[];
  sourceId: string;
  otherSource?: string;
  qualification?: string;
  schoolCollege?: string;
  board?: string;
  passingYear?: number;
  marksPercentage?: number;
  address?: string;
  alternatePhone?: string;
  whatsappPhone?: string;
  email?: string;
  nextFollowUpAt?: string | null;
  sendEmail?: boolean;
};

export type CreateLeadResponse = {
  lead: Lead;
  status: "CREATED" | "DUPLICATE_REDIRECTED" | "REVIVAL_CONFIRMATION";
  message?: string;
  existingLeadId?: string;
};

export function useCreateLead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateLeadParams) => {
      const { data } = await api.post<{
        success: true;
        data: CreateLeadResponse;
      }>("/leads", params);
      return data.data;
    },
    onSuccess: () => {
      toast.success("Lead created successfully");
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error) => {
      toast.error("Failed to create lead");
      console.error(error);
    },
  });
}

// ── Update lead ──
export function useUpdateLead(leadId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: Partial<CreateLeadParams>) => {
      const { data } = await api.patch<{ success: true; data: Lead }>(
        `/leads/${leadId}`,
        params,
      );
      return data.data;
    },
    onSuccess: () => {
      toast.success("Lead updated successfully");
      void qc.invalidateQueries({ queryKey: ["leads"] });
      // Lead detail page fetches under the "lead" (singular) key — "leads" doesn't prefix-match it.
      void qc.invalidateQueries({ queryKey: ["lead", leadId] });
    },
    onError: (error) => {
      toast.error("Failed to update lead");
      console.error(error);
    },
  });
}

// ── Transition lead status ──
export function useTransitionLead(leadId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { newStatus: LeadStatus; note?: string }) => {
      const { data } = await api.post<{ success: true; data: Lead }>(
        `/leads/${leadId}/transition`,
        params,
      );
      return data.data;
    },
    onSuccess: () => {
      toast.success("Lead status updated");
      void qc.invalidateQueries({ queryKey: ["leads"] });
      void qc.invalidateQueries({ queryKey: ["leads", leadId] });
    },
    onError: (error) => {
      toast.error("Failed to update lead status");
      console.error(error);
    },
  });
}

// ── Bulk assign leads ──
export function useBulkAssign() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      leadIds: string[];
      assignedToId: string;
      reason?: string;
    }) => {
      await api.post("/leads/bulk-assign", params);
    },
    onSuccess: () => {
      toast.success("Leads assigned successfully");
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error) => {
      toast.error("Failed to assign leads");
      console.error(error);
    },
  });
}

// ── Bulk update lead status ──
export function useBulkStatusUpdate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      leadIds: string[];
      newStatus: LeadStatus;
      note?: string;
    }) => {
      await api.post("/leads/bulk-status", params);
    },
    onSuccess: () => {
      toast.success("Leads updated successfully");
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error) => {
      toast.error("Failed to update leads");
      console.error(error);
    },
  });
}

// ── Get unassigned leads ──
export function useUnassignedLeads() {
  return useQuery({
    queryKey: ["leads", "unassigned"],
    queryFn: async () => {
      const { data } = await api.get<{ success: true; data: LeadListResponse }>(
        "/leads/unassigned",
      );
      return data.data;
    },
  });
}

// ── Get overdue leads ──
export function useOverdueLeads() {
  return useQuery({
    queryKey: ["leads", "overdue"],
    queryFn: async () => {
      const { data } = await api.get<{ success: true; data: LeadListResponse }>(
        "/leads/overdue",
      );
      return data.data;
    },
  });
}
