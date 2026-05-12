"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { AlertCircle } from "lucide-react";
import type { InteractionType, LeadStatus } from "@lms/types";

type ActivityFeedItem = {
  id: string;
  type: InteractionType;
  statusAfter: LeadStatus | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
  lead: {
    id: string;
    studentName: string;
  };
};

type ActivityFeedResponse = {
  interactions: ActivityFeedItem[];
};

dayjs.extend(relativeTime);

function buildText(item: ActivityFeedItem): string {
  const actor = item.user?.name ?? "Someone";
  const student = item.lead?.studentName ?? "a student";
  switch (item.type) {
    case "STATUS_CHANGED":
      return `${actor} moved ${student} → ${item.statusAfter?.replace(/_/g, " ")}`;
    case "CALL":
      return `${actor} logged a call with ${student}`;
    case "NOTE":
      return `${actor} added a note on ${student}`;
    case "DOCUMENT_UPLOADED":
      return `${actor} uploaded a document for ${student}`;
    default:
      return `${actor} updated ${student}`;
  }
}

const COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-green-100 text-green-700",
  "bg-purple-100 text-purple-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];

export function ActivityFeed() {
  const { data, isLoading, isError } = useQuery<ActivityFeedItem[]>({
    queryKey: ["activity-feed"],
    queryFn: async () => {
      const { data } = await api.get<ActivityFeedResponse>("/activity");
      return data.interactions;
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  return (
    <div className="bg-white border border-surface-200 rounded-xl p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-800">Activity Feed</h3>
        {data && (
          <span className="text-xs text-gray-400">
            {data.length} recent events
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4 flex-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-surface-200 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-surface-200 rounded w-4/5" />
                <div className="h-3 bg-surface-100 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 text-sm text-red-500 py-4">
          <AlertCircle size={15} />
          Failed to load activity feed
        </div>
      ) : !data?.length ? (
        <p className="text-sm text-gray-400 text-center py-8">
          No recent activity
        </p>
      ) : (
        <div className="space-y-4 overflow-y-auto flex-1 max-h-96">
          {data.map((item: ActivityFeedItem) => {
            const colorIdx =
              (item.user?.name?.charCodeAt(0) ?? 0) % COLORS.length;
            const color = COLORS[colorIdx]!;
            const initials = (item.user?.name ?? "U").slice(0, 2).toUpperCase();

            return (
              <div key={item.id} className="flex gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${color}`}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 leading-relaxed">
                    {buildText(item)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {dayjs(item.createdAt).fromNow()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
