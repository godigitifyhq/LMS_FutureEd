"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import { useEmployeePerformance } from "@/hooks/useDashboard";
import { PeriodSelector } from "./PeriodSelector";
import { CustomDateRange } from "./CustomDateRange";
import { EmployeeActivityChart } from "./EmployeeActivityChart";
import type { Period } from "@/hooks/useDashboard";
import { cn, formatDurationHMS } from "@/lib/utils";
import { ChevronDown, ChevronRight, Phone, Clock, Users, AlertCircle, CheckCircle2 } from "lucide-react";

type DayActivity = {
  date: string;
  interactions: number;
  calls: number;
  minutes: number;
};

type EmployeeRow = {
  employee: { id: string; name: string };
  metrics: {
    performanceScore: number;
    totalAssigned: number;
    confirmed: number;
    lost: number;
    confirmationRate: number;
    avgResponseHours: number | null;
    overdueFollowUps: number;
    followUpComplianceRate: number;
    callCount: number;
    callMinutes: number;
    callSecs: number;
    leadsInteracted: number;
    dailyActivity: DayActivity[];
  };
};

function StatMini({
  icon: Icon,
  label,
  value,
  color,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon size={13} />
      </div>
      <div>
        <p className="text-xs text-gray-400 leading-none mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-gray-800 leading-none">{value}</p>
      </div>
    </>
  );

  const base = "flex items-center gap-2 bg-white border border-surface-100 rounded-lg px-3 py-2 min-w-27.5";

  if (href) {
    return (
      <Link href={href} className={cn(base, "hover:border-primary hover:bg-surface-50 transition-colors cursor-pointer")}>
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}

function ExpandedRow({
  emp,
  callsPeriodQs,
  leadsPeriodQs,
}: {
  emp: EmployeeRow;
  callsPeriodQs: string;
  leadsPeriodQs: string;
}) {
  const m   = emp.metrics;
  const id  = emp.employee.id;
  // All lead links include the period date range so the count matches what the table shows
  const base         = `/leads?assignedToId=${id}${leadsPeriodQs ? `&${leadsPeriodQs.slice(1)}` : ""}`;
  const callsBase    = `/analytics/calls?employeeId=${id}${callsPeriodQs ? `&${callsPeriodQs.slice(1)}` : ""}`;
  // leadsInteracted is scoped to this employee's own leads that they've
  // personally interacted with — matches assignedToId + interactedByUserId.
  const interactedHref = `${base}&interactedByUserId=${id}`;

  return (
    <tr>
      <td colSpan={9} className="bg-surface-50 border-b border-surface-100 px-4 pb-4 pt-2">
        <p className="text-xs text-gray-400 mb-2">Click any card to view those leads</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <StatMini icon={Users}        label="All Leads"  value={m.totalAssigned}          color="bg-gray-100 text-gray-600"    href={base} />
          <StatMini icon={Phone}        label="Calls"      value={m.callCount ?? 0}         color="bg-blue-50 text-blue-600"     href={callsBase} />
          <StatMini icon={Clock}        label="Call Time"  value={formatDurationHMS(m.callSecs ?? 0)} color="bg-orange-50 text-orange-500" href={callsBase} />
          <StatMini icon={Users}        label="Interacted" value={m.leadsInteracted ?? 0}   color="bg-violet-50 text-violet-600" href={interactedHref} />
          <StatMini icon={CheckCircle2} label="Confirmed"  value={m.confirmed}              color="bg-green-50 text-green-600"   href={`${base}&status=CONFIRMED`} />
          <StatMini icon={AlertCircle}  label="Overdue"    value={m.overdueFollowUps}       color="bg-red-50 text-red-500"       href={`/leads?assignedToId=${id}&overdue=true`} />
          <StatMini icon={AlertCircle}  label="Lost"       value={m.lost}                   color="bg-rose-50 text-rose-600"     href={`${base}&status=LOST`} />
        </div>

        <div className="bg-white border border-surface-100 rounded-lg p-2">
          <p className="text-xs text-gray-400 font-medium mb-1 px-1">Activity</p>
          <EmployeeActivityChart data={m.dailyActivity} />
        </div>
      </td>
    </tr>
  );
}

export function EmployeePerformanceTable() {
  const [period, setPeriod] = useState<Period>("last30");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data, isLoading } = useEmployeePerformance(period, dateFrom, dateTo);

  const rawData = data as {
    employees?: EmployeeRow[];
    totals?: { totalCalls: number; totalMinutes: number; totalDurationSecs: number; totalInteracted: number };
    period?: { from: string; to: string };
  } | undefined;
  const employees: EmployeeRow[] = Array.isArray(rawData?.employees) ? (rawData?.employees ?? []) : [];
  const apiPeriod = rawData?.period;

  // Totals come from the backend (computed from raw seconds, rounded once) so
  // they reconcile with the calls report instead of drifting from summing
  // already-rounded per-employee minutes.
  const totalCalls        = rawData?.totals?.totalCalls        ?? 0;
  const totalDurationSecs = rawData?.totals?.totalDurationSecs ?? 0;
  const totalInteracted   = rawData?.totals?.totalInteracted   ?? 0;

  // Build period query strings for drill-through links
  const callsPeriodQs = period === "custom" && dateFrom && dateTo
    ? `?period=custom&dateFrom=${dateFrom}&dateTo=${dateTo}`
    : `?period=${period}`;
  const leadsPeriodQs = apiPeriod?.from && apiPeriod?.to
    ? `?dateFrom=${apiPeriod.from}&dateTo=${apiPeriod.to}&showAllStatuses=true`
    : "";

  const headers = ["Employee", "Leads", "Confirmed", "Lost", "Calls", "Duration", "Interacted", "Conv %"];

  return (
    <div className="bg-white border border-surface-200 rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-gray-800">Employee Performance</h3>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector value={period} onChange={setPeriod} compact />
          {period === "custom" && (
            <CustomDateRange dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          )}
        </div>
      </div>

      {/* Summary cards — all three drill through to a list backed by the
          exact same computation as the number shown, so the card and the
          list it opens can never disagree. Leads Interacted goes to /leads
          (via the interactedByOwner filter — see getInteractedLeadIds()),
          same as the other lead-based drill-throughs in this app. */}
      {!isLoading && employees.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Link
            href={`/analytics/calls${callsPeriodQs}`}
            className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-center hover:border-blue-300 hover:bg-blue-100 transition-colors"
          >
            <p className="text-xs text-blue-500 font-medium">Total Calls</p>
            <p className="text-lg font-bold text-blue-700">{totalCalls}</p>
          </Link>
          <Link
            href={`/leads?interactedByOwner=true${leadsPeriodQs ? `&${leadsPeriodQs.slice(1)}` : ""}`}
            className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-center hover:border-green-300 hover:bg-green-100 transition-colors"
          >
            <p className="text-xs text-green-500 font-medium">Leads Interacted</p>
            <p className="text-lg font-bold text-green-700">{totalInteracted}</p>
          </Link>
          <Link
            href={`/analytics/calls${callsPeriodQs}`}
            className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-center hover:border-orange-300 hover:bg-orange-100 transition-colors"
          >
            <p className="text-xs text-orange-500 font-medium">Total Duration</p>
            <p className="text-lg font-bold text-orange-600">{formatDurationHMS(totalDurationSecs)}</p>
          </Link>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-surface-100 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="pb-2 w-6"><span className="sr-only">Expand</span></th>
                {headers.map((h) => (
                  <th
                    key={h}
                    className="pb-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pr-4"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const isExpanded = expandedId === emp.employee.id;

                return (
                  <Fragment key={emp.employee.id}>
                    <tr
                      className="border-b border-surface-50 hover:bg-surface-50 cursor-pointer transition-colors"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : emp.employee.id)
                      }
                    >
                      {/* expand toggle */}
                      <td className="py-2.5 pr-1">
                        {isExpanded
                          ? <ChevronDown size={13} className="text-gray-400" />
                          : <ChevronRight size={13} className="text-gray-400" />}
                      </td>
                      {/* name — clicking expands row */}
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {emp.employee.name.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                            {emp.employee.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-sm text-gray-600">{emp.metrics.totalAssigned}</td>
                      <td className="py-2.5 pr-4 text-sm font-semibold text-green-600">{emp.metrics.confirmed}</td>
                      <td className="py-2.5 pr-4 text-sm text-red-500">{emp.metrics.lost}</td>
                      <td className="py-2.5 pr-4 text-sm text-blue-600 font-medium">{emp.metrics.callCount ?? 0}</td>
                      <td className="py-2.5 pr-4 text-sm text-orange-500 font-medium">{formatDurationHMS(emp.metrics.callSecs ?? 0)}</td>
                      <td className="py-2.5 pr-4 text-sm text-violet-600 font-medium">
                        <Link
                          href={`/leads?assignedToId=${emp.employee.id}&interactedByUserId=${emp.employee.id}${leadsPeriodQs ? `&${leadsPeriodQs.slice(1)}` : ""}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline"
                        >
                          {emp.metrics.leadsInteracted ?? 0}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 text-sm font-semibold text-gray-700">{emp.metrics.confirmationRate}%</td>
                    </tr>
                    {isExpanded && (
                      <ExpandedRow
                        emp={emp}
                        callsPeriodQs={callsPeriodQs}
                        leadsPeriodQs={leadsPeriodQs}
                      />
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {employees.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-6">
              No employee data for this period
            </p>
          )}
        </div>
      )}
    </div>
  );
}
