"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Tag, FileText, Building2, ChevronRight, Share2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Role } from "@lms/types";

const SETTINGS_SECTIONS = [
  {
    href: "/settings/courses",
    icon: BookOpen,
    label: "Courses",
    description: "Manage programs and courses",
  },
  {
    href: "/settings/sources",
    icon: Tag,
    label: "Lead Sources",
    description: "Manage lead source types",
  },
  {
    href: "/settings/documents",
    icon: FileText,
    label: "Document Types",
    description: "Required document categories",
  },
  {
    href: "/settings/branches",
    icon: Building2,
    label: "Branches",
    description: "Office locations",
    adminOnly: true,
  },
  {
    href: "/settings/meta",
    icon: Share2,
    label: "Meta Integration",
    description: "Facebook Lead Forms & WhatsApp lead capture",
    adminOnly: true,
  },
];
// No role restriction needed — only ADMIN can reach /settings from sidebar

export default function SettingsPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role === Role.EMPLOYEE) router.replace("/dashboard");
  }, [user, router]);

  const sections = SETTINGS_SECTIONS.filter(
    (s) => !s.adminOnly || user?.role === Role.ADMIN,
  );

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage system configuration
        </p>
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="flex items-center gap-4 p-4 bg-white border border-surface-200 rounded-xl hover:border-primary hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon size={18} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">
                  {section.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {section.description}
                </p>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
