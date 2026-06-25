"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckSquare } from "lucide-react";
import { ReportShell } from "@/components/reports/ReportShell";
import { useTaskReport } from "@/hooks/useReports";
import type { TaskReportResponse, TaskReportRow } from "@/hooks/useReports";
import { useEmployeeList } from "@/hooks/useLeads";
import { cn } from "@/lib/utils";
import type { Period } from "@/hooks/useDashboard";

const STATUS_LABELS: Record<string, string> = {
  PENDING:     "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED:   "Completed",
  CANCELLED:   "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:     "bg-yellow-50 text-yellow-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  COMPLETED:   "bg-green-50 text-green-700",
  CANCELLED:   "bg-gray-100 text-gray-500",
};

export default function TasksPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [period,     setPeriod]     = useState<Period>((searchParams.get("period") as Period) ?? "last30");
  const [dateFrom,   setDateFrom]   = useState(searchParams.get("dateFrom") ?? "");
  const [dateTo,     setDateTo]     = useState(searchParams.get("dateTo") ?? "");
  const [employeeId] = useState(searchParams.get("employeeId") ?? "");
  const [status,     setStatus]     = useState(searchParams.get("status") ?? "");
  const [overdue]    = useState(searchParams.get("overdue") ?? "");
  const [title,      setTitle]      = useState(searchParams.get("title") ?? "");

  useEffect(() => {
    const p = new URLSearchParams();
    p.set("period", period);
    if (period === "custom" && dateFrom) p.set("dateFrom", dateFrom);
    if (period === "custom" && dateTo)   p.set("dateTo",   dateTo);
    if (employeeId) p.set("employeeId", employeeId);
    if (status) p.set("status", status);
    if (overdue) p.set("overdue", overdue);
    if (title) p.set("title", title);
    router.replace(`/analytics/tasks?${p.toString()}`, { scroll: false });
  }, [period, dateFrom, dateTo, employeeId, status, overdue, title]);

  const filters = {
    period,
    ...(period === "custom" && dateFrom ? { dateFrom } : {}),
    ...(period === "custom" && dateTo   ? { dateTo }   : {}),
    ...(employeeId ? { employeeId } : {}),
    ...(status ? { status } : {}),
    ...(overdue ? { overdue } : {}),
    ...(title ? { title } : {}),
  };

  const { data, isLoading, isError, refetch } = useTaskReport(filters);
  const { data: employees } = useEmployeeList();
  const payload: TaskReportResponse | undefined = data?.data;
  const rows: TaskReportRow[] = payload?.rows ?? [];
  const totals: TaskReportResponse["totals"] = payload?.totals ?? {
    total: 0,
    pending: 0,
    completed: 0,
    overdue: 0,
  };
  const resolved = payload?.period ?? null;

  return (
    <ReportShell
      title="Task Report"
      description="Track task completion and overdue items by employee."
      period={period}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onPeriodChange={setPeriod}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
      resolvedRange={resolved}
      csvExportPath="/analytics/export/csv/tasks"
      csvExportParams={{ period, ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}), ...(employeeId ? { employeeId } : {}), ...(status ? { status } : {}), ...(overdue ? { overdue } : {}), ...(title ? { title } : {}) }}
    >
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Filter by title"
          className="border border-surface-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary min-w-52"
        />
        <select
          value={employeeId}
          onChange={(e) => {
            const p = new URLSearchParams();
            p.set("period", period);
            if (period === "custom" && dateFrom) p.set("dateFrom", dateFrom);
            if (period === "custom" && dateTo) p.set("dateTo", dateTo);
            if (e.target.value) p.set("employeeId", e.target.value);
            if (status) p.set("status", status);
            if (overdue) p.set("overdue", overdue);
            if (title) p.set("title", title);
            router.replace(`/analytics/tasks?${p.toString()}`, { scroll: false });
          }}
          className="border border-surface-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Assignees</option>
          {employees?.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-surface-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SumCard label="Total"     value={totals.total     ?? 0} color="text-gray-700" />
        <SumCard label="Pending"   value={totals.pending   ?? 0} color="text-yellow-600" />
        <SumCard label="Completed" value={totals.completed ?? 0} color="text-green-600" />
        <SumCard label="Overdue"   value={totals.overdue   ?? 0} color={totals.overdue > 0 ? "text-red-600" : "text-gray-400"} />
      </div>
      <p className="text-xs text-gray-400">
        `Pending` means open tasks. `Overdue` means open tasks whose due time has passed.
      </p>

      {isLoading && <TaskTableSkeleton />}
      {isError && (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">Failed to load tasks.</p>
          <button type="button" onClick={() => refetch()} className="text-primary underline text-sm">Retry</button>
        </div>
      )}
      {!isLoading && !isError && rows.length === 0 && (
        <div className="text-center py-14 text-gray-400">
          <CheckSquare size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No tasks for this period / filter.</p>
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-162.5">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  {["Title", "Assignee", "Status", "Lead", "Due At", "Completed At", "Overdue"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={cn("border-b border-surface-50 hover:bg-surface-50", r.leadId && "cursor-pointer")}
                    onClick={() => {
                      if (r.leadId) router.push(`/leads/${r.leadId}`);
                    }}
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[200px] truncate">
                      {r.leadId ? (
                        <Link
                          href={`/leads/${r.leadId}`}
                          className="hover:text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.title}
                        </Link>
                      ) : (
                        r.title
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{r.assigneeName}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-600")}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {r.leadId ? (
                        <Link
                          href={`/leads/${r.leadId}`}
                          className="hover:text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.leadName ?? "—"}
                        </Link>
                      ) : (
                        <span>{r.leadName ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                      {r.dueAt ? fmtDate(r.dueAt) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                      {r.completedAt ? fmtDate(r.completedAt) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.isOverdue ? (
                        <span className="text-red-500 text-xs font-semibold">Yes</span>
                      ) : (
                        <span className="text-gray-400 text-xs">No</span>
                      )}
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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function SumCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border border-surface-200 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={cn("text-xl font-bold", color)}>{value}</p>
    </div>
  );
}

function TaskTableSkeleton() {
  return (
    <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-11 border-b border-surface-50 animate-pulse bg-surface-50" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}
