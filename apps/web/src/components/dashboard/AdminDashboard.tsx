"use client";

import { useState } from "react";
import {
  Users,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  UserX,
  Star,
} from "lucide-react";
import { StatCard } from "./StatCard";
import { PipelineChart } from "./PipelineChart";
import { ActivityFeed } from "./ActivityFeed";
import { EmployeePerformanceTable } from "./EmployeePerformanceTable";
import { FollowUpsDueToday } from "./FollowUpsDueToday";
import { LeadSourcesChart } from "./LeadSourcesChart";
import { TrendChart } from "./TrendChart";
import { PeriodSelector } from "./PeriodSelector";
import { useDashboardOverview } from "@/hooks/useDashboard";
import { useUnassignedLeads } from "@/hooks/useLeads";
import type { Period } from "@/hooks/useDashboard";

type DashboardSummary = {
  totalLeadsInPeriod?: number;
  newToday?: number;
  confirmedToday?: number;
  confirmedInPeriod?: number;
  overdueCount?: number;
  totalActiveLeads?: number;
  interestedCount?: number;
  conversionRate?: number;
};

type DashboardData = {
  summary?: DashboardSummary;
  period?: { from: string; to: string };
};

export function AdminDashboard() {
  const [period, setPeriod] = useState<Period>("last30");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { data, isLoading } = useDashboardOverview(period, undefined, dateFrom, dateTo);
  const { data: unassignedData, isLoading: unassignedLoading } =
    useUnassignedLeads();

  const dashData = data as DashboardData | undefined;
  const summary = dashData?.summary;
  const apiPeriod = dashData?.period;

  // Build date params for drill-through links so leads page shows the same period
  const drillFrom = apiPeriod?.from ?? "";
  const drillTo   = apiPeriod?.to   ?? "";
  const periodQs  = drillFrom && drillTo
    ? `&dateFrom=${drillFrom}&dateTo=${drillTo}`
    : "";

  return (
    <div className="space-y-6">
      {/* Period selector for stat cards */}
      <div className="flex items-center justify-between">
        <div />
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector value={period} onChange={setPeriod} />
          {period === "custom" && (
            <div className="flex items-center gap-1.5">
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-400 mb-0.5">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  title="From date"
                  className="border border-surface-200 rounded px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-400 mb-0.5">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  title="To date"
                  className="border border-surface-200 rounded px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard
          title="Total Leads"
          value={summary?.totalLeadsInPeriod ?? 0}
          subtitle="in period (all statuses)"
          icon={<Users size={16} className="text-red-600" />}
          colorVariant="red"
          loading={isLoading}
          href={`/leads?showAllStatuses=true${periodQs}`}
        />
        <StatCard
          title="Confirmed"
          value={summary?.confirmedInPeriod ?? 0}
          subtitle="in period"
          icon={<CheckCircle2 size={16} className="text-green-600" />}
          colorVariant="green"
          loading={isLoading}
          href={`/confirmed?dateFrom=${drillFrom}&dateTo=${drillTo}&dateBy=confirmedAt`}
        />
        <StatCard
          title="Pending Follow-ups"
          value={summary?.overdueCount ?? 0}
          subtitle="need action · in period"
          icon={<AlertTriangle size={16} className="text-amber-600" />}
          colorVariant="yellow"
          loading={isLoading}
          href={`/leads?overdue=true${periodQs}`}
        />
        <StatCard
          title="Interested Leads"
          value={summary?.interestedCount ?? 0}
          subtitle="in pipeline"
          icon={<Star size={16} className="text-blue-600" />}
          colorVariant="blue"
          loading={isLoading}
          href="/admissions"
        />
        <StatCard
          title="Active Leads"
          value={summary?.totalActiveLeads ?? 0}
          subtitle="not closed"
          icon={<TrendingUp size={16} className="text-indigo-600" />}
          colorVariant="indigo"
          loading={isLoading}
          href="/leads?excludeTerminal=true"
        />
        <StatCard
          title="Conversion Rate"
          value={`${summary?.conversionRate ?? 0}%`}
          subtitle="confirmed ÷ total leads"
          icon={<CheckCircle2 size={16} className="text-green-600" />}
          colorVariant="green"
          loading={isLoading}
          href="/analytics/conversions"
        />
        <StatCard
          title="Unassigned Leads"
          value={unassignedData?.total ?? 0}
          subtitle="need assignment"
          icon={<UserX size={16} className="text-orange-600" />}
          colorVariant="orange"
          loading={unassignedLoading}
          href="/leads?assignedToId=unassigned"
        />
      </div>

      {/* Pipeline + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PipelineChart />
        </div>
        <ActivityFeed />
      </div>

      {/* Employee performance + Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <EmployeePerformanceTable />
        </div>
        <FollowUpsDueToday />
      </div>

      {/* Sources + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadSourcesChart />
        <TrendChart />
      </div>
    </div>
  );
}
