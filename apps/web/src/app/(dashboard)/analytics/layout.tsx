"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { Role } from "@lms/types";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Trophy,
  Phone,
  TrendingUp,
  CheckSquare,
  Copy,
  BarChart3,
} from "lucide-react";

const TABS = [
  { label: "Overview",       href: "/analytics",              icon: LayoutDashboard },
  { label: "Leaderboard",    href: "/analytics/leaderboard",  icon: Trophy },
  { label: "Calls",          href: "/analytics/calls",         icon: Phone },
  { label: "Conversions",    href: "/analytics/conversions",   icon: TrendingUp },
  { label: "Lead Pipeline",  href: "/analytics/pipeline",      icon: BarChart3 },
  { label: "Tasks",          href: "/analytics/tasks",         icon: CheckSquare },
  { label: "Duplicates",     href: "/analytics/duplicates",    icon: Copy },
] as const;

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (user && user.role === Role.EMPLOYEE) router.replace("/dashboard");
  }, [user, router]);

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Tab navigation */}
      <div className="bg-white border-b border-surface-200 sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-1 overflow-x-auto scrollbar-none py-1">
            {TABS.map(({ label, href, icon: Icon }) => {
              const active =
                href === "/analytics"
                  ? pathname === "/analytics"
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0",
                    active
                      ? "bg-primary text-white"
                      : "text-gray-500 hover:bg-surface-100 hover:text-gray-800",
                  )}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </div>
    </div>
  );
}
