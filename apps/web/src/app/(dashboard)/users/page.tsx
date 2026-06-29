"use client";

import { useState, useEffect } from "react";
import type { ComponentProps } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, UserX, UserCheck, Key } from "lucide-react";
import {
  useUsers,
  useDeactivateUser,
  useActivateUser,
  useResetUserPassword,
} from "@/hooks/useUsers";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Role } from "@lms/types";
import { getInitials, formatDate } from "@/lib/utils";
import api from "@/lib/api";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

const ROLE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  ADMIN: { label: "Admin", variant: "primary" },
  SUB_ADMIN: { label: "Sub Admin", variant: "info" },
  EMPLOYEE: { label: "Employee", variant: "gray" },
};

type DeactivatePreview = {
  leadsToUnassign: number;
  confirmedLeadsKept: number;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  branch?: { name?: string | null } | null;
  isActive: boolean;
  createdAt: string;
  stats?: {
    assignedLeads?: number | null;
    confirmedLeads?: number | null;
  } | null;
};

export default function UsersPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [filters, setFilters] = useState({
    search: "",
    role: "",
    isActive: "",
    page: 1,
  });
  const [resetModal, setResetModal] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deactivateModal, setDeactivateModal] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deactivatePreview, setDeactivatePreview] =
    useState<DeactivatePreview | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Redirect non-managers
  useEffect(() => {
    if (user && user.role === Role.EMPLOYEE) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const { data, isLoading } = useUsers({
    search: filters.search || undefined,
    role: filters.role || undefined,
    isActive: filters.isActive === "" ? undefined : filters.isActive === "true",
    page: filters.page,
  });

  const deactivate = useDeactivateUser();
  const activate = useActivateUser();
  const resetPassword = useResetUserPassword();

  async function handleDeactivateClick(id: string, name: string) {
    setDeactivateModal({ id, name });
    try {
      const { data } = await api.get(`/users/${id}/deactivate-preview`);
      setDeactivatePreview(data.data);
    } catch {
      setDeactivatePreview(null);
    }
  }

  async function handleDeactivateConfirm() {
    if (!deactivateModal) return;
    await deactivate.mutateAsync(deactivateModal.id);
    setDeactivateModal(null);
    setDeactivatePreview(null);
  }

  async function handleResetPassword() {
    if (!resetModal || !newPassword || newPassword.length < 8) return;
    await resetPassword.mutateAsync({ id: resetModal.id, newPassword });
    setResetModal(null);
    setNewPassword("");
  }

  const users = (data?.users ?? []) as UserRow[];
  const total = data?.total ?? 0;
  const pageSize = 20;

  if (!user || user.role === Role.EMPLOYEE) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total users</p>
        </div>
        <Link href="/users/new">
          <Button>
            <Plus size={15} />
            Add Employee
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border border-surface-200 rounded-xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            placeholder="Search by name or email..."
            value={filters.search}
            onChange={(e) =>
              setFilters((p) => ({ ...p, search: e.target.value, page: 1 }))
            }
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary"
          />
        </div>

        <select
          value={filters.role}
          onChange={(e) =>
            setFilters((p) => ({ ...p, role: e.target.value, page: 1 }))
          }
          aria-label="Role"
          title="Role"
          className="px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white"
        >
          <option value="">All Roles</option>
          <option value="EMPLOYEE">Employee</option>
          <option value="SUB_ADMIN">Sub Admin</option>
          {user.role === Role.ADMIN && <option value="ADMIN">Admin</option>}
        </select>

        <select
          value={filters.isActive}
          onChange={(e) =>
            setFilters((p) => ({ ...p, isActive: e.target.value, page: 1 }))
          }
          aria-label="Status"
          title="Status"
          className="px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <Spinner />
      ) : users.length === 0 ? (
        <EmptyState
          title="No users found"
          description="Try adjusting your filters or add a new employee"
        />
      ) : (
        <>
          <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50">
                    {[
                      "Employee",
                      "Role",
                      "Branch",
                      "Status",
                      "Leads",
                      "Confirmed",
                      "Joined",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {users.map((u) => {
                    const roleBadge = ROLE_BADGE[u.role];
                    return (
                      <tr key={u.id} className="hover:bg-surface-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-primary">
                                {getInitials(u.name)}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">
                                {u.name}
                              </p>
                              <p className="text-xs text-gray-400">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {roleBadge && (
                            <Badge variant={roleBadge.variant}>
                              {roleBadge.label}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {u.branch?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={u.isActive ? "success" : "gray"}>
                            {u.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {u.stats?.assignedLeads ?? 0}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-600">
                          {u.stats?.confirmedLeads ?? 0}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {formatDate(u.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                setResetModal({ id: u.id, name: u.name })
                              }
                              className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-50 rounded-lg transition-colors"
                              title="Reset Password"
                            >
                              <Key size={14} />
                            </button>
                            {user.role === Role.ADMIN &&
                              (u.isActive ? (
                                <button
                                  onClick={() =>
                                    void handleDeactivateClick(u.id, u.name)
                                  }
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Deactivate"
                                >
                                  <UserX size={14} />
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    void activate.mutateAsync(u.id)
                                  }
                                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Activate"
                                >
                                  <UserCheck size={14} />
                                </button>
                              ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            page={filters.page}
            pageSize={pageSize}
            total={total}
            totalPages={Math.ceil(total / pageSize)}
            onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
            onPageSizeChange={() => {}}
          />
        </>
      )}

      {/* Reset Password Modal */}
      <Modal
        open={!!resetModal}
        onClose={() => {
          setResetModal(null);
          setNewPassword("");
        }}
        title={`Reset Password — ${resetModal?.name}`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setResetModal(null);
                setNewPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleResetPassword()}
              loading={resetPassword.isPending}
              disabled={newPassword.length < 8}
            >
              Reset & Notify
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Set a new password for this employee. They will be notified via
            email.
          </p>
          <Input
            label="New Password"
            type="password"
            placeholder="Minimum 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText="Must include uppercase, lowercase, number, and special character"
          />
        </div>
      </Modal>

      {/* Deactivate Modal */}
      <Modal
        open={!!deactivateModal}
        onClose={() => {
          setDeactivateModal(null);
          setDeactivatePreview(null);
        }}
        title="Deactivate User"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDeactivateModal(null);
                setDeactivatePreview(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleDeactivateConfirm()}
              loading={deactivate.isPending}
            >
              Confirm Deactivate
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Are you sure you want to deactivate{" "}
            <strong>{deactivateModal?.name}</strong>?
          </p>
          {deactivatePreview && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 space-y-1">
              <p className="font-semibold">This will:</p>
              <p>• Invalidate all active sessions immediately</p>
              <p>
                • Unassign <strong>{deactivatePreview.leadsToUnassign}</strong>{" "}
                active leads
              </p>
              {deactivatePreview.confirmedLeadsKept > 0 && (
                <p>
                  • Keep <strong>{deactivatePreview.confirmedLeadsKept}</strong>{" "}
                  confirmed leads as-is
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
