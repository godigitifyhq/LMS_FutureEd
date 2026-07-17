"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Play, Phone, Search, Users } from "lucide-react";
import { useMyCalls, useMyInteractedLeads } from "@/hooks/useMyCalls";
import type { MyCallRow, MyInteractedLeadListRow } from "@/hooks/useMyCalls";
import { Pagination } from "@/components/ui/Pagination";
import { CustomDateRange } from "@/components/dashboard/CustomDateRange";
import { StatusBadge } from "@/components/leads/StatusBadge";
import { cn, formatDurationHMS } from "@/lib/utils";
import { getISTDateRange } from "@/lib/istDate";
import type { LeadStatus } from "@lms/types";

type Tab = "calls" | "interacted";

type CallPeriod = "all" | "today" | "yesterday" | "last30" | "custom";

const CALL_PERIOD_OPTIONS: Array<{ value: CallPeriod; label: string }> = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last30", label: "30 days" },
  { value: "custom", label: "Custom" },
];

export default function MyCallsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>(
    searchParams.get("tab") === "interacted" ? "interacted" : "calls",
  );
  // Defaults to "today". Dashboard cards deep-link with ?scope=all|today; an
  // explicit ?period wins over both.
  const [callPeriod, setCallPeriod] = useState<CallPeriod>(() => {
    const period = searchParams.get("period");
    if (period && CALL_PERIOD_OPTIONS.some((o) => o.value === period)) {
      return period as CallPeriod;
    }
    if (searchParams.get("scope") === "all") return "all";
    if (searchParams.get("dateFrom") ?? searchParams.get("dateTo")) return "custom";
    return "today";
  });
  // Interacted tab defaults to "today" — it backs the Today's Report tile
  const [interactedScope, setInteractedScope] = useState<"all" | "today">(
    searchParams.get("scope") === "all" ? "all" : "today",
  );
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [customFrom, setCustomFrom] = useState(searchParams.get("dateFrom") ?? "");
  const [customTo, setCustomTo] = useState(searchParams.get("dateTo") ?? "");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Resolve the active period into what the API takes: scope="today" pins the
  // range to the current IST day server-side, everything else is an explicit range.
  const scope: "all" | "today" = callPeriod === "today" ? "today" : "all";
  const { dateFrom, dateTo } =
    callPeriod === "custom"
      ? { dateFrom: customFrom, dateTo: customTo }
      : callPeriod === "yesterday" || callPeriod === "last30"
        ? getISTDateRange(callPeriod)
        : { dateFrom: "", dateTo: "" };

  // Debounce search input so we don't refetch on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 whenever a filter changes — adjusted during render
  // (not in an effect) per https://react.dev/learn/you-might-not-need-an-effect
  const filterKey = `${tab}|${callPeriod}|${interactedScope}|${debouncedSearch}|${dateFrom}|${dateTo}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  // Reflect state in the URL so cards deep-link correctly and refreshes persist
  useEffect(() => {
    const p = new URLSearchParams();
    if (tab !== "calls") p.set("tab", tab);
    if (tab === "calls") p.set("period", callPeriod);
    if (tab === "interacted" && interactedScope === "all") p.set("scope", "all");
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (tab === "calls" && callPeriod === "custom") {
      if (customFrom) p.set("dateFrom", customFrom);
      if (customTo) p.set("dateTo", customTo);
    }
    router.replace(`/my-calls?${p.toString()}`, { scroll: false });
  }, [tab, callPeriod, interactedScope, debouncedSearch, customFrom, customTo, router]);

  const callsQuery = useMyCalls({
    page,
    pageSize,
    scope,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(scope === "all" && dateFrom ? { dateFrom } : {}),
    ...(scope === "all" && dateTo ? { dateTo } : {}),
  });

  const interactedQuery = useMyInteractedLeads({
    page,
    pageSize,
    scope: interactedScope,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });

  const isInteractedTab = tab === "interacted";
  const { data: callsData, isLoading: callsLoading, isError: callsError, refetch: refetchCalls } = callsQuery;
  const { data: interactedData, isLoading: interactedLoading, isError: interactedError, refetch: refetchInteracted } = interactedQuery;

  const isLoading = isInteractedTab ? interactedLoading : callsLoading;
  const isError   = isInteractedTab ? interactedError   : callsError;
  const refetch    = isInteractedTab ? refetchInteracted : refetchCalls;

  const callRows: MyCallRow[] = callsData?.rows ?? [];
  const interactedRows: MyInteractedLeadListRow[] = interactedData?.rows ?? [];
  const total = isInteractedTab ? (interactedData?.total ?? 0) : (callsData?.total ?? 0);
  const totalPages = isInteractedTab ? (interactedData?.totalPages ?? 1) : (callsData?.totalPages ?? 1);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">My Call Records</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Every call you&apos;ve logged and every lead you&apos;ve interacted with.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center bg-surface-100 rounded-lg p-0.5 gap-0.5 w-fit">
        <button
          type="button"
          onClick={() => setTab("calls")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5",
            tab === "calls" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
          )}
        >
          <Phone size={12} /> Calls
        </button>
        <button
          type="button"
          onClick={() => setTab("interacted")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5",
            tab === "interacted" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
          )}
        >
          <Users size={12} /> Leads Interacted
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by lead name or phone"
            className="pl-8 pr-3 py-1.5 text-sm border border-surface-200 rounded-lg w-64 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {tab === "calls" && (
          <>
            <div className="flex items-center bg-surface-100 rounded-lg p-0.5 gap-0.5">
              {CALL_PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCallPeriod(opt.value)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                    callPeriod === opt.value
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {callPeriod === "custom" && (
              <CustomDateRange
                dateFrom={customFrom}
                dateTo={customTo}
                onFromChange={setCustomFrom}
                onToChange={setCustomTo}
              />
            )}
          </>
        )}

        {isInteractedTab && (
          <div className="flex items-center bg-surface-100 rounded-lg p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setInteractedScope("today")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                interactedScope === "today" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setInteractedScope("all")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                interactedScope === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
              )}
            >
              All Time
            </button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-3">
        <div className="bg-white border border-surface-200 rounded-xl px-4 py-3 w-fit">
          <p className="text-xs text-gray-400 mb-1">
            {isInteractedTab
              ? interactedScope === "today" ? "Interacted Today" : "Leads Interacted (All Time)"
              : callPeriod === "today" ? "Today's Calls" : "Total Calls"}
          </p>
          <p className="text-xl font-bold text-primary">{total}</p>
        </div>
        {!isInteractedTab && (
          <div className="bg-white border border-surface-200 rounded-xl px-4 py-3 w-fit">
            <p className="text-xs text-gray-400 mb-1">
              {callPeriod === "today" ? "Today's Minutes" : "Total Minutes"}
            </p>
            <p className="text-xl font-bold text-primary">
              {formatDurationHMS(callsData?.totalDurationSecs ?? 0)}
            </p>
          </div>
        )}
      </div>

      {isLoading && <TableSkeleton />}
      {isError && (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">Failed to load records.</p>
          <button type="button" onClick={() => refetch()} className="text-primary underline text-sm">Retry</button>
        </div>
      )}

      {!isLoading && !isError && isInteractedTab && interactedRows.length === 0 && (
        <EmptyState label="No leads interacted with in this period." />
      )}
      {!isLoading && !isError && !isInteractedTab && callRows.length === 0 && (
        <EmptyState label="No calls for this filter." />
      )}

      {!isLoading && !isError && isInteractedTab && interactedRows.length > 0 && (
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-150">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  {["Lead", "Phone", "Status", "Interactions", "Last Interaction"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {interactedRows.map((r) => (
                  <tr key={r.leadId} className="border-b border-surface-50 hover:bg-surface-50 transition-colors">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      <Link href={`/leads/${r.leadId}`} className="text-gray-800 hover:text-primary hover:underline">
                        {r.leadName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{r.leadPhone}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status as LeadStatus} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.interactionCount}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(r.lastInteractionAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && !isError && !isInteractedTab && callRows.length > 0 && (
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-150">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  {["Lead", "Phone", "Status", "Duration", "Recording", "Date"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {callRows.map((r) => (
                  <tr key={r.id} className="border-b border-surface-50 hover:bg-surface-50 transition-colors">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      <Link href={`/leads/${r.leadId}`} className="text-gray-800 hover:text-primary hover:underline">
                        {r.leadName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{r.leadPhone}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.leadStatus as LeadStatus} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.durationLabel}</td>
                    <td className="px-4 py-3">
                      {r.recordingUrl ? (
                        <a href={r.recordingUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                          <Play size={11} /> Play
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && !isError && total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-14 text-gray-400">
      <Phone size={32} className="mx-auto mb-2 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

const SKELETON_OPACITY = ["opacity-100", "opacity-90", "opacity-80", "opacity-60", "opacity-40", "opacity-20"] as const;

function TableSkeleton() {
  return (
    <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`h-12 border-b border-surface-50 animate-pulse bg-surface-50 ${SKELETON_OPACITY[i] ?? "opacity-10"}`} />
      ))}
    </div>
  );
}
