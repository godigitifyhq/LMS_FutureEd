"use client";

import { useState } from "react";
import { Copy, Check, RefreshCw, Zap, MessageSquare, FileText } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useMetaStatus, useMetaStats, useSyncMetaForm, useTestWhatsAppLead } from "@/hooks/useMeta";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useNotifications } from "@/store/notifications";

dayjs.extend(relativeTime);

// ── Status dot ────────────────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-green-500" : "bg-gray-300"}`}
    />
  );
}

// ── Copy button ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { success } = useNotifications();

  function copy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-200 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary transition-colors"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy URL"}
    </button>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────

function StatRow({
  label,
  form,
  wa,
  total,
}: {
  label: string;
  form: number;
  wa: number;
  total: number;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-surface-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1 text-[#0866FF]">
          <FileText size={11} />
          {form}
        </span>
        <span className="flex items-center gap-1 text-[#25D366]">
          <MessageSquare size={11} />
          {wa}
        </span>
        <span className="font-semibold text-gray-700">{total} total</span>
      </div>
    </div>
  );
}

// ── Field mapping guide ───────────────────────────────────────────────────

const FIELD_MAP = [
  { meta: "full_name / name / student_name", lms: "Student Name" },
  { meta: "first_name + last_name", lms: "Student Name (combined)" },
  { meta: "phone_number / mobile / phone / contact_number", lms: "Phone" },
  { meta: "email / email_address / email_id", lms: "Email" },
  { meta: "father_name / fathers_name / guardian_name", lms: "Father Name" },
  { meta: "city / location / current_city", lms: "City" },
  { meta: "state / state_name", lms: "State" },
  { meta: "course / interested_course / programme", lms: "Course (auto-matched)" },
  { meta: "qualification / highest_qualification", lms: "Qualification" },
];

// ── Main page ─────────────────────────────────────────────────────────────

export default function MetaIntegrationPage() {
  const { data: status, isLoading: statusLoading } = useMetaStatus();
  const { data: stats, isLoading: statsLoading } = useMetaStats();
  const syncForm = useSyncMetaForm();
  const testWa = useTestWhatsAppLead();

  const [syncModal, setSyncModal] = useState(false);
  const [formId, setFormId] = useState("");
  const [since, setSince] = useState("");

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin.replace("localhost:3000", "YOUR_API_URL")}/api/v1/meta/webhook`
      : "/api/v1/meta/webhook";

  // Use env-aware URL
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
  const webhookDisplayUrl = `${apiBase}/api/v1/meta/webhook`;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Meta Integration</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Facebook & Instagram lead capture — Instant Forms + Click-to-WhatsApp
        </p>
      </div>

      {/* Status cards */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Status
        </p>
        {statusLoading ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {/* Lead Forms */}
            <div className="bg-white border border-surface-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-[#0866FF]" />
                <span className="text-sm font-semibold text-gray-700">
                  Lead Forms
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <StatusDot ok={!!status?.leadForms.configured} />
                {status?.leadForms.configured ? "Connected" : "Not configured"}
              </div>
            </div>

            {/* WhatsApp */}
            <div className="bg-white border border-surface-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare size={15} className="text-[#25D366]" />
                <span className="text-sm font-semibold text-gray-700">
                  WhatsApp
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <StatusDot ok={!!status?.whatsapp.configured} />
                {status?.whatsapp.configured ? "Connected" : "Not configured"}
              </div>
              {status?.whatsapp.autoReplyEnabled && (
                <Badge variant="success" className="text-xs">Auto-reply ON</Badge>
              )}
            </div>

            {/* Webhook */}
            <div className="bg-white border border-surface-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-amber-500" />
                <span className="text-sm font-semibold text-gray-700">
                  Webhook
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <StatusDot ok={!!status?.webhook.verifyTokenSet} />
                {status?.webhook.verifyTokenSet ? "Token set" : "Token missing"}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <StatusDot ok={!!status?.webhook.appSecretSet} />
                {status?.webhook.appSecretSet ? "Secret set" : "Secret missing"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="bg-white border border-surface-200 rounded-xl p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Lead Stats
          <span className="ml-2 text-[#0866FF] font-normal normal-case">■ Form</span>
          <span className="ml-2 text-[#25D366] font-normal normal-case">■ WhatsApp</span>
        </p>
        {statsLoading ? (
          <Spinner />
        ) : stats ? (
          <div>
            <StatRow label="Today" form={stats.today.leadForm} wa={stats.today.whatsapp} total={stats.today.total} />
            <StatRow label="This Week" form={stats.thisWeek.leadForm} wa={stats.thisWeek.whatsapp} total={stats.thisWeek.total} />
            <StatRow label="This Month" form={stats.thisMonth.leadForm} wa={stats.thisMonth.whatsapp} total={stats.thisMonth.total} />
          </div>
        ) : (
          <p className="text-sm text-gray-400">No data yet</p>
        )}
      </div>

      {/* Webhook URL */}
      <div className="bg-white border border-surface-200 rounded-xl p-5 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Webhook URL
        </p>
        <p className="text-xs text-gray-500">
          Paste this URL in your Meta App dashboard for both WhatsApp and Lead Ads webhooks.
        </p>
        <div className="flex items-center gap-3">
          <code className="flex-1 text-xs bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-gray-700 truncate">
            {webhookDisplayUrl}
          </code>
          <CopyButton text={webhookDisplayUrl} />
        </div>
      </div>

      {/* Field mapping guide */}
      <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Meta Field Name Mapping
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Use these exact field names in your Meta Instant Form to auto-map to LMS fields.
          </p>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-100 bg-surface-50">
              <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Meta Field Name</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-500">LMS Field</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {FIELD_MAP.map((row) => (
              <tr key={row.lms} className="hover:bg-surface-50">
                <td className="px-4 py-2.5 font-mono text-[#0866FF]">{row.meta}</td>
                <td className="px-4 py-2.5 text-gray-600">{row.lms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Test + Tools */}
      <div className="bg-white border border-surface-200 rounded-xl p-5 space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Test & Tools
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => setSyncModal(true)}
          >
            <RefreshCw size={14} />
            Sync Form Leads
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              void testWa.mutateAsync({
                studentName: "Test Student",
                phone: "9876543210",
                message: "Mujhe BA admissions ke baare mein jankari chahiye",
              })
            }
            loading={testWa.isPending}
          >
            <MessageSquare size={14} />
            Test WhatsApp Lead
          </Button>
        </div>
      </div>

      {/* Recent leads */}
      {stats?.recentLeads && stats.recentLeads.length > 0 && (
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Recent Meta Leads
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 bg-surface-50">
                {["Student", "Source", "Assigned To", "When"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {stats.recentLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-surface-50">
                  <td className="px-4 py-3">
                    <a
                      href={`/leads/${lead.id}`}
                      className="font-medium text-gray-800 hover:text-primary transition-colors"
                    >
                      {lead.studentName}
                    </a>
                    <p className="text-xs text-gray-400">{lead.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    {lead.isFromWhatsApp ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                        <MessageSquare size={10} />
                        WhatsApp
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                        <FileText size={10} />
                        FB Form
                        {lead.metaAdName && (
                          <span className="text-blue-400 font-normal">
                            {" "}· {lead.metaAdName}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {lead.assignedTo?.name ?? (
                      <span className="text-amber-500">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {dayjs(lead.createdAt).fromNow()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sync form modal */}
      <Modal
        open={syncModal}
        onClose={() => setSyncModal(false)}
        title="Sync Meta Form Leads"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSyncModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                void syncForm
                  .mutateAsync({ formId, since: since || undefined })
                  .then(() => setSyncModal(false))
              }
              loading={syncForm.isPending}
              disabled={!formId.trim()}
            >
              <RefreshCw size={14} />
              Start Sync
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Form ID"
            required
            placeholder="e.g. 1234567890123456"
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
          />
          <Input
            label="Since (optional)"
            placeholder="Unix timestamp or leave blank for all"
            value={since}
            onChange={(e) => setSince(e.target.value)}
          />
          <p className="text-xs text-gray-400">
            Find the Form ID in Meta Ads Manager → Lead Ads → Forms Library.
            Leave "Since" blank to import all leads from this form.
          </p>
        </div>
      </Modal>
    </div>
  );
}
