"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Role } from "@lms/types";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { Button } from "@/components/ui/Button";
import { Download } from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role === Role.EMPLOYEE) router.replace("/dashboard");
  }, [user, router]);

  async function downloadExport(type: string, format: "csv" | "pdf") {
    try {
      const response = await api.get(`/analytics/export/${format}/${type}`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data as BlobPart]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-report.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
  }

  if (!user || user.role === Role.EMPLOYEE) return null;

  return (
    <div className="space-y-6">
      {/* Export bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Performance insights and reports
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void downloadExport("employees", "csv")}
          >
            <Download size={13} />
            Employee CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void downloadExport("confirmed", "csv")}
          >
            <Download size={13} />
            Confirmed CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void downloadExport("employees", "pdf")}
          >
            <Download size={13} />
            Employee PDF
          </Button>
        </div>
      </div>

      <AdminDashboard />
    </div>
  );
}
