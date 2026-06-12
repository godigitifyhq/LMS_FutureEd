"use client";

import { Fragment, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Plus,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { extractApiError } from "@/lib/utils";

type FormState = {
  studentName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  course: string;
  aadharNo: string;
  apaarId: string;
  gender: string;
  maritalStatus: string;
  fatherName: string;
  fatherOccupation: string;
  fatherIncome: string;
  motherName: string;
  motherOccupation: string;
  motherIncome: string;
  noOfSisters: string;
  noOfBrothers: string;
  nationality: string;
  religion: string;
  category: string;
  postalAddress: string;
  city: string;
  district: string;
  state: string;
  permanentAddress: string;
  permanentPhone: string;
  localGuardianName: string;
  localGuardianPhone: string;
  localGuardianAddress: string;
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

type ExamRow = {
  examName: string;
  rollNo: string;
  score: string;
  rank: string;
};

type DocFile = {
  id: string;
  file: File;
  docType: string;
};

const QUAL_LEVELS = [
  { key: "TENTH", label: "Matric / X Std." },
  { key: "TWELFTH", label: "Inter / XII Std." },
  { key: "GRADUATION", label: "Graduation / Equivalent" },
  { key: "POST_GRADUATION", label: "PG / Equivalent" },
] as const;

const DOC_TYPES = [
  "Marksheet",
  "ID Proof",
  "Photo",
  "Birth Certificate",
  "Entrance Exam Scorecard",
  "Other",
];

const STAGES = [
  { title: "Student & Family", subtitle: "Personal and family details" },
  { title: "Address & Academic", subtitle: "Addresses and qualifications" },
  { title: "Payment & Documents", subtitle: "Fees and supporting files" },
];

const emptyAcademic: AcademicRow = {
  stream: "",
  institution: "",
  board: "",
  passingYear: "",
  percentage: "",
  grade: "",
};

const emptyForm: FormState = {
  studentName: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  course: "",
  aadharNo: "",
  apaarId: "",
  gender: "",
  maritalStatus: "",
  fatherName: "",
  fatherOccupation: "",
  fatherIncome: "",
  motherName: "",
  motherOccupation: "",
  motherIncome: "",
  noOfSisters: "",
  noOfBrothers: "",
  nationality: "Indian",
  religion: "",
  category: "",
  postalAddress: "",
  city: "",
  district: "",
  state: "",
  permanentAddress: "",
  permanentPhone: "",
  localGuardianName: "",
  localGuardianPhone: "",
  localGuardianAddress: "",
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
  extraCurricular: "",
  authorisedBy: "",
  remarks: "",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
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
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </label>
      {textarea ? (
        <textarea
          title={label}
          placeholder={placeholder}
          value={value}
          rows={2}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-none rounded-lg border border-surface-200 px-3 py-2 text-sm outline-none focus:border-primary"
        />
      ) : (
        <input
          type={type}
          title={label}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm outline-none focus:border-primary"
        />
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={label}
        className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
      >
        <option value="">Select...</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function DirectAdmissionsPage() {
  const router = useRouter();
  const [stage, setStage] = useState<1 | 2 | 3>(1);
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
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [newDocType, setNewDocType] = useState("Marksheet");
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submittedLeadId, setSubmittedLeadId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function f(field: keyof FormState) {
    return {
      value: form[field],
      onChange: (v: string) => setForm((p) => ({ ...p, [field]: v })),
    };
  }

  function handleNext() {
    if (stage === 1) {
      if (!form.studentName.trim() || form.studentName.trim().length < 2) {
        toast.error("Student name must be at least 2 characters");
        return;
      }
      if (!form.phone.match(/^[6-9]\d{9}$/)) {
        toast.error("Enter a valid 10-digit Indian mobile number (starts with 6-9)");
        return;
      }
    }
    setStage((s) => (Math.min(s + 1, 3) as 1 | 2 | 3));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setStage((s) => (Math.max(s - 1, 1) as 1 | 2 | 3));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleAddDocument() {
    setDocError(null);
    if (!newDocFile) {
      setDocError("Please select a file");
      return;
    }
    const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowed.includes(newDocFile.type)) {
      setDocError("Only PDF, JPG, and PNG files are allowed");
      return;
    }
    if (newDocFile.size > 10 * 1024 * 1024) {
      setDocError("File must be under 10 MB");
      return;
    }
    setDocuments((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        file: newDocFile,
        docType: newDocType,
      },
    ]);
    setNewDocFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/leads/public/direct-admission", {
        studentName: form.studentName,
        phone: form.phone,
        fatherName: form.fatherName || undefined,
        email: form.email || undefined,
        dateOfBirth: form.dateOfBirth
          ? new Date(form.dateOfBirth).toISOString()
          : undefined,
        gender: form.gender || undefined,
        maritalStatus: form.maritalStatus || undefined,
        course: form.course || undefined,
        aadharNo: form.aadharNo || undefined,
        apaarId: form.apaarId || undefined,
        motherName: form.motherName || undefined,
        motherOccupation: form.motherOccupation || undefined,
        motherIncome: form.motherIncome ? Number(form.motherIncome) : undefined,
        fatherOccupation: form.fatherOccupation || undefined,
        fatherIncome: form.fatherIncome ? Number(form.fatherIncome) : undefined,
        noOfSisters: form.noOfSisters ? Number(form.noOfSisters) : undefined,
        noOfBrothers: form.noOfBrothers ? Number(form.noOfBrothers) : undefined,
        nationality: form.nationality || undefined,
        religion: form.religion || undefined,
        category: form.category || undefined,
        postalAddress: form.postalAddress || undefined,
        city: form.city || undefined,
        district: form.district || undefined,
        state: form.state || undefined,
        permanentAddress: form.permanentAddress || undefined,
        permanentPhone: form.permanentPhone || undefined,
        localGuardianName: form.localGuardianName || undefined,
        localGuardianAddress: form.localGuardianAddress || undefined,
        localGuardianPhone: form.localGuardianPhone || undefined,
        bookingAmount: form.bookingAmount
          ? Number(form.bookingAmount)
          : undefined,
        bookingCashDDNo: form.bookingCashDDNo || undefined,
        bookingBank: form.bookingBank || undefined,
        bookingDate: form.bookingDate
          ? new Date(form.bookingDate).toISOString()
          : undefined,
        admissionAmount: form.admissionAmount
          ? Number(form.admissionAmount)
          : undefined,
        admissionCashDDNo: form.admissionCashDDNo || undefined,
        admissionBank: form.admissionBank || undefined,
        admissionDate: form.admissionDate
          ? new Date(form.admissionDate).toISOString()
          : undefined,
        duesAmount: form.duesAmount ? Number(form.duesAmount) : undefined,
        dueDate: form.dueDate
          ? new Date(form.dueDate).toISOString()
          : undefined,
        extraCurricular: form.extraCurricular || undefined,
        authorisedBy: form.authorisedBy || undefined,
        remarks: form.remarks || undefined,
      });

      const leadId = data.data.leadId as string;

      // Save academic records
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
      if (academicRecords.length > 0) {
        await api.post(`/leads/${leadId}/confirmed/academic`, {
          records: academicRecords,
        });
      }

      // Save entrance exams
      const examRecords = exams
        .filter((ex) => ex.examName)
        .map((ex) => ({
          examName: ex.examName,
          rollNo: ex.rollNo || undefined,
          score: ex.score || undefined,
          rank: ex.rank ? Number(ex.rank) : undefined,
        }));
      if (examRecords.length > 0) {
        await api.post(`/leads/${leadId}/confirmed/exams`, {
          exams: examRecords,
        });
      }

      // Upload documents
      for (const doc of documents) {
        const fd = new FormData();
        fd.append("file", doc.file, doc.file.name);
        await api.post(
          `/leads/public/direct-admission/${leadId}/documents?documentType=${encodeURIComponent(doc.docType)}`,
          fd,
        );
      }

      setSubmittedLeadId(leadId);
      toast.success("Direct admission submitted successfully");
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setSaving(false);
    }
  }

  if (submittedLeadId) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Admission Submitted</h2>
        <p className="text-sm text-gray-500">
          The direct admission has been created and confirmed successfully.
        </p>
        <p className="inline-block rounded-lg border border-surface-200 bg-surface-50 px-4 py-2 font-mono text-xs text-gray-400">
          Ref: {submittedLeadId}
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push(`/leads/${submittedLeadId}`)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-800"
          >
            View Lead
          </button>
          <button
            type="button"
            onClick={() => {
              setForm(emptyForm);
              setAcademic({
                TENTH: { ...emptyAcademic },
                TWELFTH: { ...emptyAcademic },
                GRADUATION: { ...emptyAcademic },
                POST_GRADUATION: { ...emptyAcademic },
              });
              setExams([{ examName: "", rollNo: "", score: "", rank: "" }]);
              setDocuments([]);
              setStage(1);
              setSubmittedLeadId(null);
            }}
            className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary"
          >
            Add Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Direct Admission</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Fill in the admission application details below
        </p>
      </div>

      {/* Stage indicator */}
      <div className="flex items-center">
        {STAGES.map((s, i) => (
          <Fragment key={i}>
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                  i + 1 < stage
                    ? "bg-green-500 text-white"
                    : i + 1 === stage
                      ? "bg-primary text-white"
                      : "bg-surface-100 text-gray-400"
                }`}
              >
                {i + 1 < stage ? <Check size={13} /> : i + 1}
              </div>
              <div className="mt-1 hidden text-center sm:block">
                <p
                  className={`text-xs font-semibold ${i + 1 <= stage ? "text-gray-800" : "text-gray-400"}`}
                >
                  {s.title}
                </p>
                <p className="text-xs text-gray-400">{s.subtitle}</p>
              </div>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={`mx-3 -mt-[18px] h-0.5 flex-1 transition-colors sm:-mt-9 ${i + 1 < stage ? "bg-green-400" : "bg-surface-200"}`}
              />
            )}
          </Fragment>
        ))}
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {/* ── Stage 1: Student & Family ── */}
        {stage === 1 && (
          <>
            <div className="rounded-xl border border-surface-200 bg-white p-6">
              <Section title="Student Details">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Student Name *"
                    placeholder="Full name"
                    {...f("studentName")}
                  />
                  <Field
                    label="Phone *"
                    placeholder="10-digit mobile (starts with 6-9)"
                    {...f("phone")}
                  />
                  <Field label="Email" type="email" {...f("email")} />
                  <Field
                    label="Date of Birth"
                    type="date"
                    {...f("dateOfBirth")}
                  />
                  <Field
                    label="Course"
                    placeholder="e.g. B.Tech CSE"
                    {...f("course")}
                  />
                </div>
              </Section>
            </div>

            <div className="space-y-6 rounded-xl border border-surface-200 bg-white p-6">
              <Section title="Identity Documents">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

              <hr className="border-surface-200" />

              <Section title="Personal Details">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <SelectField
                    label="Gender"
                    {...f("gender")}
                    options={[
                      { value: "MALE", label: "Male" },
                      { value: "FEMALE", label: "Female" },
                      { value: "OTHER", label: "Other" },
                    ]}
                  />
                  <SelectField
                    label="Marital Status"
                    {...f("maritalStatus")}
                    options={[
                      { value: "SINGLE", label: "Single" },
                      { value: "MARRIED", label: "Married" },
                    ]}
                  />
                </div>
              </Section>

              <hr className="border-surface-200" />

              <Section title="Family Background">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 border-b border-surface-100 pb-4 sm:grid-cols-3">
                    <Field
                      label="Father's Name"
                      placeholder="Father's full name"
                      {...f("fatherName")}
                    />
                    <Field
                      label="Father's Occupation"
                      {...f("fatherOccupation")}
                    />
                    <Field
                      label="Father's Annual Income (₹)"
                      type="number"
                      {...f("fatherIncome")}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 border-b border-surface-100 pb-4 sm:grid-cols-3">
                    <Field label="Mother's Name" {...f("motherName")} />
                    <Field
                      label="Mother's Occupation"
                      {...f("motherOccupation")}
                    />
                    <Field
                      label="Mother's Annual Income (₹)"
                      type="number"
                      {...f("motherIncome")}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>
          </>
        )}

        {/* ── Stage 2: Address & Academic ── */}
        {stage === 2 && (
          <>
            <div className="space-y-6 rounded-xl border border-surface-200 bg-white p-6">
              <Section title="Addresses">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="City" {...f("city")} />
                    <Field label="District" {...f("district")} />
                    <Field label="State" {...f("state")} />
                  </div>
                  <Field
                    label="Postal Address"
                    textarea
                    placeholder="Current / postal address"
                    {...f("postalAddress")}
                  />
                  <Field
                    label="Permanent Address"
                    textarea
                    {...f("permanentAddress")}
                  />
                  <Field label="Permanent Phone" {...f("permanentPhone")} />
                  <Field
                    label="Local Guardian's Name"
                    {...f("localGuardianName")}
                  />
                  <Field
                    label="Local Guardian's Phone"
                    {...f("localGuardianPhone")}
                  />
                  <Field
                    label="Local Guardian's Address"
                    textarea
                    {...f("localGuardianAddress")}
                  />
                </div>
              </Section>
            </div>

            <div className="rounded-xl border border-surface-200 bg-white p-6">
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
                            className="border border-surface-200 px-3 py-2 text-left font-semibold text-gray-500"
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
                            <td className="whitespace-nowrap border border-surface-200 bg-surface-50 px-3 py-2 font-medium text-gray-700">
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
                              <td
                                key={field}
                                className="border border-surface-200 p-0"
                              >
                                <input
                                  value={rec[field]}
                                  title={`${label} – ${field}`}
                                  type={
                                    field === "passingYear" ||
                                    field === "percentage"
                                      ? "number"
                                      : "text"
                                  }
                                  onChange={(e) =>
                                    setAcademic((p) => ({
                                      ...p,
                                      [key]: {
                                        ...p[key]!,
                                        [field]: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full px-2 py-2 text-xs outline-none focus:bg-primary-50 focus:ring-1 focus:ring-primary"
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>

            <div className="rounded-xl border border-surface-200 bg-white p-6">
              <Section title="Entrance Exams (if applicable)">
                <div className="space-y-3">
                  {exams.map((exam, i) => (
                    <div key={i} className="grid grid-cols-4 items-end gap-3">
                      <div>
                        {i === 0 && (
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Exam Name
                          </label>
                        )}
                        <input
                          type="text"
                          title="Exam Name"
                          placeholder="e.g. JEE Main"
                          value={exam.examName}
                          onChange={(e) => {
                            const n = [...exams];
                            n[i] = { ...n[i]!, examName: e.target.value };
                            setExams(n);
                          }}
                          className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        {i === 0 && (
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Roll No.
                          </label>
                        )}
                        <input
                          type="text"
                          title="Roll No."
                          value={exam.rollNo}
                          onChange={(e) => {
                            const n = [...exams];
                            n[i] = { ...n[i]!, rollNo: e.target.value };
                            setExams(n);
                          }}
                          className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        {i === 0 && (
                          <label className="mb-1 block text-xs font-medium text-gray-600">
                            Score
                          </label>
                        )}
                        <input
                          type="text"
                          title="Score"
                          value={exam.score}
                          onChange={(e) => {
                            const n = [...exams];
                            n[i] = { ...n[i]!, score: e.target.value };
                            setExams(n);
                          }}
                          className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          {i === 0 && (
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                              Rank
                            </label>
                          )}
                          <input
                            type="number"
                            title="Rank"
                            value={exam.rank}
                            onChange={(e) => {
                              const n = [...exams];
                              n[i] = { ...n[i]!, rank: e.target.value };
                              setExams(n);
                            }}
                            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                        </div>
                        {exams.length > 1 && (
                          <button
                            type="button"
                            title="Remove exam"
                            onClick={() =>
                              setExams(exams.filter((_, j) => j !== i))
                            }
                            className="mb-0.5 rounded-lg border border-surface-200 p-2 text-gray-400 hover:text-red-500"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
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
                </div>
              </Section>
            </div>
          </>
        )}

        {/* ── Stage 3: Payment & Documents ── */}
        {stage === 3 && (
          <>
            <div className="rounded-xl border border-surface-200 bg-white p-6">
              <Section title="Payment Details (Office Use)">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field
                    label="Booking Amount (₹)"
                    type="number"
                    {...f("bookingAmount")}
                  />
                  <Field label="Cash/DD No." {...f("bookingCashDDNo")} />
                  <Field label="Bank" {...f("bookingBank")} />
                  <Field
                    label="Booking Date"
                    type="date"
                    {...f("bookingDate")}
                  />
                  <Field
                    label="Admission Amount (₹)"
                    type="number"
                    {...f("admissionAmount")}
                  />
                  <Field label="Cash/DD No." {...f("admissionCashDDNo")} />
                  <Field label="Bank" {...f("admissionBank")} />
                  <Field
                    label="Admission Date"
                    type="date"
                    {...f("admissionDate")}
                  />
                  <Field
                    label="Dues Amount (₹)"
                    type="number"
                    {...f("duesAmount")}
                  />
                  <Field label="Due Date" type="date" {...f("dueDate")} />
                </div>
              </Section>
            </div>

            <div className="rounded-xl border border-surface-200 bg-white p-6">
              <Section title="Documents">
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">
                    Upload supporting documents — PDF, JPG, or PNG, max 10 MB
                    each.
                  </p>

                  {/* Add document row */}
                  <div className="flex flex-col gap-3 rounded-lg border border-dashed border-surface-300 bg-surface-50 p-4 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label
                        htmlFor="dash-doc-type"
                        className="mb-1 block text-xs font-medium text-gray-600"
                      >
                        Document Type
                      </label>
                      <select
                        id="dash-doc-type"
                        value={newDocType}
                        onChange={(e) => setNewDocType(e.target.value)}
                        className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                      >
                        {DOC_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-[2]">
                      <label
                        htmlFor="dash-doc-file"
                        className="mb-1 block text-xs font-medium text-gray-600"
                      >
                        File
                      </label>
                      <input
                        id="dash-doc-file"
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) =>
                          setNewDocFile(e.target.files?.[0] ?? null)
                        }
                        className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-surface-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-gray-600 outline-none focus:border-primary"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddDocument}
                      className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-800"
                    >
                      <Upload size={13} /> Add
                    </button>
                  </div>

                  {docError && (
                    <p className="text-xs text-red-500">{docError}</p>
                  )}

                  {documents.length > 0 && (
                    <ul className="space-y-2">
                      {documents.map((doc) => (
                        <li
                          key={doc.id}
                          className="flex items-center gap-3 rounded-lg border border-surface-200 bg-white px-4 py-2.5"
                        >
                          <FileText
                            size={14}
                            className="shrink-0 text-gray-400"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-800">
                              {doc.file.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {doc.docType} ·{" "}
                              {(doc.file.size / 1024).toFixed(0)} KB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setDocuments((p) =>
                                p.filter((d) => d.id !== doc.id),
                              )
                            }
                            aria-label={`Remove ${doc.file.name}`}
                            className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Section>
            </div>

            <div className="rounded-xl border border-surface-200 bg-white p-6">
              <Section title="Other Details">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Extra Curricular Activities"
                    {...f("extraCurricular")}
                  />
                  <Field label="Authorised By" {...f("authorisedBy")} />
                  <div className="sm:col-span-2">
                    <Field label="Remarks" textarea {...f("remarks")} />
                  </div>
                </div>
              </Section>
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-3 pb-6">
          {stage > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 rounded-lg border border-surface-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary"
            >
              <ChevronLeft size={14} /> Back
            </button>
          )}
          {stage < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-800"
            >
              Save & Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={saving}
              className="ml-auto flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-800 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {saving
                ? documents.length > 0
                  ? "Submitting & uploading..."
                  : "Submitting..."
                : "Submit Direct Admission"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
