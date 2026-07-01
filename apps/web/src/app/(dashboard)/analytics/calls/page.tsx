"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Play, Phone } from "lucide-react";
import { ReportShell } from "@/components/reports/ReportShell";
import { useCallReport } from "@/hooks/useReports";
import { useStaffList } from "@/hooks/useLeads";
import type { CallReportResponse, CallReportRow } from "@/hooks/useReports";
import { cn } from "@/lib/utils";
import type { Period } from "@/hooks/useDashboard";

const OUTCOME_COLORS: Record<string, string> = {
  CONNECTED:    "bg-green-50 text-green-700",
  NO_ANSWER:    "bg-yellow-50 text-yellow-700",
  BUSY:         "bg-orange-50 text-orange-700",
  REJECTED:     "bg-red-50 text-red-700",
  WRONG_NUMBER: "bg-gray-100 text-gray-600",
};

const OUTCOME_LABELS: Record<string, string> = {
  CONNECTED:    "Connected",
  NO_ANSWER:    "No Answer",
  BUSY:         "Busy",
  REJECTED:     "Rejected",
  WRONG_NUMBER: "Wrong Number",
};

export default function CallsPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [period,     setPeriod]     = useState<Period>((searchParams.get("period") as Period) ?? "last30");
  const [dateFrom,   setDateFrom]   = useState(searchParams.get("dateFrom") ?? "");
  const [dateTo,     setDateTo]     = useState(searchParams.get("dateTo") ?? "");
  const [employeeId, setEmployeeId] = useState(searchParams.get("employeeId") ?? "");

  useEffect(() => {
    const p = new URLSearchParams();
    p.set("period", period);
    if (period === "custom" && dateFrom) p.set("dateFrom", dateFrom);
    if (period === "custom" && dateTo)   p.set("dateTo",   dateTo);
    if (employeeId) p.set("employeeId", employeeId);
    router.replace(`/analytics/calls?${p.toString()}`, { scroll: false });
  }, [period, dateFrom, dateTo, employeeId]);

  const filters = {
    period,
    ...(period === "custom" && dateFrom ? { dateFrom } : {}),
    ...(period === "custom" && dateTo   ? { dateTo }   : {}),
    ...(employeeId ? { employeeId } : {}),
  };

  const { data, isLoading, isError, refetch } = useCallReport(filters);
  const { data: staffData } = useStaffList();
  const payload: CallReportResponse | undefined = data?.data;
  const rows: CallReportRow[] = payload?.rows ?? [];
  const totals: CallReportResponse["totals"] = payload?.totals ?? {
    calls: 0,
    connectedCalls: 0,
    totalMinutes: 0,
  };
  const resolved = payload?.period ?? null;

  return (
    <ReportShell
      title="Call Report"
      description="All calls logged by employees. Filter by employee and date."
      period={period}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onPeriodChange={setPeriod}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
      resolvedRange={resolved}
      csvExportPath="/analytics/export/csv/calls"
      csvExportParams={{ period, ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}), ...(employeeId ? { employeeId } : {}) }}
    >
      {/* Employee filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <label htmlFor="employee-filter" className="sr-only">Filter by employee</label>
        <select
          id="employee-filter"
          aria-label="Filter by employee"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="border border-surface-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Employees</option>
          {staffData?.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <SumCard label="Total Calls"    value={totals.calls          ?? 0} color="text-blue-600" />
        <SumCard label="Connected"      value={totals.connectedCalls ?? 0} color="text-green-600" />
        <SumCard label="Total Minutes"  value={`${totals.totalMinutes ?? 0}m`} color="text-orange-500" />
      </div>

      {isLoading && <CallTableSkeleton />}
      {isError && (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">Failed to load calls.</p>
          <button type="button" onClick={() => refetch()} className="text-primary underline text-sm">Retry</button>
        </div>
      )}
      {!isLoading && !isError && rows.length === 0 && (
        <div className="text-center py-14 text-gray-400">
          <Phone size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No calls for this period / filter.</p>
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-175">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  {["Employee", "Lead", "Phone", "Outcome", "Direction", "Duration", "Recording", "Date"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-surface-50 hover:bg-surface-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{r.employeeName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.leadId ? (
                        <Link href={`/leads/${r.leadId}`} className="text-gray-700 hover:text-primary hover:underline">
                          {r.leadName}
                        </Link>
                      ) : (
                        <span className="text-gray-700">{r.leadName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{r.leadPhone}</td>
                    <td className="px-4 py-3">
                      {r.outcome ? (
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", OUTCOME_COLORS[r.outcome] ?? "bg-gray-100 text-gray-600")}>
                          {OUTCOME_LABELS[r.outcome] ?? r.outcome}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.direction ?? "—"}</td>
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
    </ReportShell>
  );
}

function SumCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border border-surface-200 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={cn("text-xl font-bold", color)}>{value}</p>
    </div>
  );
}

const SKELETON_OPACITY = ["opacity-100", "opacity-90", "opacity-80", "opacity-60", "opacity-40", "opacity-20"] as const;

function CallTableSkeleton() {
  return (
    <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`h-12 border-b border-surface-50 animate-pulse bg-surface-50 ${SKELETON_OPACITY[i] ?? "opacity-10"}`} />
      ))}
    </div>
  );
}
