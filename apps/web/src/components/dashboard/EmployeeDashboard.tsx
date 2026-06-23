"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, CheckCircle2, Clock, TrendingUp, Phone, Timer, Activity, Star, UserPlus } from "lucide-react";
import { StatCard } from "./StatCard";
import { FollowUpsDueToday } from "./FollowUpsDueToday";
import { ActivityFeed } from "./ActivityFeed";
import { PeriodSelector } from "./PeriodSelector";
import { EmployeeCallChart } from "./EmployeeCallChart";
import { StatusBadge } from "@/components/leads/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";
import type { Period } from "@/hooks/useDashboard";
import { useMyCallStats } from "@/hooks/useDashboard";
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

  // Fetch MY leads with a high page size to calculate real stats
  const { data: myLeadsData, isLoading } = useQuery({
    queryKey: ["my-leads-stats", user?.id, period],
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

  // Fetch overdue count separately for accuracy
  const { data: overdueData } = useQuery({
    queryKey: ["my-overdue", user?.id],
    queryFn: async () => {
      const { data } = await api.get("/leads/overdue");
      return data.data as { leads: Lead[] };
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // Call performance stats
  const { data: callStats } = useMyCallStats();

  const myLeads = myLeadsData?.leads ?? [];
  const myTotal = myLeadsData?.total ?? 0;

  // Calculate real stats from API data
  const confirmed = myLeads.filter((l) => l.status === "CONFIRMED").length;
  const lost = myLeads.filter((l) => l.status === "LOST").length;
  const active = myLeads.filter(
    (l) => !["CONFIRMED", "LOST", "DUPLICATE"].includes(l.status),
  ).length;
  const overdueCount = overdueData?.leads?.length ?? 0;

  const convRate = myTotal > 0 ? Math.round((confirmed / myTotal) * 100) : 0;

  const callsToday          = callStats?.callsToday ?? 0;
  const minutesToday        = callStats?.minutesToday ?? 0;
  const leadsInteractedToday = callStats?.leadsInteractedToday ?? 0;
  const confirmedToday      = callStats?.confirmedToday ?? 0;
  const newLeadsToday       = callStats?.newLeadsToday ?? 0;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Your performance overview</p>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Lead stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 bg-surface-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="My Total Leads"
            value={myTotal}
            subtitle={`${active} active`}
            icon={<Users size={16} className="text-red-600" />}
            colorVariant="red"
            href="/leads"
          />
          <StatCard
            title="Confirmed"
            value={confirmed}
            subtitle={confirmed === 0 ? "Keep going!" : "Great work!"}
            icon={<CheckCircle2 size={16} className="text-green-600" />}
            colorVariant="green"
            href="/leads?status=CONFIRMED"
          />
          <StatCard
            title="Overdue Follow-ups"
            value={overdueCount}
            subtitle={overdueCount === 0 ? "All caught up" : "Need action"}
            icon={<Clock size={16} className="text-amber-600" />}
            colorVariant="yellow"
            href="/leads?overdue=true"
          />
          <StatCard
            title="Conversion Rate"
            value={`${convRate}%`}
            subtitle={`${lost} lost leads`}
            icon={<TrendingUp size={16} className="text-indigo-600" />}
            colorVariant="indigo"
            href="/leads"
          />
        </div>
      )}

      {/* Today's daily report */}
      <div className="bg-white border border-surface-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={14} className="text-primary" />
          <h3 className="text-sm font-semibold text-gray-800">Today&apos;s Report</h3>
          <span className="ml-auto text-xs text-gray-400">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="flex flex-col gap-0.5 p-3 rounded-lg bg-blue-50 border border-blue-100">
            <div className="flex items-center gap-1.5 text-blue-600 mb-1">
              <Phone size={12} />
              <span className="text-xs font-medium">Calls Made</span>
            </div>
            <span className="text-2xl font-bold text-blue-700">{callsToday}</span>
            <span className="text-xs text-blue-500">{minutesToday}m talked</span>
          </div>
          <div className="flex flex-col gap-0.5 p-3 rounded-lg bg-violet-50 border border-violet-100">
            <div className="flex items-center gap-1.5 text-violet-600 mb-1">
              <Users size={12} />
              <span className="text-xs font-medium">Interacted</span>
            </div>
            <span className="text-2xl font-bold text-violet-700">{leadsInteractedToday}</span>
            <span className="text-xs text-violet-500">leads contacted</span>
          </div>
          <div className="flex flex-col gap-0.5 p-3 rounded-lg bg-green-50 border border-green-100">
            <div className="flex items-center gap-1.5 text-green-600 mb-1">
              <Star size={12} />
              <span className="text-xs font-medium">Confirmed</span>
            </div>
            <span className="text-2xl font-bold text-green-700">{confirmedToday}</span>
            <span className="text-xs text-green-500">today&apos;s wins</span>
          </div>
          <div className="flex flex-col gap-0.5 p-3 rounded-lg bg-orange-50 border border-orange-100">
            <div className="flex items-center gap-1.5 text-orange-600 mb-1">
              <Timer size={12} />
              <span className="text-xs font-medium">Call Minutes</span>
            </div>
            <span className="text-2xl font-bold text-orange-700">{minutesToday}</span>
            <span className="text-xs text-orange-500">min on calls</span>
          </div>
          <div className="flex flex-col gap-0.5 p-3 rounded-lg bg-teal-50 border border-teal-100">
            <div className="flex items-center gap-1.5 text-teal-600 mb-1">
              <UserPlus size={12} />
              <span className="text-xs font-medium">New Leads</span>
            </div>
            <span className="text-2xl font-bold text-teal-700">{newLeadsToday}</span>
            <span className="text-xs text-teal-500">assigned today</span>
          </div>
        </div>
      </div>

      {/* Call activity chart */}
      <EmployeeCallChart />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
