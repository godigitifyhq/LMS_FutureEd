"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, CheckCircle2, Clock, TrendingUp, Phone, Timer, Activity, Star, UserPlus, PhoneCall, UserCheck, History, XCircle } from "lucide-react";
import { StatCard } from "./StatCard";
import { FollowUpsDueToday } from "./FollowUpsDueToday";
import { ActivityFeed } from "./ActivityFeed";
import { PeriodSelector } from "./PeriodSelector";
import { CustomDateRange } from "./CustomDateRange";
import { EmployeeCallChart } from "./EmployeeCallChart";
import { StatusBadge } from "@/components/leads/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";
import type { Period } from "@/hooks/useDashboard";
import { useMyCallStats, useMyDashboardOverview } from "@/hooks/useDashboard";
import { istDateString } from "@/lib/istDate";
import type { LeadStatus } from "@lms/types";
type Lead = {
  id: string;
  studentName: string;
  phone?: string | null;
  status: LeadStatus;
  nextFollowUpAt?: string | null;
  createdAt?: string | null;
};
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export function EmployeeDashboard() {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState<Period>("last30");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Fetch MY most recent leads for the "My Recent Leads" list only — not
  // used for any stat card below (those all come from useMyDashboardOverview,
  // computed server-side so they aren't capped by a page size).
  const { data: myLeadsData, isLoading } = useQuery({
    queryKey: ["my-leads-stats", user?.id],
    queryFn: async () => {
      const { data } = await api.get(
        "/leads?pageSize=80&sortBy=createdAt&sortOrder=desc",
      );
      return data.data as {
        leads: Lead[];
        total: number;
      };
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // Call performance stats — always "today", unaffected by the period selector
  const { data: callStats } = useMyCallStats();

  // Period-filtered KPI cards. Backed by /me/dashboard-overview, which reuses
  // computeEmployeeStats() — the same single source of truth behind the
  // leaderboard and admin's per-employee report — so every card here
  // reconciles exactly with its /leads or /my-calls drill-through.
  const { data: overview, isLoading: overviewLoading } = useMyDashboardOverview(period, dateFrom, dateTo);
  const stats = overview?.stats ?? null;
  const resolvedPeriod = overview?.period ?? null;
  const periodQs = resolvedPeriod
    ? `&dateFrom=${resolvedPeriod.from}&dateTo=${resolvedPeriod.to}`
    : "";

  const myLeads = myLeadsData?.leads ?? [];

  const totalLeadsAllTime  = overview?.totalLeadsAllTime ?? 0;
  const activeLeadsAllTime = overview?.activeLeadsAllTime ?? 0;

  const newLeadsInPeriod        = stats?.totalLeads ?? 0;
  const confirmedInPeriod       = stats?.confirmedLeads ?? 0;
  const interestedInPeriod      = stats?.interestedLeads ?? 0;
  const lostInPeriod            = stats?.lostLeads ?? 0;
  const overdueCount            = stats?.overdueFollowUps ?? 0;
  const conversionRate          = stats?.confirmationRate ?? 0;
  const totalCallsInPeriod      = stats?.totalCalls ?? 0;
  const totalCallMinutesInPeriod = stats?.totalCallMinutes ?? 0;
  const leadsInteractedInPeriod = stats?.leadsInteracted ?? 0;

  const callsToday          = callStats?.callsToday ?? 0;
  const minutesToday        = callStats?.minutesToday ?? 0;
  const leadsInteractedToday = callStats?.leadsInteractedToday ?? 0;
  const confirmedToday      = callStats?.confirmedToday ?? 0;
  const newLeadsToday       = callStats?.newLeadsToday ?? 0;

  // Drill-through links for the Today's Report tiles — always "today",
  // regardless of the period selector above (matches callStats being
  // hardcoded to today on the backend).
  const today = istDateString(0);
  const callsTodayHref = "/my-calls?scope=today";
  const interactedTodayHref = "/my-calls?tab=interacted";
  const confirmedTodayHref = `/leads?status=CONFIRMED&dateBy=confirmedAt&dateFrom=${today}&dateTo=${today}`;
  const newLeadsTodayHref = `/leads?dateFrom=${today}&dateTo=${today}&showAllStatuses=true`;

  // Period-scoped KPI card hrefs — all use the exact dateFrom/dateTo the
  // backend resolved for `period` (cohort semantics: leads created in that
  // window), so each card's number always matches what its link shows.
  const newLeadsHref = `/leads?showAllStatuses=true${periodQs}`;
  const confirmedHref = `/leads?status=CONFIRMED${periodQs}`;
  const interestedHref = `/leads?status=INTERESTED${periodQs}`;
  const lostHref = `/leads?status=LOST${periodQs}`;
  const interactedLeadsHref = user
    ? `/leads?interactedByUserId=${user.id}&showAllStatuses=true${periodQs}`
    : "/leads";
  const callsHref = `/my-calls${resolvedPeriod ? `?dateFrom=${resolvedPeriod.from}&dateTo=${resolvedPeriod.to}` : ""}`;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Your performance overview</p>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector value={period} onChange={setPeriod} />
          {period === "custom" && (
            <CustomDateRange
              dateFrom={dateFrom}
              dateTo={dateTo}
              onFromChange={setDateFrom}
              onToChange={setDateTo}
            />
          )}
        </div>
      </div>

      {/* KPI cards — Total Leads/Overdue are always-current; everything else
          respects the period selector above. */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Leads"
          value={totalLeadsAllTime}
          subtitle={`${activeLeadsAllTime} active · all-time`}
          icon={<Users size={16} className="text-red-600" />}
          colorVariant="red"
          loading={overviewLoading}
          href="/leads?showAllStatuses=true"
        />
        <StatCard
          title="New Leads"
          value={newLeadsInPeriod}
          subtitle="created in period"
          icon={<UserPlus size={16} className="text-teal-600" />}
          colorVariant="blue"
          loading={overviewLoading}
          href={newLeadsHref}
        />
        <StatCard
          title="Confirmed"
          value={confirmedInPeriod}
          subtitle={confirmedInPeriod === 0 ? "Keep going!" : "in period"}
          icon={<CheckCircle2 size={16} className="text-green-600" />}
          colorVariant="green"
          loading={overviewLoading}
          href={confirmedHref}
        />
        <StatCard
          title="Interested Leads"
          value={interestedInPeriod}
          subtitle="in period"
          icon={<Star size={16} className="text-blue-600" />}
          colorVariant="blue"
          loading={overviewLoading}
          href={interestedHref}
        />
        <StatCard
          title="Lost Leads"
          value={lostInPeriod}
          subtitle="in period"
          icon={<XCircle size={16} className="text-red-600" />}
          colorVariant="red"
          loading={overviewLoading}
          href={lostHref}
        />
        <StatCard
          title="Overdue Follow-ups"
          value={overdueCount}
          subtitle={overdueCount === 0 ? "All caught up · now" : "Need action · now"}
          icon={<Clock size={16} className="text-amber-600" />}
          colorVariant="yellow"
          loading={overviewLoading}
          href="/leads?overdue=true"
        />
        <StatCard
          title="Conversion Rate"
          value={`${conversionRate}%`}
          subtitle="confirmed ÷ new, in period"
          icon={<TrendingUp size={16} className="text-indigo-600" />}
          colorVariant="indigo"
          loading={overviewLoading}
          href={newLeadsHref}
        />
        <StatCard
          title="Total Calls"
          value={totalCallsInPeriod}
          subtitle="in period"
          icon={<PhoneCall size={16} className="text-blue-600" />}
          colorVariant="blue"
          loading={overviewLoading}
          href={callsHref}
        />
        <StatCard
          title="Total Leads Interacted"
          value={leadsInteractedInPeriod}
          subtitle="in period, any interaction"
          icon={<UserCheck size={16} className="text-orange-600" />}
          colorVariant="orange"
          loading={overviewLoading}
          href={interactedLeadsHref}
        />
        <StatCard
          title="Total Call Duration"
          value={`${totalCallMinutesInPeriod}m`}
          subtitle="in period"
          icon={<History size={16} className="text-indigo-600" />}
          colorVariant="indigo"
          loading={overviewLoading}
          href={callsHref}
        />
      </div>

      {/* Today's daily report — always "today", not affected by the period selector above */}
      <div className="bg-white border border-surface-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={14} className="text-primary" />
          <h3 className="text-sm font-semibold text-gray-800">Today&apos;s Report</h3>
          <span className="ml-auto text-xs text-gray-400">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Link
            href={callsTodayHref}
            className="flex flex-col gap-0.5 p-3 rounded-lg bg-blue-50 border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-blue-600 mb-1">
              <Phone size={12} />
              <span className="text-xs font-medium">Calls Made</span>
            </div>
            <span className="text-2xl font-bold text-blue-700">{callsToday}</span>
            <span className="text-xs text-blue-500">{minutesToday}m talked</span>
          </Link>
          <Link
            href={interactedTodayHref}
            className="flex flex-col gap-0.5 p-3 rounded-lg bg-violet-50 border border-violet-100 hover:border-violet-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-violet-600 mb-1">
              <Users size={12} />
              <span className="text-xs font-medium">Interacted</span>
            </div>
            <span className="text-2xl font-bold text-violet-700">{leadsInteractedToday}</span>
            <span className="text-xs text-violet-500">leads contacted</span>
          </Link>
          <Link
            href={confirmedTodayHref}
            className="flex flex-col gap-0.5 p-3 rounded-lg bg-green-50 border border-green-100 hover:border-green-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-green-600 mb-1">
              <Star size={12} />
              <span className="text-xs font-medium">Confirmed</span>
            </div>
            <span className="text-2xl font-bold text-green-700">{confirmedToday}</span>
            <span className="text-xs text-green-500">today&apos;s wins</span>
          </Link>
          <Link
            href={callsTodayHref}
            className="flex flex-col gap-0.5 p-3 rounded-lg bg-orange-50 border border-orange-100 hover:border-orange-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-orange-600 mb-1">
              <Timer size={12} />
              <span className="text-xs font-medium">Call Minutes</span>
            </div>
            <span className="text-2xl font-bold text-orange-700">{minutesToday}</span>
            <span className="text-xs text-orange-500">min on calls</span>
          </Link>
          <Link
            href={newLeadsTodayHref}
            className="flex flex-col gap-0.5 p-3 rounded-lg bg-teal-50 border border-teal-100 hover:border-teal-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-teal-600 mb-1">
              <UserPlus size={12} />
              <span className="text-xs font-medium">New Leads</span>
            </div>
            <span className="text-2xl font-bold text-teal-700">{newLeadsToday}</span>
            <span className="text-xs text-teal-500">assigned today</span>
          </Link>
        </div>
      </div>

      {/* Call activity chart */}
      <EmployeeCallChart />

      {/* Call records link */}
      <Link
        href="/my-calls"
        className="flex items-center justify-between bg-white border border-surface-200 rounded-xl p-4 hover:border-primary-200 hover:bg-surface-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <PhoneCall size={14} className="text-primary" />
          <span className="text-sm font-semibold text-gray-800">My Call Records</span>
          <span className="text-xs text-gray-400">Search, filter and review every call you&apos;ve logged</span>
        </div>
        <span className="text-xs text-primary font-medium">View all →</span>
      </Link>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Recent leads */}
        <div className="lg:col-span-2 bg-white border border-surface-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">
              My Recent Leads
            </h3>
            <Link
              href="/leads"
              className="text-xs text-primary font-medium hover:underline"
            >
              View all →
            </Link>
          </div>

          {isLoading ? (
            <Spinner />
          ) : (
            <div className="space-y-2">
              {myLeads.slice(0, 8).map((lead) => {
                const isOverdue =
                  lead.nextFollowUpAt &&
                  new Date(lead.nextFollowUpAt) < new Date();
                return (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-surface-100 hover:border-primary-200 hover:bg-surface-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {lead.studentName}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {lead.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge
                        status={lead.status as LeadStatus}
                        size="sm"
                      />
                      {lead.nextFollowUpAt && (
                        <span
                          className={`text-xs hidden sm:block ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}
                        >
                          {dayjs(lead.nextFollowUpAt).fromNow()}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}

              {myLeads.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-6">
                  No leads assigned yet
                </p>
              )}
            </div>
          )}
        </div>

        {/* Follow-ups */}
        <FollowUpsDueToday />
      </div>

      {/* Activity feed — only own activity */}
      <div className="bg-white border border-surface-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">
          My Recent Activity
        </h3>
        <ActivityFeed />
      </div>
    </div>
  );
}
