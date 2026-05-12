"use client";

import { Menu, Bell } from "lucide-react";
import type { ComponentProps } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { getInitials } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Role } from "@lms/types";
import { useNotifications } from "@/store/notifications";
import { NotificationPanel } from "./NotificationPanel";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/leads": "Leads",
  "/leads/new": "New Lead",
  "/analytics": "Analytics",
  "/employees": "Employees",
  "/users": "Users",
  "/settings": "Settings",
  "/settings/courses": "Courses",
  "/settings/sources": "Lead Sources",
  "/settings/branches": "Branches",
  "/import": "Import",
  "/profile": "Profile",
};

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

const ROLE_BADGE: Record<Role, { label: string; variant: BadgeVariant }> = {
  [Role.ADMIN]: { label: "Admin", variant: "primary" },
  [Role.SUB_ADMIN]: { label: "Sub Admin", variant: "info" },
  [Role.EMPLOYEE]: { label: "Employee", variant: "gray" },
};

type Props = {
  onMenuClick: () => void;
};

export function Header({ onMenuClick }: Props) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { toasts, remove } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const title =
    PAGE_TITLES[pathname] ??
    (pathname.includes("/leads/") ? "Lead Detail" : "FutureEd LMS");

  const roleBadge = user ? ROLE_BADGE[user.role as Role] : null;

  return (
    <>
      <header className="h-16 bg-white border-b border-surface-200 flex items-center px-4 gap-4 shrink-0">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          title="Open menu"
          className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-surface-100 rounded-lg"
        >
          <Menu size={20} />
        </button>

        {/* Title */}
        <h1 className="text-base font-semibold text-gray-900 flex-1">
          {title}
        </h1>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <NotificationPanel />

          {/* User */}
          <Link href="/profile" className="flex items-center gap-2">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-gray-800">
                {user?.name}
              </p>
              {roleBadge && (
                <Badge variant={roleBadge.variant} className="text-xs">
                  {roleBadge.label}
                </Badge>
              )}
            </div>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">
                {getInitials(user?.name ?? "U")}
              </span>
            </div>
          </Link>
        </div>
      </header>
      {notificationsOpen && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            title="Close notifications"
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setNotificationsOpen(false)}
          />
          <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-white text-gray-900 shadow-2xl border-l border-surface-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-gray-500" />
                <h2 className="text-sm font-semibold">Notifications</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-xs text-primary hover:text-primary-700"
                  onClick={() => toasts.forEach((toast) => remove(toast.id))}
                >
                  Mark all read
                </button>
                <button
                  type="button"
                  aria-label="Close notifications"
                  title="Close"
                  className="text-gray-400 hover:text-gray-600"
                  onClick={() => setNotificationsOpen(false)}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="h-full overflow-y-auto pb-6">
              {toasts.length === 0 ? (
                <div className="px-5 py-6 text-sm text-gray-400">
                  No notifications yet.
                </div>
              ) : (
                <ul className="px-3 py-2 space-y-2">
                  {toasts.map((toast) => (
                    <li
                      key={toast.id}
                      className="rounded-lg bg-surface-50 border border-surface-200 px-4 py-3"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {toast.title}
                      </p>
                      {toast.message && (
                        <p className="text-xs text-gray-500 mt-1">
                          {toast.message}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
