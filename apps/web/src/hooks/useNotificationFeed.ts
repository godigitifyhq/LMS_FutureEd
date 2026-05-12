import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useState, useEffect } from "react";

const LAST_SEEN_KEY = "lms_notifications_last_seen";

export type NotificationItem = {
  id: string;
  type: "interaction" | "assignment";
  message: string;
  leadId: string;
  studentName: string;
  createdAt: string;
  isRead: boolean;
};

type NotificationSource = {
  type?: string;
  user?: { name?: string };
  assignedBy?: { name?: string };
  lead?: { studentName?: string };
  statusAfter?: string;
};

function buildMessage(
  item: NotificationSource,
  type: "interaction" | "assignment",
): string {
  if (type === "assignment") {
    return `${item.assignedBy?.name} assigned ${item.lead?.studentName} to you`;
  }
  switch (item.type) {
    case "STATUS_CHANGED":
      return `${item.user?.name} moved ${item.lead?.studentName} → ${item.statusAfter?.replace(/_/g, " ")}`;
    case "CALL":
      return `${item.user?.name} logged a call with ${item.lead?.studentName}`;
    case "NOTE":
      return `${item.user?.name} added a note on ${item.lead?.studentName}`;
    default:
      return `${item.user?.name} updated ${item.lead?.studentName}`;
  }
}

export function useNotificationFeed() {
  const [lastSeen, setLastSeen] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem(LAST_SEEN_KEY) ?? 0);
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["notification-feed"],
    queryFn: async () => {
      const { data } = await api.get("/activity/notifications");
      return data.data;
    },
    refetchInterval: 30_000,
  });

  const items: NotificationItem[] = [];

  if (data) {
    for (const item of data.interactions ?? []) {
      items.push({
        id: `i-${item.id}`,
        type: "interaction",
        message: buildMessage(item, "interaction"),
        leadId: item.lead?.id,
        studentName: item.lead?.studentName,
        createdAt: item.createdAt,
        isRead: new Date(item.createdAt).getTime() <= lastSeen,
      });
    }

    for (const item of data.assignments ?? []) {
      items.push({
        id: `a-${item.id}`,
        type: "assignment",
        message: buildMessage(item, "assignment"),
        leadId: item.lead?.id,
        studentName: item.lead?.studentName,
        createdAt: item.createdAt,
        isRead: new Date(item.createdAt).getTime() <= lastSeen,
      });
    }
  }

  // Sort by date
  items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const unreadCount = items.filter((i) => !i.isRead).length;

  function markAllRead() {
    const now = Date.now();
    localStorage.setItem(LAST_SEEN_KEY, String(now));
    setLastSeen(now);
  }

  return {
    items: items.slice(0, 20),
    unreadCount,
    isLoading,
    markAllRead,
    refetch,
  };
}
