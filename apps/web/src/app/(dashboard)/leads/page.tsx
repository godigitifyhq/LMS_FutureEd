"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import {
  LayoutList,
  LayoutGrid,
  Plus,
  RefreshCw,
  CheckSquare,
  Users,
  ArrowRightLeft,
} from "lucide-react";
import { useLeadList, useEmployeeList } from "@/hooks/useLeads";
import { useQueryClient } from "@tanstack/react-query";
import { LeadFilters } from "@/components/leads/LeadFilters";
import { LeadCards } from "@/components/leads/LeadCards";
import { EmptyLeads } from "@/components/leads/EmptyLeads";
import { StatusBadge } from "@/components/leads/StatusBadge";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/store/auth";
import { useNotifications } from "@/store/notifications";
import { Role, LeadStatus } from "@lms/types";
import { STATUS_CONFIG } from "@/config/leadStatus";
import api from "@/lib/api";
import { extractApiError } from "@/lib/utils";
import type { LeadFilters as Filters, LeadSummary } from "@/hooks/useLeads";
import { cn } from "@/lib/utils";

const DEFAULT_FILTERS: Filters = {
  page: 1,
  pageSize: 20,
  sortBy: "createdAt",
  sortOrder: "desc",
};

export default function LeadsPage() {
  const { user } = useAuthStore();
  const { success, error } = useNotifications();
  const qc = useQueryClient();
  const isManager = user?.role === Role.ADMIN || user?.role === Role.SUB_ADMIN;

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  // Read URL params on mount to support dashboard deep-links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const patch: Partial<Filters> = {};
    const assignedToId = params.get("assignedToId");
    if (assignedToId) patch.assignedToId = assignedToId;
    const status = params.get("status") as LeadStatus | null;
    if (status) patch.status = status;
    const statuses = params.get("statuses");
    if (statuses) patch.statuses = statuses;
    const interactionType = params.get("interactionType");
    if (interactionType) patch.interactionType = interactionType;
    const interactedByUserId = params.get("interactedByUserId");
    if (interactedByUserId) patch.interactedByUserId = interactedByUserId;
    const dateFrom = params.get("dateFrom");
    if (dateFrom) patch.dateFrom = dateFrom;
    const dateTo = params.get("dateTo");
    if (dateTo) patch.dateTo = dateTo;
    const overdue = params.get("overdue");
    if (overdue === "true") patch.overdue = true;
    if (Object.keys(patch).length > 0) setFilters((prev) => ({ ...prev, ...patch }));
  }, []);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignModal, setBulkAssignModal] = useState(false);
  const [bulkStatusModal, setBulkStatusModal] = useState(false);
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [bulkStatus, setBulkStatus] = useState<LeadStatus | "">("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const { data, isLoading, isFetching, refetch } = useLeadList(filters);
  const { data: employees } = useEmployeeList();

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data) return;
    if (selected.size === data.leads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.leads.map((l) => l.id)));
    }
  }

  async function handleBulkAssign() {
    if (!bulkAssignee || selected.size === 0) return;
    setBulkLoading(true);
    try {
      await api.post("/leads/bulk-assign", {
        leadIds: Array.from(selected),
        assignedToId: bulkAssignee,
        reason: "Bulk assignment",
      });
      success(`${selected.size} leads assigned successfully`);
      setSelected(new Set());
      setBulkAssignModal(false);
      setBulkAssignee("");
      void qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (e) {
      error("Bulk assign failed", extractApiError(e));
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkStatus() {
    if (!bulkStatus || selected.size === 0) return;
    setBulkLoading(true);
    try {
      const { data: res } = await api.post("/leads/bulk-status", {
        leadIds: Array.from(selected),
        toStatus: bulkStatus,
      });
      const { successful, failed } = res.data;
      success(
        `${successful} leads updated. ${failed.length} skipped (invalid transition).`,
      );
      setSelected(new Set());
      setBulkStatusModal(false);
      setBulkStatus("");
      void qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (e) {
      error("Bulk status failed", extractApiError(e));
    } finally {
      setBulkLoading(false);
    }
  }

  const hasFilters = Object.entries(filters).some(
    ([k, v]) =>
      !["page", "pageSize", "sortBy", "sortOrder"].includes(k) &&
      v !== undefined &&
      v !== "",
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data ? `${data.total} total leads` : "Loading..."}
            {isFetching && !isLoading && (
              <span className="ml-2 text-xs text-gray-400">
                · Refreshing...
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="p-2 rounded-lg border border-surface-200 text-gray-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
            aria-label="Refresh leads"
            title="Refresh leads"
          >
            <RefreshCw size={15} className={cn(isFetching && "animate-spin")} />
          </button>
          <div className="hidden md:flex items-center border border-surface-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "table"
                  ? "bg-primary text-white"
                  : "text-gray-500 hover:bg-surface-50",
              )}
              aria-label="Table view"
              title="Table view"
            >
              <LayoutList size={15} />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "cards"
                  ? "bg-primary text-white"
                  : "text-gray-500 hover:bg-surface-50",
              )}
              aria-label="Card view"
              title="Card view"
            >
              <LayoutGrid size={15} />
            </button>
          </div>
          <Link href="/leads/new">
            <Button>
              <Plus size={15} />
              <span className="hidden sm:inline">Add Lead</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Bulk action bar — shows when items selected */}
      {isManager && selected.size > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckSquare size={15} className="text-primary" />
            <span className="text-sm font-semibold text-primary">
              {selected.size} lead{selected.size > 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setBulkAssignModal(true)}
            >
              <Users size={13} /> Bulk Assign
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setBulkStatusModal(true)}
            >
              <ArrowRightLeft size={13} /> Bulk Status
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <LeadFilters
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-14 bg-surface-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : !data || data.leads.length === 0 ? (
        <EmptyLeads
          hasFilters={hasFilters}
          onClearFilters={() => setFilters(DEFAULT_FILTERS)}
        />
      ) : (
        <>
          {/* Mobile — always cards */}
          <div className="md:hidden">
            {isManager && selected.size === 0 && (
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-xs text-gray-400">
                  Tap cards to select for bulk actions
                </p>
                <button
                  onClick={() =>
                    setSelected(new Set(data.leads.map((l) => l.id)))
                  }
                  className="text-xs text-primary font-medium"
                >
                  Select all
                </button>
              </div>
            )}
            <LeadCards
              leads={data.leads}
              selected={selected}
              onToggle={toggleSelect}
              showBulkSelect={isManager}
            />
          </div>

          {/* Desktop — table with checkboxes or cards */}
          <div className="hidden md:block">
            {viewMode === "table" ? (
              <LeadTableWithBulk
                leads={data.leads}
                selected={selected}
                onToggle={toggleSelect}
                onToggleAll={toggleSelectAll}
                isManager={isManager}
              />
            ) : (
              <LeadCards leads={data.leads} />
            )}
          </div>

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.pageSize}
            onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
            onPageSizeChange={(s) =>
              setFilters((prev) => ({ ...prev, pageSize: s, page: 1 }))
            }
          />
        </>
      )}

      {/* Bulk Assign Modal */}
      <Modal
        open={bulkAssignModal}
        onClose={() => setBulkAssignModal(false)}
        title="Bulk Assign Leads"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setBulkAssignModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleBulkAssign()}
              loading={bulkLoading}
              disabled={!bulkAssignee}
            >
              Assign {selected.size} Leads
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Assign <strong>{selected.size} selected leads</strong> to:
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {employees?.map((emp) => (
              <button
                key={emp.id}
                onClick={() => setBulkAssignee(emp.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                  bulkAssignee === emp.id
                    ? "border-primary bg-primary-50"
                    : "border-surface-200 hover:border-primary-300",
                )}
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">
                    {emp.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {emp.name}
                </span>
                {bulkAssignee === emp.id && (
                  <span className="ml-auto text-primary text-xs">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Bulk Status Modal */}
      <Modal
        open={bulkStatusModal}
        onClose={() => setBulkStatusModal(false)}
        title="Bulk Change Status"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setBulkStatusModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleBulkStatus()}
              loading={bulkLoading}
              disabled={!bulkStatus}
            >
              Update {selected.size} Leads
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Change status of <strong>{selected.size} leads</strong> to:
          </p>
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠ Leads with invalid transitions will be skipped automatically.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
              <button
                key={status}
                onClick={() => setBulkStatus(status as LeadStatus)}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors text-sm",
                  bulkStatus === status
                    ? "border-primary bg-primary-50"
                    : "border-surface-200 hover:border-primary-300",
                )}
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    config.dot,
                  )}
                />
                <span className="text-xs font-medium text-gray-700 truncate">
                  {config.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Lead table with bulk select checkboxes
function LeadTableWithBulk({
  leads,
  selected,
  onToggle,
  onToggleAll,
  isManager,
}: {
  leads: LeadSummary[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  isManager: boolean;
}) {
  // Import these from the existing LeadTable — we extend it with checkboxes
  const allSelected = leads.length > 0 && selected.size === leads.length;

  return (
    <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50">
              {isManager && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    className="accent-primary w-4 h-4 cursor-pointer"
                    aria-label="Select all leads on this page"
                    title="Select all leads on this page"
                  />
                </th>
              )}
              {/* Re-use existing column headers from LeadTable */}
              {[
                "Student",
                "Status",
                "Course",
                ...(isManager ? ["Counsellor"] : []),
                "Follow-up",
                "Added",
                "Actions",
              ].map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {leads.map((lead) => {
              const isOverdue =
                lead.nextFollowUpAt &&
                new Date(lead.nextFollowUpAt) < new Date();
              const primaryCourse = lead.courses.find(
                (course) => course.isPrimary,
              );

              return (
                <tr
                  key={lead.id}
                  className={cn(
                    "hover:bg-surface-50",
                    selected.has(lead.id) && "bg-primary-50",
                  )}
                >
                  {isManager && (
                    <td className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={() => onToggle(lead.id)}
                        className="accent-primary w-4 h-4 cursor-pointer"
                        aria-label={`Select lead ${lead.studentName}`}
                        title={`Select lead ${lead.studentName}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <a href={`/leads/${lead.id}`}>
                      <p className="text-sm font-semibold text-gray-900 hover:text-primary">
                        {lead.studentName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {lead.phone}
                      </p>
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {primaryCourse?.course.name ?? "—"}
                  </td>
                  {isManager && (
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {lead.assignedTo?.name ?? (
                        <span className="text-amber-600 font-medium">
                          Unassigned
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {lead.nextFollowUpAt ? (
                      <span
                        className={cn(
                          "text-xs font-medium",
                          isOverdue ? "text-red-600" : "text-gray-600",
                        )}
                      >
                        {isOverdue && "⚠ "}
                        {dayjs(lead.nextFollowUpAt).fromNow()}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {dayjs(lead.createdAt).fromNow()}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`tel:${lead.phone}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary-50 transition-colors inline-block"
                      aria-label={`Call ${lead.studentName}`}
                      title={`Call ${lead.studentName}`}
                    >
                      📞
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
