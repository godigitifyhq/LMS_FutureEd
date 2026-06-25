"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { ReportShell } from "@/components/reports/ReportShell";
import { useDuplicateReport } from "@/hooks/useReports";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import toast from "react-hot-toast";

export default function DuplicatesPage() {
  const { data, isLoading, isError, refetch } = useDuplicateReport();
  const rows: any[] = (data as any)?.data?.rows ?? [];
  const total       = (data as any)?.data?.total ?? 0;

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
      <div className="bg-white border border-surface-200 rounded-xl px-4 py-3 flex items-center gap-2">
        <Copy size={16} className="text-orange-500" />
        <span className="text-sm font-semibold text-gray-700">{total} duplicate leads detected</span>
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
          <p className="text-sm">No duplicate leads found. ✨</p>
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-187.5">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  {["Duplicate Lead", "Phone", "Status", "Original Lead", "Assigned To", "Created", "Action"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.duplicateId} className="border-b border-surface-50 hover:bg-surface-50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-800">{r.duplicateName}</p>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{r.duplicatePhone}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
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
