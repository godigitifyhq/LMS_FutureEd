"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  X,
  CheckCheck,
  ArrowRightLeft,
  Phone,
  MessageSquare,
  UserCheck,
} from "lucide-react";
import { useNotificationFeed } from "@/hooks/useNotificationFeed";
import { formatTimeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, React.ElementType> = {
  STATUS_CHANGED: ArrowRightLeft,
  CALL: Phone,
  NOTE: MessageSquare,
  assignment: UserCheck,
};

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { items, unreadCount, isLoading, markAllRead } = useNotificationFeed();

  function handleClick(item: { leadId: string }) {
    setOpen(false);
    router.push(`/leads/${item.leadId}`);
  }

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-surface-100 rounded-lg transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-10 z-50 w-80 bg-white border border-surface-200 rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-gray-600" />
                <span className="text-sm font-semibold text-gray-800">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="bg-primary text-white text-xs px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                  >
                    <CheckCheck size={12} />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Close"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-96">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-10">
                  <Bell size={24} className="text-surface-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No notifications yet.</p>
                </div>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleClick(item)}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-50 transition-colors border-b border-surface-100 last:border-0",
                      !item.isRead && "bg-primary-50",
                    )}
                  >
                    {/* Unread dot */}
                    <div className="flex-shrink-0 mt-1">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          !item.isRead ? "bg-primary" : "bg-transparent",
                        )}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-relaxed">
                        {item.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatTimeAgo(item.createdAt)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
