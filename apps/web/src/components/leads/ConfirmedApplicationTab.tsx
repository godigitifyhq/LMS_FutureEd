"use client";

import { useRef, useState, useEffect } from "react";
import {
  Download,
  Save,
  Upload,
  FileText,
  Check,
  Eye,
  Send,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useConfirmedApplication,
  useUpdateConfirmedApplication,
} from "@/hooks/useLeadDetail";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { extractApiError } from "@/lib/utils";
import { LeadStatus, QualificationLevel, type Lead } from "@lms/types";

// ── Types ──────────────────────────────────────────────────────────────────

type FormState = {
  aadharNo: string;
  apaarId: string;
  gender: string;
  maritalStatus: string;
  fatherName: string;
  motherName: string;
  motherOccupation: string;
  motherIncome: string;
  fatherOccupation: string;
  fatherIncome: string;
  noOfSisters: string;
  noOfBrothers: string;
  nationality: string;
  religion: string;
  category: string;
  postalAddress: string;
  permanentAddress: string;
  permanentPhone: string;
  localGuardianName: string;
  localGuardianAddress: string;
  localGuardianPhone: string;
  bookingAmount: string;
  bookingCashDDNo: string;
  bookingBank: string;
  bookingDate: string;
  admissionAmount: string;
  admissionCashDDNo: string;
  admissionBank: string;
  admissionDate: string;
  duesAmount: string;
  dueDate: string;
  fileNumber: string;
  extraCurricular: string;
  authorisedBy: string;
  remarks: string;
};

type AcademicRow = {
  stream: string;
  institution: string;
  board: string;
  passingYear: string;
  percentage: string;
  grade: string;
};

type AcademicLevelKey =
  | "TENTH"
  | "TWELFTH"
  | "GRADUATION"
  | "POST_GRADUATION";

type ExamRow = {
  examName: string;
  rollNo: string;
  score: string;
  rank: string;
};

type Document = {
  id: string;
  documentType: { name: string };
  fileName: string;
  isVerified: boolean;
  fileUrl: string;
};

type AdmissionMode = "edit" | "view";

const QUAL_LEVELS = [
  { key: "TENTH", label: "Matric / X Std." },
  { key: "TWELFTH", label: "Inter / XII Std." },
  { key: "GRADUATION", label: "Graduation / Equivalent" },
  { key: "POST_GRADUATION", label: "PG / Equivalent" },
] as const;

const emptyAcademic: AcademicRow = {
  stream: "",
  institution: "",
  board: "",
  passingYear: "",
  percentage: "",
  grade: "",
};

const emptyForm: FormState = {
  aadharNo: "",
  apaarId: "",
  gender: "",
  maritalStatus: "",
  fatherName: "",
  motherName: "",
  motherOccupation: "",
  motherIncome: "",
  fatherOccupation: "",
  fatherIncome: "",
  noOfSisters: "",
  noOfBrothers: "",
  nationality: "Indian",
  religion: "",
  category: "",
  postalAddress: "",
  permanentAddress: "",
  permanentPhone: "",
  localGuardianName: "",
  localGuardianAddress: "",
  localGuardianPhone: "",
  bookingAmount: "",
  bookingCashDDNo: "",
  bookingBank: "",
  bookingDate: "",
  admissionAmount: "",
  admissionCashDDNo: "",
  admissionBank: "",
  admissionDate: "",
  duesAmount: "",
  dueDate: "",
  fileNumber: "",
  extraCurricular: "",
  authorisedBy: "",
  remarks: "",
};

function buildLeadAddress(lead: Lead): string {
  return [
    lead.village,
    lead.sector,
    lead.city,
    lead.district,
    lead.state,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(", ");
}

function mapQualificationToLevel(
  qualification: QualificationLevel | null,
): AcademicLevelKey | null {
  switch (qualification) {
    case QualificationLevel.TENTH:
      return "TENTH";
    case QualificationLevel.TWELFTH:
      return "TWELFTH";
    case QualificationLevel.GRADUATION:
      return "GRADUATION";
    case QualificationLevel.POST_GRADUATION:
      return "POST_GRADUATION";
    default:
      return null;
  }
}

function buildFormFromLead(lead: Lead): FormState {
  const address = buildLeadAddress(lead);

  return {
    ...emptyForm,
    gender: lead.gender ?? "",
    maritalStatus: lead.maritalStatus ?? "",
    fatherName: lead.fatherName ?? "",
    postalAddress: address,
    permanentAddress: address,
    permanentPhone: lead.phone ?? "",
  };
}

function buildAcademicFromLead(lead: Lead): Record<AcademicLevelKey, AcademicRow> {
  const nextAcademic: Record<AcademicLevelKey, AcademicRow> = {
    TENTH: { ...emptyAcademic },
    TWELFTH: { ...emptyAcademic },
    GRADUATION: { ...emptyAcademic },
    POST_GRADUATION: { ...emptyAcademic },
  };

  const mappedLevel = mapQualificationToLevel(lead.qualification);
  if (!mappedLevel) return nextAcademic;

  nextAcademic[mappedLevel] = {
    ...emptyAcademic,
    institution: lead.schoolCollege ?? "",
    board: lead.boardUniversity ?? "",
    passingYear: lead.passingYear ? String(lead.passingYear) : "",
    percentage: lead.percentage ? String(lead.percentage) : "",
  };

  return nextAcademic;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const displayValue = value.trim() || "—";

  if (readOnly) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {label}
        </label>
        <div className="w-full min-h-10 px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 text-sm text-gray-700 flex items-center">
          {displayValue}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      <input
        type={type}
        title={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}

function DocumentUploadSection({
  confirmedApplicationId,
  leadId,
  documents,
  readOnly = false,
}: {
  confirmedApplicationId: string;
  leadId: string;
  documents: Document[];
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: docTypes } = useQuery({
    queryKey: ["document-types"],
    queryFn: async () => {
      const { data } = await api.get("/settings/documents");
      return data.data as Array<{
        id: string;
        name: string;
        isRequired: boolean;
      }>;
    },
    staleTime: 5 * 60_000,
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedTypeId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data: uploadData } = await api.post(
        "/upload/document",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      await api.post(`/leads/${leadId}/confirmed/documents`, {
        documentTypeId: selectedTypeId,
        fileUrl: uploadData.data.url,
        fileName: file.name,
        confirmedApplicationId,
      });
      toast.success("Document uploaded");
      void qc.invalidateQueries({ queryKey: ["confirmed", leadId] });
      setSelectedTypeId("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setUploading(false);
    }
  }

  const uploadedNames = new Set(
    documents.map((d) => d.documentType?.name).filter(Boolean),
  );
  const requiredTypes = docTypes?.filter((t) => t.isRequired) ?? [];
  const pendingRequired = requiredTypes.filter(
    (t) => !uploadedNames.has(t.name),
  );

  return (
    <Section title="Documents">
      <div className="space-y-3">
        {pendingRequired.length > 0 && (
          <Badge variant="warning">
            {pendingRequired.length} required pending
          </Badge>
        )}
        {!readOnly && (
          <div className="flex gap-2">
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
              title="Select document type"
              className="flex-1 px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white"
            >
              <option value="">Select document type...</option>
              {docTypes?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isRequired ? " *" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => selectedTypeId && fileRef.current?.click()}
              disabled={!selectedTypeId || uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors"
            >
              <Upload size={14} />
              {uploading ? "Uploading..." : "Upload"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/jpg,image/png"
              title="Upload document file"
              onChange={(e) => void handleUpload(e)}
              className="hidden"
            />
          </div>
        )}

        {documents.length > 0 ? (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 bg-surface-50 rounded-lg border border-surface-200"
              >
                <div className="w-8 h-8 bg-white rounded-lg border border-surface-200 flex items-center justify-center shrink-0">
                  <FileText size={14} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {doc.fileName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {doc.documentType?.name}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {doc.isVerified ? (
                    <Badge variant="success">
                      <Check size={10} className="mr-1" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="warning">Pending</Badge>
                  )}
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-primary rounded-lg transition-colors"
                    title="View"
                  >
                    <Eye size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            No documents uploaded yet
          </p>
        )}

        {requiredTypes.length > 0 && (
          <div className="p-3 bg-surface-50 rounded-lg border border-surface-200">
            <p className="text-xs font-semibold text-gray-500 mb-2">
              Required Documents
            </p>
            <div className="space-y-1.5">
              {requiredTypes.map((t) => {
                const uploaded = documents.some(
                  (d) => d.documentType?.name === t.name,
                );
                return (
                  <div key={t.id} className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center shrink-0",
                        uploaded ? "bg-green-500" : "bg-surface-200",
                      )}
                    >
                      {uploaded && <Check size={10} className="text-white" />}
                    </div>
                    <span
                      className={cn(
                        "text-xs",
                        uploaded ? "text-green-700" : "text-gray-500",
                      )}
                    >
                      {t.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

type Props = {
  leadId: string;
  leadData?: Lead;
  leadStatus?: LeadStatus;
  mode?: AdmissionMode;
  confirmOnSave?: boolean;
};

export function ConfirmedApplicationTab({
  leadId,
  leadData,
  leadStatus,
  mode = "edit",
  confirmOnSave = false,
}: Props) {
  const { data: app, isLoading } = useConfirmedApplication(leadId, true);
  const updateApp = useUpdateConfirmedApplication(leadId);
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [academic, setAcademic] = useState<Record<string, AcademicRow>>({
    TENTH: { ...emptyAcademic },
    TWELFTH: { ...emptyAcademic },
    GRADUATION: { ...emptyAcademic },
    POST_GRADUATION: { ...emptyAcademic },
  });
  const [exams, setExams] = useState<ExamRow[]>([
    { examName: "", rollNo: "", score: "", rank: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(mode === "edit");

  const isInterested = leadStatus === LeadStatus.INTERESTED;
  const readOnly = mode === "view" && !isEditing;

  useEffect(() => {
    setIsEditing(mode === "edit");
  }, [mode, leadId]);

  useEffect(() => {
    if (app) {
      setForm({
        aadharNo: app.aadharNo ?? "",
        apaarId: app.apaarId ?? "",
        gender: ((app as Record<string, unknown>)["gender"] as string) ?? "",
        maritalStatus:
          ((app as Record<string, unknown>)["maritalStatus"] as string) ?? "",
        fatherName:
          ((app as Record<string, unknown>)["fatherName"] as string) ?? "",
        motherName: app.motherName ?? "",
        motherOccupation: app.motherOccupation ?? "",
        motherIncome: String(app.motherIncome ?? ""),
        fatherOccupation: app.fatherOccupation ?? "",
        fatherIncome: String(app.fatherIncome ?? ""),
        noOfSisters: String(app.noOfSisters ?? ""),
        noOfBrothers: String(app.noOfBrothers ?? ""),
        nationality: app.nationality ?? "Indian",
        religion: app.religion ?? "",
        category: app.category ?? "",
        postalAddress:
          ((app as Record<string, unknown>)["postalAddress"] as string) ?? "",
        permanentAddress: app.permanentAddress ?? "",
        permanentPhone: app.permanentPhone ?? "",
        localGuardianName: app.localGuardianName ?? "",
        localGuardianAddress: app.localGuardianAddress ?? "",
        localGuardianPhone: app.localGuardianPhone ?? "",
        bookingAmount: String(app.bookingAmount ?? ""),
        bookingCashDDNo: app.bookingCashDDNo ?? "",
        bookingBank: app.bookingBank ?? "",
        bookingDate: app.bookingDate
          ? (String(app.bookingDate).split("T")[0] ?? "")
          : "",
        admissionAmount: String(app.admissionAmount ?? ""),
        admissionCashDDNo: app.admissionCashDDNo ?? "",
        admissionBank: app.admissionBank ?? "",
        admissionDate: app.admissionDate
          ? (String(app.admissionDate).split("T")[0] ?? "")
          : "",
        duesAmount: String(app.duesAmount ?? ""),
        dueDate: app.dueDate ? (String(app.dueDate).split("T")[0] ?? "") : "",
        fileNumber: app.fileNumber ?? "",
        extraCurricular: app.extraCurricular ?? "",
        authorisedBy: app.authorisedBy ?? "",
        remarks: app.remarks ?? "",
      });

      const nextAcademic = {
        TENTH: { ...emptyAcademic },
        TWELFTH: { ...emptyAcademic },
        GRADUATION: { ...emptyAcademic },
        POST_GRADUATION: { ...emptyAcademic },
      };

      if (app.academicRecords?.length) {
        for (const rec of app.academicRecords as any[]) {
          if (nextAcademic[rec.level as keyof typeof nextAcademic]) {
            nextAcademic[rec.level as keyof typeof nextAcademic] = {
              stream: rec.stream ?? "",
              institution: rec.institution ?? "",
              board: rec.board ?? "",
              passingYear: String(rec.passingYear ?? ""),
              percentage: String(rec.percentage ?? ""),
              grade: rec.grade ?? "",
            };
          }
        }
      }
      setAcademic(nextAcademic);

      if (app.entranceExams?.length) {
        setExams(
          (app.entranceExams as any[]).map((e) => ({
            examName: e.examName ?? "",
            rollNo: e.rollNo ?? "",
            score: e.score ?? "",
            rank: String(e.rank ?? ""),
          })),
        );
      } else {
        setExams([{ examName: "", rollNo: "", score: "", rank: "" }]);
      }
      return;
    }

    if (!leadData) return;

    setForm(buildFormFromLead(leadData));
    setAcademic(buildAcademicFromLead(leadData));
    setExams([{ examName: "", rollNo: "", score: "", rank: "" }]);
  }, [app, leadData]);

  function f(field: keyof FormState) {
    return {
      value: form[field],
      onChange: (v: string) => setForm((p) => ({ ...p, [field]: v })),
      readOnly,
    };
  }

  async function persist(confirmAfterSave: boolean) {
    const payload: Record<string, unknown> = {
      ...form,
      motherIncome: form.motherIncome ? Number(form.motherIncome) : undefined,
      fatherIncome: form.fatherIncome ? Number(form.fatherIncome) : undefined,
      noOfSisters: form.noOfSisters ? Number(form.noOfSisters) : undefined,
      noOfBrothers: form.noOfBrothers ? Number(form.noOfBrothers) : undefined,
      bookingAmount: form.bookingAmount
        ? Number(form.bookingAmount)
        : undefined,
      admissionAmount: form.admissionAmount
        ? Number(form.admissionAmount)
        : undefined,
      duesAmount: form.duesAmount ? Number(form.duesAmount) : undefined,
      bookingDate: form.bookingDate || undefined,
      admissionDate: form.admissionDate || undefined,
      dueDate: form.dueDate || undefined,
    };

    await updateApp.mutateAsync(payload);

    const academicRecords = Object.entries(academic)
      .filter(([, r]) => r.institution || r.board || r.percentage)
      .map(([level, r]) => ({
        level,
        stream: r.stream || undefined,
        institution: r.institution || undefined,
        board: r.board || undefined,
        passingYear: r.passingYear ? Number(r.passingYear) : undefined,
        percentage: r.percentage ? Number(r.percentage) : undefined,
        grade: r.grade || undefined,
      }));
    await api.post(`/leads/${leadId}/confirmed/academic`, {
      records: academicRecords,
    });

    const examRecords = exams
      .filter((e) => e.examName)
      .map((e) => ({
        examName: e.examName,
        rollNo: e.rollNo || undefined,
        score: e.score || undefined,
        rank: e.rank ? Number(e.rank) : undefined,
      }));
    await api.post(`/leads/${leadId}/confirmed/exams`, { exams: examRecords });

    if (confirmAfterSave) {
      await api.post(`/leads/${leadId}/send-admission`);
      void qc.invalidateQueries({ queryKey: ["lead", leadId] });
    }

    void qc.invalidateQueries({ queryKey: ["confirmed", leadId] });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await persist(mode === "edit" ? confirmOnSave : false);
      toast.success(
        confirmOnSave ? "Application saved and confirmed" : "Form saved",
      );
      if (mode === "view") {
        setIsEditing(false);
      }
    } catch (e) {
      toast.error(extractApiError(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleExportPDF() {
    setPdfLoading(true);
    try {
      const response = await api.get(`/leads/${leadId}/confirmed/pdf`, {
        responseType: "arraybuffer",
      });
      const blob = new Blob([response.data as ArrayBuffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `admission-form.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("PDF downloaded");
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 bg-surface-100 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-gray-800">
            Admission Application
          </h3>
          {readOnly ? (
            <span className="text-xs rounded-full px-2 py-0.5 border border-surface-200 text-gray-500 bg-surface-50">
              Read only
            </span>
          ) : (
            <span className="text-xs rounded-full px-2 py-0.5 border border-primary-200 text-primary bg-primary-50">
              Editing
            </span>
          )}
          {isInterested && !readOnly && (
            <span className="text-xs rounded-full px-2 py-0.5 border border-amber-200 text-amber-700 bg-amber-50">
              Will confirm on save
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void handleExportPDF()}
          disabled={pdfLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-200 text-sm text-gray-600 hover:border-primary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pdfLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          {pdfLoading ? "Generating..." : "Export PDF"}
        </button>
      </div>

      {/* Application reference fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg border border-surface-200 bg-surface-50">
        <Field
          label="File Number"
          placeholder="e.g. 1/2026"
          {...f("fileNumber")}
        />
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Admission ID</p>
          {app?.admissionId ? (
            <div className="w-full min-h-10 px-3 py-2 rounded-lg border border-surface-200 bg-white text-sm font-bold text-primary flex items-center tracking-wide">
              {app.admissionId}
            </div>
          ) : (
            <div className="w-full min-h-10 px-3 py-2 rounded-lg border border-surface-200 bg-white text-sm text-gray-400 flex items-center">
              Auto-generated on confirm
            </div>
          )}
        </div>
      </div>

      {/* Identity */}
      <Section title="Identity Documents">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Aadhar Number"
            placeholder="12-digit Aadhar"
            {...f("aadharNo")}
          />
          <Field
            label="Apaar / ABC ID"
            placeholder="Apaar ID"
            {...f("apaarId")}
          />
        </div>
      </Section>

      <Section title="Personal Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Gender
            </label>
            {readOnly ? (
              <div className="w-full min-h-10 px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 text-sm text-gray-700 flex items-center">
                {form.gender || "—"}
              </div>
            ) : (
              <select
                value={form.gender}
                onChange={(e) =>
                  setForm((p) => ({ ...p, gender: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white"
                aria-label="Gender"
                title="Gender"
              >
                <option value="">Select gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Marital Status
            </label>
            {readOnly ? (
              <div className="w-full min-h-10 px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 text-sm text-gray-700 flex items-center">
                {form.maritalStatus || "—"}
              </div>
            ) : (
              <select
                value={form.maritalStatus}
                onChange={(e) =>
                  setForm((p) => ({ ...p, maritalStatus: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary bg-white"
                aria-label="Marital status"
                title="Marital status"
              >
                <option value="">Select marital status</option>
                <option value="SINGLE">Single</option>
                <option value="MARRIED">Married</option>
              </select>
            )}
          </div>
        </div>
      </Section>

      {/* Family */}
      <Section title="Family Background">
        <div className="space-y-4">
          {/* Father */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-surface-100">
            <Field
              label="Father's Name"
              placeholder="Father's full name"
              {...f("fatherName")}
            />
            <Field label="Father's Occupation" {...f("fatherOccupation")} />
            <Field
              label="Father's Annual Income (₹)"
              type="number"
              {...f("fatherIncome")}
            />
          </div>
          {/* Mother */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-surface-100">
            <Field label="Mother's Name" {...f("motherName")} />
            <Field label="Mother's Occupation" {...f("motherOccupation")} />
            <Field
              label="Mother's Annual Income (₹)"
              type="number"
              {...f("motherIncome")}
            />
          </div>
          {/* Other */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="No. of Sisters"
                type="number"
                {...f("noOfSisters")}
              />
              <Field
                label="No. of Brothers"
                type="number"
                {...f("noOfBrothers")}
              />
            </div>
            <Field label="Nationality" {...f("nationality")} />
            <Field label="Religion" {...f("religion")} />
            <Field
              label="Category"
              placeholder="General / OBC / SC / ST"
              {...f("category")}
            />
          </div>
        </div>
      </Section>

      {/* Addresses */}
      <Section title="Addresses">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Postal Address
            </label>
            {readOnly ? (
              <div className="w-full min-h-14 px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 text-sm text-gray-700 whitespace-pre-wrap">
                {(form.postalAddress ?? "").trim() || "—"}
              </div>
            ) : (
              <textarea
                title="Postal Address"
                placeholder="Enter current / postal address"
                value={form.postalAddress ?? ""}
                rows={2}
                onChange={(e) =>
                  setForm((p) => ({ ...p, postalAddress: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary resize-none"
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Permanent Address
            </label>
            {readOnly ? (
              <div className="w-full min-h-14 px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 text-sm text-gray-700 whitespace-pre-wrap">
                {form.permanentAddress.trim() || "—"}
              </div>
            ) : (
              <textarea
                title="Permanent Address"
                placeholder="Enter permanent address"
                value={form.permanentAddress}
                rows={2}
                onChange={(e) =>
                  setForm((p) => ({ ...p, permanentAddress: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary resize-none"
              />
            )}
          </div>
          <Field label="Permanent Phone" {...f("permanentPhone")} />
          <Field label="Local Guardian's Name" {...f("localGuardianName")} />
          <Field label="Local Guardian's Phone" {...f("localGuardianPhone")} />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Local Guardian&apos;s Address
            </label>
            {readOnly ? (
              <div className="w-full min-h-14 px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 text-sm text-gray-700 whitespace-pre-wrap">
                {form.localGuardianAddress.trim() || "—"}
              </div>
            ) : (
              <textarea
                title="Local Guardian's Address"
                placeholder="Enter local guardian's address"
                value={form.localGuardianAddress}
                rows={2}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    localGuardianAddress: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary resize-none"
              />
            )}
          </div>
        </div>
      </Section>

      {/* Academic Record */}
      <Section title="Academic Record">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-50">
                {[
                  "Level",
                  "Stream/Subjects",
                  "Institution",
                  "Board/University",
                  "Year",
                  "Marks%",
                  "Grade",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left font-semibold text-gray-500 border border-surface-200"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {QUAL_LEVELS.map(({ key, label }) => {
                const rec = academic[key]!;
                return (
                  <tr key={key}>
                    <td className="px-3 py-2 border border-surface-200 font-medium text-gray-700 whitespace-nowrap bg-surface-50">
                      {label}
                    </td>
                    {(
                      [
                        "stream",
                        "institution",
                        "board",
                        "passingYear",
                        "percentage",
                        "grade",
                      ] as const
                    ).map((field) => (
                      <td key={field} className="border border-surface-200 p-0">
                        {readOnly ? (
                          <div className="px-2 py-2 text-xs text-gray-700 bg-white min-h-8">
                            {rec[field].trim() || "—"}
                          </div>
                        ) : (
                          <input
                            value={rec[field]}
                            title={`${label} – ${field}`}
                            type={
                              field === "passingYear" || field === "percentage"
                                ? "number"
                                : "text"
                            }
                            onChange={(e) =>
                              setAcademic((p) => ({
                                ...p,
                                [key]: { ...p[key]!, [field]: e.target.value },
                              }))
                            }
                            className="w-full px-2 py-2 text-xs outline-none focus:bg-primary-50 focus:ring-1 focus:ring-primary"
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Entrance Exams */}
      <Section title="Entrance Exams (if applicable)">
        <div className="space-y-3">
          {exams.map((exam, i) => (
            <div key={i} className="grid grid-cols-4 gap-3 items-end">
              <Field
                label={i === 0 ? "Exam Name" : ""}
                placeholder="e.g. JEE Main"
                value={exam.examName}
                readOnly={readOnly}
                onChange={(v) => {
                  const n = [...exams];
                  n[i] = { ...n[i]!, examName: v };
                  setExams(n);
                }}
              />
              <Field
                label={i === 0 ? "Roll No." : ""}
                value={exam.rollNo}
                readOnly={readOnly}
                onChange={(v) => {
                  const n = [...exams];
                  n[i] = { ...n[i]!, rollNo: v };
                  setExams(n);
                }}
              />
              <Field
                label={i === 0 ? "Score" : ""}
                value={exam.score}
                readOnly={readOnly}
                onChange={(v) => {
                  const n = [...exams];
                  n[i] = { ...n[i]!, score: v };
                  setExams(n);
                }}
              />
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Field
                    label={i === 0 ? "Rank" : ""}
                    type="number"
                    value={exam.rank}
                    readOnly={readOnly}
                    onChange={(v) => {
                      const n = [...exams];
                      n[i] = { ...n[i]!, rank: v };
                      setExams(n);
                    }}
                  />
                </div>
                {!readOnly && exams.length > 1 && (
                  <button
                    type="button"
                    title="Remove exam"
                    onClick={() => setExams(exams.filter((_, j) => j !== i))}
                    className="mb-0.5 p-2 text-gray-400 hover:text-red-500 rounded-lg border border-surface-200"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {!readOnly && (
            <button
              type="button"
              onClick={() =>
                setExams([
                  ...exams,
                  { examName: "", rollNo: "", score: "", rank: "" },
                ])
              }
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Plus size={12} /> Add another exam
            </button>
          )}
        </div>
      </Section>

      {/* Payment */}
      <Section title="Payment Details (Office Use)">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field
            label="Booking Amount (₹)"
            type="number"
            {...f("bookingAmount")}
          />
          <Field label="Cash/DD No." {...f("bookingCashDDNo")} />
          <Field label="Bank" {...f("bookingBank")} />
          <Field label="Booking Date" type="date" {...f("bookingDate")} />
          <Field
            label="Admission Amount (₹)"
            type="number"
            {...f("admissionAmount")}
          />
          <Field label="Cash/DD No." {...f("admissionCashDDNo")} />
          <Field label="Bank" {...f("admissionBank")} />
          <Field label="Admission Date" type="date" {...f("admissionDate")} />
          <Field label="Dues Amount (₹)" type="number" {...f("duesAmount")} />
          <Field label="Due Date" type="date" {...f("dueDate")} />
        </div>
      </Section>

      {/* Other */}
      <Section title="Other Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Extra Curricular Activities"
            {...f("extraCurricular")}
          />
          <Field label="Authorised By" {...f("authorisedBy")} />
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Remarks
            </label>
            {readOnly ? (
              <div className="w-full min-h-14 px-3 py-2 rounded-lg border border-surface-200 bg-surface-50 text-sm text-gray-700 whitespace-pre-wrap">
                {form.remarks.trim() || "—"}
              </div>
            ) : (
              <textarea
                title="Remarks"
                placeholder="Any additional remarks or notes..."
                value={form.remarks}
                rows={3}
                onChange={(e) =>
                  setForm((p) => ({ ...p, remarks: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm outline-none focus:border-primary resize-none"
              />
            )}
          </div>
        </div>
      </Section>

      {/* Documents */}
      {app?.id && (
        <DocumentUploadSection
          confirmedApplicationId={app.id}
          leadId={leadId}
          documents={app.documents as Document[]}
          readOnly={readOnly}
        />
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-surface-200">
        {mode === "view" && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-surface-200 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors"
          >
            <Save size={14} />
            Edit
          </button>
        )}

        {mode === "view" && isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="px-5 py-2.5 rounded-lg border border-surface-200 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors"
          >
            Cancel
          </button>
        )}

        {(mode === "edit" || isEditing) && (
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || updateApp.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors"
          >
            <Send size={14} />
            {saving || updateApp.isPending
              ? "Saving..."
              : mode === "edit" && confirmOnSave
                ? "Save & Confirm"
                : "Save Changes"}
          </button>
        )}
      </div>
    </div>
  );
}
