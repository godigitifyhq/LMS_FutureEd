"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Phone, CheckCircle2, Users, Clock, TrendingUp, AlertCircle, Play } from "lucide-react";
import Link from "next/link";
import { ReportShell } from "@/components/reports/ReportShell";
import { useEmployeeDetail } from "@/hooks/useReports";
import { formatCurrency, formatDurationHMS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Period } from "@/hooks/useDashboard";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type EmployeeStats = {
  employeeName: string;
  employeeEmail: string;
  designation: string | null;
  team: string | null;
  isOnline: boolean;
  firstCallAt: string | null;
  lastCallAt: string | null;
  lastConnectedCallAt: string | null;
  totalLeads: number;
  confirmedLeads: number;
  lostLeads: number;
  activeLeads: number;
  totalCalls: number;
  connectedCalls: number;
  missedCalls: number;
  totalCallMinutes: number;
  totalCallSecs: number;
  totalInteractions: number;
  leadsInteracted: number;
  totalRevenue: number;
  overdueFollowUps: number;
  followUpComplianceRate: number;
  confirmationRate: number;
  tasksPending: number;
  tasksCompleted: number;
  tasksOverdue: number;
};

type DailyCallStat = {
  date: string;
  totalCalls: number;
  connectedCalls: number;
  missedCalls: number;
  totalMinutes: number;
};

type HourlyCallStat = { hour: number; totalCalls: number };

type CallEntry = {
  id: string;
  leadId: string | null;
  leadName: string;
  leadPhone: string;
  outcome: string | null;
  durationSecs: number | null;
  recordingUrl: string | null;
  createdAt: string;
};

export default function EmployeeDetailPage() {
  const { id }      = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router      = useRouter();

  const [period,   setPeriod]   = useState<Period>((searchParams.get("period") as Period) ?? "last30");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") ?? "");
  const [dateTo,   setDateTo]   = useState(searchParams.get("dateTo") ?? "");
  const [mounted,  setMounted]  = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const p = new URLSearchParams();
    p.set("period", period);
    if (period === "custom" && dateFrom) p.set("dateFrom", dateFrom);
    if (period === "custom" && dateTo)   p.set("dateTo",   dateTo);
    router.replace(`/analytics/employee/${id}?${p.toString()}`, { scroll: false });
  }, [period, dateFrom, dateTo, id]);

  const filters = {
    period,
    ...(period === "custom" && dateFrom ? { dateFrom } : {}),
    ...(period === "custom" && dateTo   ? { dateTo }   : {}),
  };

  const { data, isLoading, isError, refetch } = useEmployeeDetail(id, filters);
  const detail = data?.data;
  const stats: EmployeeStats | null    = detail?.stats ?? null;
  const dailyCalls: DailyCallStat[]    = detail?.dailyCalls ?? [];
  const hourlyCalls: HourlyCallStat[]  = detail?.hourlyCalls ?? [];
  const recentCalls: CallEntry[]       = detail?.recentCalls ?? [];
  const resolvedRange                   = detail?.period ?? null;
  const reportQs = new URLSearchParams();
  reportQs.set("period", period);
  if (period === "custom" && dateFrom) reportQs.set("dateFrom", dateFrom);
  if (period === "custom" && dateTo) reportQs.set("dateTo", dateTo);
  const reportQuery = reportQs.toString();
  // The Leads list has no "period" shorthand, and defaults status-filtered
  // date ranges to createdAt — matching how confirmedLeads/totalLeads below
  // are computed (leads created in this window), so the drill-through count
  // reconciles with the KPI card instead of silently showing all-time leads.
  const leadsPeriodQs = resolvedRange?.from && resolvedRange?.to
    ? `&dateFrom=${resolvedRange.from}&dateTo=${resolvedRange.to}&showAllStatuses=true`
    : "";
  const leadsBase = `/leads?assignedToId=${id}${leadsPeriodQs}`;
  // leadsInteracted is scoped to leads currently assigned to this employee
  // that they've personally interacted with — matches assignedToId + interactedByUserId.
  const interactedHref = `${leadsBase}&interactedByUserId=${id}`;
  const callsBase = `/analytics/calls?employeeId=${id}&${reportQuery}`;
  const tasksBase = `/analytics/tasks?employeeId=${id}&${reportQuery}`;

  return (
    <ReportShell
      title={stats ? `${stats.employeeName} — Detail Report` : "Employee Detail Report"}
      period={period}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onPeriodChange={setPeriod}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
      resolvedRange={resolvedRange}
    >
      <Link
        href={`/analytics/leaderboard?period=${period}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-4 transition-colors"
      >
        <ArrowLeft size={13} /> Back to Leaderboard
      </Link>

      {isLoading && <DetailSkeleton />}
      {isError && (
        <div className="text-center py-16 text-gray-500">
          <p className="mb-3">Failed to load report.</p>
          <button type="button" onClick={() => refetch()} className="text-primary underline text-sm">Retry</button>
        </div>
      )}

      {!isLoading && !isError && stats && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <KpiCard icon={Users} label="Total Leads" value={stats.totalLeads} color="text-gray-700" href={leadsBase} />
            <KpiCard icon={CheckCircle2} label="Confirmed" value={`${stats.confirmedLeads} (${stats.confirmationRate}%)`} color="text-green-600" href={`${leadsBase}&status=CONFIRMED`} />
            <KpiCard icon={Phone} label="Total Calls" value={stats.totalCalls} color="text-blue-600" href={callsBase} />
            <KpiCard icon={Phone} label="Connected" value={stats.connectedCalls} color="text-green-600" href={`${callsBase}&outcome=CONNECTED`} />
            <KpiCard icon={Clock} label="Call Duration" value={formatDurationHMS(stats.totalCallSecs)} color="text-orange-500" href={callsBase} />
            <KpiCard icon={Clock} label="Starting Call" value={fmtReportDateTime(stats.firstCallAt)} color="text-slate-600" href={callsBase} />
            <KpiCard icon={Clock} label="Last Call" value={fmtReportDateTime(stats.lastCallAt)} color="text-emerald-600" href={callsBase} />
            <KpiCard icon={TrendingUp} label="Revenue" value={formatCurrency(stats.totalRevenue)} color="text-violet-600" href={`${leadsBase}&status=CONFIRMED`} />
            {/* overdueFollowUps is current-state (no period filter) — must not carry leadsBase's date range */}
            <KpiCard icon={AlertCircle} label="Overdue" value={stats.overdueFollowUps} color={stats.overdueFollowUps > 0 ? "text-red-500" : "text-gray-400"} href={`/leads?assignedToId=${id}&overdue=true`} />
            <KpiCard icon={Users} label="Interacted" value={stats.leadsInteracted} color="text-indigo-600" href={interactedHref} />
            <KpiCard icon={CheckCircle2} label="Tasks Done" value={stats.tasksCompleted} color="text-teal-600" href={`${tasksBase}&status=COMPLETED`} />
            <KpiCard icon={AlertCircle} label="Tasks Overdue" value={stats.tasksOverdue} color={stats.tasksOverdue > 0 ? "text-red-500" : "text-gray-400"} href={`${tasksBase}&overdue=true`} />
          </div>

          {/* Charts */}
          {mounted && dailyCalls.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Daily calls chart */}
              <div className="lg:col-span-2 bg-white border border-surface-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Daily Call Activity</h3>
                <Chart
                  type="bar"
                  height={180}
                  series={[
                    { name: "Connected", data: dailyCalls.map((d) => d.connectedCalls) },
                    { name: "Missed",    data: dailyCalls.map((d) => d.missedCalls) },
                  ]}
                  options={{
                    chart:  { toolbar: { show: false }, stacked: true },
                    colors: ["#16a34a", "#ef4444"],
                    xaxis: {
                      categories: dailyCalls.map((d) => {
                        const [, m, day] = d.date.split("-");
                        return `${day}/${m}`;
                      }),
                      labels: {
                        rotate: -45,
                        style: { fontSize: "10px" },
                        formatter: (v: string | number, _ts?: number, opts?: { dataPointIndex?: number }) => {
                          const step = dailyCalls.length <= 7 ? 1 : dailyCalls.length <= 30 ? 5 : 15;
                          const i = opts?.dataPointIndex ?? 0;
                          return i % step === 0 ? String(v) : "";
                        },
                      },
                    },
                    plotOptions: { bar: { columnWidth: dailyCalls.length <= 7 ? "50%" : "70%" } },
                    legend: { position: "top", fontSize: "11px" },
                    dataLabels: { enabled: false },
                    tooltip: {
                      x: { formatter: (_val: string | number, opts?: { dataPointIndex?: number }) => dailyCalls[opts?.dataPointIndex ?? 0]?.date ?? String(_val) },
                    },
                  }}
                />
              </div>

              {/* Hourly distribution */}
              <div className="bg-white border border-surface-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Calls by Hour (IST)</h3>
                <Chart
                  type="bar"
                  height={180}
                  series={[{ name: "Calls", data: hourlyCalls.map((h) => h.totalCalls) }]}
                  options={{
                    chart:   { toolbar: { show: false } },
                    colors:  ["#3b82f6"],
                    xaxis: {
                      categories: hourlyCalls.map((h) => `${h.hour}h`),
                      labels:     { style: { fontSize: "9px" } },
                    },
                    plotOptions: { bar: { columnWidth: "60%" } },
                    dataLabels:  { enabled: false },
                  }}
                />
              </div>
            </div>
          )}

          {/* Recent Calls Table */}
          {recentCalls.length > 0 && (
            <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-100">
                <h3 className="text-sm font-semibold text-gray-700">Recent Calls</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-150">
                  <thead>
                    <tr className="bg-surface-50 border-b border-surface-100">
                      {["Lead", "Phone", "Outcome", "Duration", "Recording", "Date"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentCalls.map((call) => (
                      <tr key={call.id} className="border-b border-surface-50 hover:bg-surface-50">
                        <td className="px-4 py-2.5 font-medium">
                          {call.leadId ? (
                            <Link href={`/leads/${call.leadId}`} className="text-gray-800 hover:text-primary hover:underline">
                              {call.leadName}
                            </Link>
                          ) : (
                            <span className="text-gray-800">{call.leadName}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500">{call.leadPhone}</td>
                        <td className="px-4 py-2.5">
                          <OutcomeBadge outcome={call.outcome} />
                        </td>
                        <td className="px-4 py-2.5 text-gray-500">
                          {formatDurationHMS(call.durationSecs)}
                        </td>
                        <td className="px-4 py-2.5">
                          {call.recordingUrl ? (
                            <a
                              href={call.recordingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                            >
                              <Play size={11} /> Play
                            </a>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(call.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </ReportShell>
  );
}

function KpiCard({ icon: Icon, label, value, color, href }: { icon: React.ElementType; label: string; value: string | number; color: string; href?: string }) {
  const content = (
    <div className={cn("bg-white border border-surface-200 rounded-xl p-3", href && "hover:border-primary hover:bg-surface-50 transition-colors")}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} className={color} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className={cn("text-lg font-bold", color)}>{value}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    CONNECTED:    { label: "Connected",    cls: "bg-green-50 text-green-700" },
    NO_ANSWER:    { label: "No Answer",    cls: "bg-yellow-50 text-yellow-700" },
    BUSY:         { label: "Busy",         cls: "bg-orange-50 text-orange-700" },
    REJECTED:     { label: "Rejected",     cls: "bg-red-50 text-red-700" },
    WRONG_NUMBER: { label: "Wrong Number", cls: "bg-gray-100 text-gray-600" },
  };
  const entry = outcome ? map[outcome] : null;
  if (!entry) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", entry.cls)}>
      {entry.label}
    </span>
  );
}

function fmtReportDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-surface-100 rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-52 bg-surface-100 rounded-xl animate-pulse" />
        <div className="h-52 bg-surface-100 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
