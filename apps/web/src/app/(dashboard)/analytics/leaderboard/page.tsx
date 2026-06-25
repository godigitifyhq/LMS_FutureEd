"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Trophy, TrendingUp, TrendingDown, Minus, Users, Phone, CheckCircle2, DollarSign, ChevronRight } from "lucide-react";
import { ReportShell } from "@/components/reports/ReportShell";
import { useLeaderboard } from "@/hooks/useReports";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Period } from "@/hooks/useDashboard";

type LeaderboardRow = {
  rank: number;
  prevRank: number | null;
  rankDelta: number | null;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  designation: string | null;
  team: string | null;
  isOnline: boolean;
  totalLeads: number;
  confirmedLeads: number;
  lostLeads: number;
  totalCalls: number;
  connectedCalls: number;
  totalCallMinutes: number;
  leadsInteracted: number;
  totalRevenue: number;
  confirmationRate: number;
  overdueFollowUps: number;
  followUpComplianceRate: number;
  tasksPending: number;
  tasksCompleted: number;
};

export default function LeaderboardPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [period, setPeriod] = useState<Period>(
    (searchParams.get("period") as Period) ?? "last30",
  );
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") ?? "");
  const [dateTo,   setDateTo]   = useState(searchParams.get("dateTo")   ?? "");
  const [view,     setView]     = useState<"card" | "table">("table");

  // Sync to URL
  useEffect(() => {
    const p = new URLSearchParams();
    p.set("period", period);
    if (period === "custom" && dateFrom) p.set("dateFrom", dateFrom);
    if (period === "custom" && dateTo)   p.set("dateTo",   dateTo);
    router.replace(`/analytics/leaderboard?${p.toString()}`, { scroll: false });
  }, [period, dateFrom, dateTo]);

  const filters = {
    period,
    ...(period === "custom" && dateFrom ? { dateFrom } : {}),
    ...(period === "custom" && dateTo   ? { dateTo }   : {}),
  };

  const { data, isLoading, isError, refetch } = useLeaderboard(filters);
  const payload = data?.data;
  const rows: LeaderboardRow[] = payload?.rows ?? [];
  const resolvedRange = payload?.period ?? null;

  const exportParams: Record<string, string | undefined> = {
    period,
    ...(period === "custom" && dateFrom ? { dateFrom } : {}),
    ...(period === "custom" && dateTo   ? { dateTo }   : {}),
  };
  const detailQuery = new URLSearchParams(exportParams).toString();

  return (
    <ReportShell
      title="Employee Leaderboard"
      description="Rank employees by conversion rate, calls, and revenue for the selected period."
      period={period}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onPeriodChange={setPeriod}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
      resolvedRange={resolvedRange}
      csvExportPath="/analytics/export/csv/leaderboard"
      csvExportParams={exportParams}
    >
      {/* View toggle */}
      <div className="flex items-center justify-end gap-2 mb-2">
        <button
          type="button"
          onClick={() => setView("card")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            view === "card" ? "bg-primary text-white" : "bg-surface-100 text-gray-500 hover:bg-surface-200",
          )}
        >
          Cards
        </button>
        <button
          type="button"
          onClick={() => setView("table")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            view === "table" ? "bg-primary text-white" : "bg-surface-100 text-gray-500 hover:bg-surface-200",
          )}
        >
          Table
        </button>
      </div>

      {isLoading && <LeaderboardSkeleton view={view} />}

      {isError && (
        <div className="text-center py-16 text-gray-500">
          <p className="mb-3">Failed to load leaderboard.</p>
          <button type="button" onClick={() => refetch()} className="text-primary underline text-sm">
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Trophy size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No employee data for this period.</p>
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && view === "card" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rows.map((row) => (
            <LeaderboardCard key={row.employeeId} row={row} detailQuery={detailQuery} />
          ))}
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && view === "table" && (
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-225">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  {["Rank", "Employee", "Status", "Leads", "Confirmed", "Conv %", "Calls", "Revenue", "Overdue", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.employeeId} className="border-b border-surface-50 hover:bg-surface-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-700 w-12">
                      <RankCell rank={row.rank} delta={row.rankDelta} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {row.employeeName.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 whitespace-nowrap">{row.employeeName}</p>
                          {row.designation && (
                            <p className="text-xs text-gray-400">{row.designation}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                        row.isOnline ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500",
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", row.isOnline ? "bg-green-500" : "bg-gray-400")} />
                        {row.isOnline ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <Link href={`/leads?assignedToId=${row.employeeId}`} className="hover:text-primary hover:underline">
                        {row.totalLeads}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold text-green-600">
                      <Link href={`/leads?assignedToId=${row.employeeId}&status=CONFIRMED`} className="hover:underline">
                        {row.confirmedLeads}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{row.confirmationRate}%</td>
                    <td className="px-4 py-3 text-blue-600">
                      <Link href={`/analytics/calls?employeeId=${row.employeeId}&${detailQuery}`} className="hover:underline">
                        {row.totalCalls}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{formatCurrency(row.totalRevenue)}</td>
                    <td className="px-4 py-3">
                      {row.overdueFollowUps > 0 ? (
                        <Link href={`/leads?assignedToId=${row.employeeId}&overdue=true`} className="text-red-500 font-medium hover:underline">
                          {row.overdueFollowUps}
                        </Link>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/analytics/employee/${row.employeeId}?${detailQuery}`}
                        className="text-primary hover:underline flex items-center gap-0.5 whitespace-nowrap text-xs"
                      >
                        View <ChevronRight size={12} />
                      </Link>
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

function RankCell({ rank, delta }: { rank: number; delta: number | null }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <div className="flex items-center gap-1.5">
      <span>{medal ?? `#${rank}`}</span>
      {delta !== null && delta !== 0 && (
        delta > 0 ? (
          <span className="flex items-center text-green-500 text-xs">
            <TrendingUp size={11} />{delta}
          </span>
        ) : (
          <span className="flex items-center text-red-500 text-xs">
            <TrendingDown size={11} />{Math.abs(delta)}
          </span>
        )
      )}
      {delta === 0 && <Minus size={10} className="text-gray-400" />}
    </div>
  );
}

function LeaderboardCard({ row, detailQuery }: { row: LeaderboardRow; detailQuery: string }) {
  return (
    <Link
      href={`/analytics/employee/${row.employeeId}?${detailQuery}`}
      className="bg-white border border-surface-200 rounded-xl p-4 hover:border-primary hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">
              {row.employeeName.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm leading-tight">{row.employeeName}</p>
            {row.designation && <p className="text-xs text-gray-400">{row.designation}</p>}
          </div>
        </div>
        <div className="text-right">
          <RankCell rank={row.rank} delta={row.rankDelta} />
          <span className={cn(
            "mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs",
            row.isOnline ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400",
          )}>
            <span className={cn("w-1.5 h-1.5 rounded-full", row.isOnline ? "bg-green-500" : "bg-gray-400")} />
            {row.isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <Kpi icon={Users}       label="Leads"     value={row.totalLeads}      color="text-gray-600" />
        <Kpi icon={CheckCircle2} label="Confirmed" value={`${row.confirmedLeads} (${row.confirmationRate}%)`} color="text-green-600" />
        <Kpi icon={Phone}       label="Calls"     value={row.totalCalls}      color="text-blue-600" />
        <Kpi icon={DollarSign}  label="Revenue"   value={formatCurrency(row.totalRevenue)} color="text-violet-600" />
      </div>
    </Link>
  );
}

function Kpi({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={12} className={color} />
      <div>
        <p className="text-[10px] text-gray-400 leading-none">{label}</p>
        <p className={cn("text-xs font-semibold leading-tight", color)}>{value}</p>
      </div>
    </div>
  );
}

function LeaderboardSkeleton({ view }: { view: "card" | "table" }) {
  if (view === "card") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white border border-surface-200 rounded-xl p-4 h-36 animate-pulse" />
        ))}
      </div>
    );
  }
  return (
    <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-14 border-b border-surface-50 animate-pulse bg-surface-50" style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}
