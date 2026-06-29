"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Search,
  Key,
  UserX,
  UserCheck,
  CheckSquare,
  Building2,
  Pencil,
} from "lucide-react";
import {
  useUsers,
  useDeactivateUser,
  useActivateUser,
  useResetUserPassword,
} from "@/hooks/useUsers";
import { useBranches } from "@/hooks/useBranches";
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
import { useNotifications } from "@/store/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { User, Branch } from "@lms/types";

interface UserWithStats extends Omit<User, "branchId" | "updatedAt"> {
  branch?: Pick<Branch, "id" | "name" | "city"> | null;
  stats?: {
    assignedLeads: number;
    confirmedLeads: number;
  };
}

interface UsersListResponse {
  users: UserWithStats[];
  total: number;
}

const ROLE_BADGE: Record<
  string,
  { label: string; variant: "primary" | "info" | "gray" }
> = {
  ADMIN: { label: "Admin", variant: "primary" },
  SUB_ADMIN: { label: "Sub Admin", variant: "info" },
  EMPLOYEE: { label: "Employee", variant: "gray" },
};

interface DeactivatePreview {
  leadsToUnassign: number;
  confirmedLeadsKept: number;
}

export default function EmployeesPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const { success, error: notifyError } = useNotifications();

  // Filters
  const [filters, setFilters] = useState({
    search: "",
    role: "",
    isActive: "",
    page: 1,
  });

  // Single-row modals
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
  const [editModal, setEditModal] = useState<{
    id: string;
    name: string;
    phone: string;
    role: string;
  } | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<
    "activate" | "deactivate" | "branch" | null
  >(null);
  const [bulkBranchId, setBulkBranchId] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    if (user && user.role === Role.EMPLOYEE) router.replace("/dashboard");
  }, [user, router]);

  const { data: usersData, isLoading } = useUsers({
    search: filters.search || undefined,
    role: filters.role || undefined,
    isActive: filters.isActive === "" ? undefined : filters.isActive === "true",
    page: filters.page,
  }) as { data: UsersListResponse | undefined; isLoading: boolean };

  const { data: branchesData } = useBranches() as {
    data: Branch[] | undefined;
  };
  const deactivate = useDeactivateUser();
  const activate = useActivateUser();
  const resetPassword = useResetUserPassword();

  const users = usersData?.users ?? [];
  const total = usersData?.total ?? 0;
  const branches = branchesData ?? [];
  const pageSize = 20;
  const allSelected = users.length > 0 && selected.size === users.length;

  // ── Selection helpers ──
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(users.map((u: { id: string }) => u.id)));
  }

  // ── Single row deactivate preview ──
  async function handleDeactivateClick(id: string, name: string) {
    setDeactivateModal({ id, name });
    try {
      const { data } = await api.get(`/users/${id}/deactivate-preview`);
      setDeactivatePreview(data.data);
    } catch {
      setDeactivatePreview(null);
    }
  }

  // ── Bulk operations ──
  async function handleBulkActivate() {
    setBulkLoading(true);
    let ok = 0;
    for (const id of selected) {
      try {
        await api.post(`/users/${id}/activate`);
        ok++;
      } catch {}
    }
    success(`${ok} employee${ok !== 1 ? "s" : ""} activated`);
    setSelected(new Set());
    setBulkAction(null);
    void qc.invalidateQueries({ queryKey: ["users"] });
    setBulkLoading(false);
  }

  async function handleBulkDeactivate() {
    setBulkLoading(true);
    let ok = 0;
    for (const id of selected) {
      try {
        await api.post(`/users/${id}/deactivate`);
        ok++;
      } catch {}
    }
    success(`${ok} employee${ok !== 1 ? "s" : ""} deactivated`);
    setSelected(new Set());
    setBulkAction(null);
    void qc.invalidateQueries({ queryKey: ["users"] });
    setBulkLoading(false);
  }

  async function handleBulkBranchChange() {
    if (!bulkBranchId) return;
    setBulkLoading(true);
    let ok = 0;
    for (const id of selected) {
      try {
        await api.patch(`/users/${id}`, { branchId: bulkBranchId });
        ok++;
      } catch {}
    }
    success(`${ok} employee${ok !== 1 ? "s" : ""} moved to new branch`);
    setSelected(new Set());
    setBulkAction(null);
    setBulkBranchId("");
    void qc.invalidateQueries({ queryKey: ["users"] });
    setBulkLoading(false);
  }

  async function handleEditSave() {
    if (!editModal) return;
    setEditLoading(true);
    try {
      await api.patch(`/users/${editModal.id}`, {
        name: editModal.name.trim(),
        phone: editModal.phone.trim() || undefined,
        role: editModal.role || undefined,
      });
      success("Employee updated");
      setEditModal(null);
      // Invalidate ALL cached queries — a name change appears in lead lists,
      // interaction timelines, assignment dropdowns, dashboards, etc.
      void qc.invalidateQueries();
    } catch {
      notifyError("Failed to update employee", "Please try again");
    } finally {
      setEditLoading(false);
    }
  }

  if (!user || user.role === Role.EMPLOYEE) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} total staff members
          </p>
        </div>
        <Link href="/employees/new">
          <Button>
            <Plus size={15} /> Add Employee
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
            placeholder="Search by name, email or phone..."
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
          className="px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white"
          aria-label="Filter by role"
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
          className="px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white"
          aria-label="Filter by status"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckSquare size={15} className="text-primary" />
            <span className="text-sm font-semibold text-primary">
              {selected.size} employee{selected.size > 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Activate — both admin and sub admin */}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setBulkAction("activate")}
            >
              <UserCheck size={13} />
              Bulk Activate
            </Button>

            {/* Deactivate — admin only */}
            {user.role === Role.ADMIN && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setBulkAction("deactivate")}
              >
                <UserX size={13} />
                Bulk Deactivate
              </Button>
            )}

            {/* Change branch — admin only */}
            {user.role === Role.ADMIN && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setBulkAction("branch")}
              >
                <Building2 size={13} />
                Change Branch
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <Spinner />
      ) : users.length === 0 ? (
        <EmptyState
          title="No employees found"
          description="Add your first employee to get started"
        />
      ) : (
        <>
          <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50">
                    {/* Bulk select checkbox */}
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="accent-primary w-4 h-4 cursor-pointer"
                        aria-label="Select all employees"
                      />
                    </th>
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
                  {users.map((u: UserWithStats) => {
                    const badge = ROLE_BADGE[u.role];
                    const isSelected = selected.has(u.id);

                    return (
                      <tr
                        key={u.id}
                        className={cn(
                          "hover:bg-surface-50 transition-colors",
                          isSelected && "bg-primary-50",
                        )}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(u.id)}
                            className="accent-primary w-4 h-4 cursor-pointer"
                            aria-label={`Select employee ${u.name}`}
                          />
                        </td>

                        {/* Employee info */}
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
                              {u.phone && (
                                <p className="text-xs text-gray-400">
                                  {u.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {badge && (
                            <Badge variant={badge.variant}>{badge.label}</Badge>
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

                        {/* Row actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setEditModal({
                                  id: u.id,
                                  name: u.name,
                                  phone: u.phone ?? "",
                                  role: u.role,
                                })
                              }
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Edit Employee"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
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
                                  type="button"
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
                                  type="button"
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

      {/* ── Single: Reset Password Modal ── */}
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
              onClick={() =>
                void resetPassword
                  .mutateAsync({ id: resetModal!.id, newPassword })
                  .then(() => {
                    setResetModal(null);
                    setNewPassword("");
                  })
              }
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
            The employee will be notified via email with their new password.
          </p>
          <Input
            label="New Password"
            type="password"
            placeholder="Minimum 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
      </Modal>

      {/* ── Single: Deactivate Modal ── */}
      <Modal
        open={!!deactivateModal}
        onClose={() => {
          setDeactivateModal(null);
          setDeactivatePreview(null);
        }}
        title="Deactivate Employee"
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
              onClick={() =>
                void deactivate.mutateAsync(deactivateModal!.id).then(() => {
                  setDeactivateModal(null);
                  setDeactivatePreview(null);
                })
              }
              loading={deactivate.isPending}
            >
              Confirm Deactivate
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Deactivate <strong>{deactivateModal?.name}</strong>?
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

      {/* ── Bulk: Activate Modal ── */}
      <Modal
        open={bulkAction === "activate"}
        onClose={() => setBulkAction(null)}
        title="Bulk Activate Employees"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulkAction(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleBulkActivate()}
              loading={bulkLoading}
            >
              Activate {selected.size} Employee{selected.size > 1 ? "s" : ""}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Activate{" "}
          <strong>
            {selected.size} selected employee{selected.size > 1 ? "s" : ""}
          </strong>
          ? Their accounts will be re-enabled immediately.
        </p>
      </Modal>

      {/* ── Bulk: Deactivate Modal ── */}
      <Modal
        open={bulkAction === "deactivate"}
        onClose={() => setBulkAction(null)}
        title="Bulk Deactivate Employees"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulkAction(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleBulkDeactivate()}
              loading={bulkLoading}
            >
              Deactivate {selected.size} Employee{selected.size > 1 ? "s" : ""}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Deactivate{" "}
            <strong>
              {selected.size} selected employee{selected.size > 1 ? "s" : ""}
            </strong>
            ?
          </p>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 space-y-1">
            <p className="font-semibold">For each employee this will:</p>
            <p>• Immediately invalidate all their active sessions</p>
            <p>• Unassign all their active leads (goes to unassigned pool)</p>
            <p>• Confirmed leads are preserved as-is</p>
          </div>
        </div>
      </Modal>

      {/* ── Bulk: Change Branch Modal ── */}
      <Modal
        open={bulkAction === "branch"}
        onClose={() => {
          setBulkAction(null);
          setBulkBranchId("");
        }}
        title="Change Branch"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setBulkAction(null);
                setBulkBranchId("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleBulkBranchChange()}
              loading={bulkLoading}
              disabled={!bulkBranchId}
            >
              Move {selected.size} Employee{selected.size > 1 ? "s" : ""}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Move{" "}
            <strong>
              {selected.size} selected employee{selected.size > 1 ? "s" : ""}
            </strong>{" "}
            to:
          </p>
          <div className="space-y-2">
            {branches.map((branch: Branch) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => setBulkBranchId(branch.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                  bulkBranchId === branch.id
                    ? "border-primary bg-primary-50"
                    : "border-surface-200 hover:border-primary-300",
                )}
                aria-label={`Select ${branch.name} branch${branch.city ? ` in ${branch.city}` : ""}`}
              >
                <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                  <Building2 size={14} className="text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-700">
                    {branch.name}
                  </p>
                  <p className="text-xs text-gray-400">{branch.city}</p>
                </div>
                {bulkBranchId === branch.id && (
                  <span className="text-primary text-xs font-bold">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* ── Edit Employee Modal ── */}
      <Modal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        title={`Edit Employee — ${editModal?.name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditModal(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleEditSave()}
              loading={editLoading}
              disabled={!editModal?.name.trim()}
            >
              Save Changes
            </Button>
          </>
        }
      >
        {editModal && (
          <div className="space-y-4">
            <Input
              label="Full Name"
              value={editModal.name}
              onChange={(e) => setEditModal((p) => p ? { ...p, name: e.target.value } : p)}
              placeholder="Employee full name"
            />
            <Input
              label="Phone"
              value={editModal.phone}
              onChange={(e) => setEditModal((p) => p ? { ...p, phone: e.target.value } : p)}
              placeholder="10-digit mobile number"
              inputMode="numeric"
              maxLength={10}
            />
            {user.role === Role.ADMIN && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                <select
                  value={editModal.role}
                  onChange={(e) => setEditModal((p) => p ? { ...p, role: e.target.value } : p)}
                  aria-label="Employee role"
                  className="w-full px-3 py-2.5 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white"
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="SUB_ADMIN">Sub Admin</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
