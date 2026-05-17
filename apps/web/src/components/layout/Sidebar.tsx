"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Upload,
  GraduationCap,
  Tag,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useLogout } from "@/hooks/useAuthMutations";
import { Role } from "@lms/types";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: Role[];
};

type Props = {
  onClose?: () => void;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: Users },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    roles: [Role.ADMIN, Role.SUB_ADMIN],
  },
  {
    label: "Import",
    href: "/import",
    icon: Upload,
    roles: [Role.ADMIN, Role.SUB_ADMIN],
  },
  {
    label: "Employees",
    href: "/employees",
    icon: Users,
    roles: [Role.ADMIN, Role.SUB_ADMIN],
  },
  // SUB_ADMIN gets Courses in sidebar (no Settings access)
  {
    label: "Courses",
    href: "/settings/courses",
    icon: GraduationCap,
    roles: [Role.SUB_ADMIN], // ← SUB_ADMIN only in sidebar
  },
  {
    label: "Lead Sources",
    href: "/settings/sources",
    icon: Tag,
    roles: [Role.SUB_ADMIN], // ← SUB_ADMIN only
  },
  // ADMIN has Settings which contains Courses inside
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: [Role.ADMIN], // ← ADMIN only
  },
];

export function Sidebar({ onClose }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user } = useAuthStore();
  const logout = useLogout();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  function handleLogout() {
    onClose?.();
    void logout.mutateAsync();
  }

  return (
    <aside
      className={cn(
        "relative flex flex-col bg-white border-r border-surface-200 transition-all duration-300",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-surface-200">
        <div className="shrink-0 w-8 h-8 rounded-lg overflow-hidden bg-white">
          <Image
            src="/logo.jpg"
            alt="Future Education Trust"
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
            priority
          />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold text-gray-900">Future Education</p>
            <p className="text-xs text-gray-500">LMS</p>
          </div>
        )}
      </div>

      {/* Branch label */}
      {!collapsed && user?.branch?.name && (
        <div className="px-4 py-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {user.branch.name}
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              {...(onClose ? { onClick: onClose } : {})}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:bg-surface-100 hover:text-gray-900",
              )}
            >
              <Icon
                size={18}
                className={cn(
                  "shrink-0",
                  isActive ? "text-white" : "text-gray-400",
                )}
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-surface-200 p-3">
        <div className="flex items-center gap-3">
          <div className="shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-primary-700 text-xs font-bold">
              {user?.name?.slice(0, 2).toUpperCase()}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">
                {user?.name}
              </p>
              <p className="text-xs text-primary capitalize">
                {user?.role?.toLowerCase().replace("_", " ")}
              </p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="shrink-0 p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
            aria-label="Logout"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 w-6 h-6 bg-white border border-surface-200 rounded-full flex items-center justify-center shadow-sm hover:bg-surface-50 transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight size={12} className="text-gray-500" />
        ) : (
          <ChevronLeft size={12} className="text-gray-500" />
        )}
      </button>
    </aside>
  );
}
