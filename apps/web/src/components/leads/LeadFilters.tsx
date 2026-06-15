"use client";

import { useQuery } from "@tanstack/react-query";
import { Search, X, SlidersHorizontal } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { LeadStatus, Role } from "@lms/types";
import { STATUS_CONFIG } from "@/config/leadStatus";
import type { LeadFilters } from "@/hooks/useLeads";
import { useState } from "react";
import { cn } from "@/lib/utils";

const YEAR_START = 2017;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - YEAR_START + 1 },
  (_, i) => CURRENT_YEAR - i,
);

type Props = {
  filters: LeadFilters;
  onChange: (filters: LeadFilters) => void;
  onReset: () => void;
};

export function LeadFilters({ filters, onChange, onReset }: Props) {
  const { user } = useAuthStore();
  const isManager = user?.role === Role.ADMIN || user?.role === Role.SUB_ADMIN;
  const [showMore, setShowMore] = useState(
    () => !!filters.assignedToId || !!filters.status || !!filters.sourceId,
  );

  const selectedYear = filters.dateFrom?.slice(0, 4) ?? "";

  function handleYearChange(year: string) {
    if (!year) {
      const { dateFrom: _df, dateTo: _dt, ...rest } = filters;
      onChange({ ...rest, page: 1 });
    } else {
      onChange({ ...filters, dateFrom: `${year}-01-01`, dateTo: `${year}-12-31`, page: 1 });
    }
  }

  // Fetch reference data
  const { data: sources } = useQuery({
    queryKey: ["lead-sources"],
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: string; name: string }>;
      }>("/settings/sources");
      return data.data;
    },
    staleTime: 60_000,
  });

  const { data: employees } = useQuery({
    queryKey: ["users", "employees"],
    queryFn: async () => {
      const { data } = await api.get<{
        data: { users: Array<{ id: string; name: string }> };
      }>("/users?role=EMPLOYEE&isActive=true");
      return data.data.users;
    },
    enabled: isManager,
    staleTime: 5 * 60_000,
  });

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== "" && v !== 1 && v !== 20,
  );

  return (
    <div className="bg-white border border-surface-200 rounded-xl p-4 space-y-3">
      {/* Search + toggle more filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={filters.search ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                onChange({
                  ...filters,
                  search: value,
                  page: 1,
                });
                return;
              }

              const { search: _search, ...rest } = filters;
              onChange({
                ...rest,
                page: 1,
              });
            }}
            placeholder="Search by name or phone..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary"
          />
        </div>

        <button
          onClick={() => setShowMore(!showMore)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
            showMore
              ? "border-primary text-primary bg-primary-50"
              : "border-surface-200 text-gray-600 hover:border-primary",
          )}
        >
          <SlidersHorizontal size={14} />
          <span className="hidden sm:inline">Filters</span>
          {hasActiveFilters && (
            <span className="w-1.5 h-1.5 bg-primary rounded-full" />
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 transition-colors"
          >
            <X size={14} />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>

      {/* Expanded filters */}
      {showMore && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-surface-100">
          {/* Status */}
          <select
            value={filters.status ?? ""}
            aria-label="Filter by status"
            title="Filter by status"
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                onChange({
                  ...filters,
                  status: value as LeadStatus,
                  page: 1,
                });
                return;
              }

              const { status: _status, ...rest } = filters;
              onChange({
                ...rest,
                page: 1,
              });
            }}
            className="px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>

          {/* Assigned to — managers only */}
          {isManager && employees && (
            <select
              value={filters.assignedToId ?? ""}
              aria-label="Filter by counsellor"
              title="Filter by counsellor"
              onChange={(e) => {
                const value = e.target.value;
                if (value) {
                  onChange({
                    ...filters,
                    assignedToId: value,
                    page: 1,
                  });
                  return;
                }

                const { assignedToId: _assignedToId, ...rest } = filters;
                onChange({
                  ...rest,
                  page: 1,
                });
              }}
              className="px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white"
            >
              <option value="">All Counsellors</option>
              <option value="unassigned">Unassigned</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          )}

          {/* Source */}
          {sources && (
            <select
              value={filters.sourceId ?? ""}
              aria-label="Filter by source"
              title="Filter by source"
              onChange={(e) => {
                const value = e.target.value;
                if (value) {
                  onChange({
                    ...filters,
                    sourceId: value,
                    page: 1,
                  });
                  return;
                }

                const { sourceId: _sourceId, ...rest } = filters;
                onChange({
                  ...rest,
                  page: 1,
                });
              }}
              className="px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white"
            >
              <option value="">All Sources</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          {/* Year quick filter */}
          <select
            value={selectedYear}
            aria-label="Filter by year"
            title="Filter by year"
            onChange={(e) => handleYearChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white"
          >
            <option value="">All Years</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>

          {/* Date from (custom range) */}
          {!selectedYear && (
            <input
              type="date"
              value={filters.dateFrom ?? ""}
              aria-label="Filter from date"
              title="Filter from date"
              onChange={(e) => {
                const value = e.target.value;
                if (value) { onChange({ ...filters, dateFrom: value, page: 1 }); return; }
                const { dateFrom: _dateFrom, ...rest } = filters;
                onChange({ ...rest, page: 1 });
              }}
              className="px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white"
            />
          )}
        </div>
      )}
    </div>
  );
}
