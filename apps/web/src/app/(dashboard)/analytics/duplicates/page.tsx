"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy } from "lucide-react";
import { ReportShell } from "@/components/reports/ReportShell";
import { useDuplicateReport } from "@/hooks/useReports";
import { useStaffList } from "@/hooks/useLeads";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import toast from "react-hot-toast";

const STATUS_COLORS: Record<string, string> = {
  NEW:                "bg-blue-50 text-blue-700",
  ATTEMPTED_CONTACT:  "bg-orange-50 text-orange-700",
  CONNECTED:          "bg-teal-50 text-teal-700",
  INTERESTED:         "bg-indigo-50 text-indigo-700",
  FOLLOW_UP_SCHEDULED:"bg-purple-50 text-purple-700",
  APPLICATION_SENT:   "bg-cyan-50 text-cyan-700",
  UNDER_VALIDATION:   "bg-yellow-50 text-yellow-700",
  CONFIRMED:          "bg-green-50 text-green-700",
  LOST:               "bg-red-50 text-red-700",
  NOT_INTERESTED:     "bg-gray-100 text-gray-600",
  NOT_REACHABLE:      "bg-rose-50 text-rose-600",
  DUPLICATE:          "bg-orange-50 text-orange-700",
};

export default function DuplicatesPage() {
  const [employeeId, setEmployeeId] = useState("");
  const { data, isLoading, isError, refetch } = useDuplicateReport();
  const { data: staffData } = useStaffList();

  const allRows: any[] = (data as any)?.data?.rows ?? [];
  const total          = (data as any)?.data?.total ?? 0;

  // Client-side employee filter
  const rows = employeeId
    ? allRows.filter((r: any) => r.assigneeId === employeeId)
    : allRows;

  const [markingId, setMarkingId] = useState<string | null>(null);

  async function handleMarkDuplicate(id: string, originalId?: string) {
    const confirmed = window.confirm(
      "Mark this lead as a duplicate? It will be soft-linked to the original and its status set to DUPLICATE.",
    );
    if (!confirmed) return;

    setMarkingId(id);
    try {
      await api.post(`/analytics/duplicate/${id}/mark`, { originalId });
      toast.success("Lead marked as duplicate");
      void refetch();
    } catch {
      toast.error("Failed to mark duplicate");
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <ReportShell
      title="Duplicate Lead Report"
      description="Leads detected as duplicates based on matching phone or email."
      period="today"
      onPeriodChange={() => {}}
      csvExportPath="/analytics/export/csv/duplicates"
    >
      {/* Summary + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-white border border-surface-200 rounded-xl px-4 py-3">
          <Copy size={16} className="text-orange-500" />
          <span className="text-sm font-semibold text-gray-700">
            {total} duplicate leads detected
            {employeeId && rows.length !== total ? ` · ${rows.length} shown for this employee` : ""}
          </span>
        </div>
        <select
          aria-label="Filter by employee"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="border border-surface-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Employees</option>
          {staffData?.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
          {(["opacity-100","opacity-80","opacity-60","opacity-40","opacity-20"] as const).map((op, i) => (
            <div key={i} className={`h-12 border-b border-surface-50 animate-pulse bg-surface-50 ${op}`} />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">Failed to load duplicates.</p>
          <button type="button" onClick={() => refetch()} className="text-primary underline text-sm">Retry</button>
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <div className="text-center py-14 text-gray-400">
          <Copy size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">{allRows.length === 0 ? "No duplicate leads found. ✨" : "No duplicates for this employee."}</p>
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-187.5">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  {["Duplicate Lead", "Phone", "Lead Status", "Original Lead", "Assigned To", "Created", "Action"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.duplicateId} className="border-b border-surface-50 hover:bg-surface-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/leads/${r.duplicateId}`} className="font-medium text-gray-800 hover:text-primary hover:underline">
                        {r.duplicateName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{r.duplicatePhone}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[r.duplicateStatus] ?? "bg-gray-100 text-gray-600")}>
                        {r.duplicateStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.originalName ? (
                        <div>
                          <p className="text-gray-800 font-medium">{r.originalName}</p>
                          <p className="text-xs text-gray-400">{r.originalPhone}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Not linked</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{r.assigneeName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(r.duplicateCreatedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.duplicateStatus !== "DUPLICATE" && (
                        <button
                          type="button"
                          onClick={() => handleMarkDuplicate(r.duplicateId, r.originalId ?? undefined)}
                          disabled={markingId === r.duplicateId}
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-lg font-medium transition-colors",
                            "border border-orange-200 text-orange-600 hover:bg-orange-50 disabled:opacity-50",
                          )}
                        >
                          {markingId === r.duplicateId ? "Marking…" : "Mark Duplicate"}
                        </button>
                      )}
                      {r.duplicateStatus === "DUPLICATE" && (
                        <span className="text-xs text-gray-400">Already linked</span>
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
