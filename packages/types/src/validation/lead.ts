import { z } from "zod";
import { indianPhone, optionalEmail, dateString } from "./common";
import {
  LeadStatus,
  QualificationLevel,
  Gender,
  MaritalStatus,
} from "../enums";

// ── Create Lead ──
// Required: phone, studentName only
export const CreateLeadSchema = z.object({
  // Required fields
  phone: indianPhone,
  studentName: z.string().trim().min(2, "Name must be at least 2 characters"),
  dateOfBirth: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    dateString.optional(),
  ),
  fatherName: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .trim()
      .min(2, "Father name must be at least 2 characters")
      .optional(),
  ),

  // Optional contact
  alternatePhone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter valid Indian mobile number")
    .optional(),
  whatsappNumber: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter valid Indian mobile number")
    .optional(),
  email: optionalEmail,

  // Optional course + source
  courseIds: z.array(z.string().cuid()).max(10).optional(),
  sourceId: z.string().cuid().optional(),
  sourceOther: z.string().trim().max(100).optional(),

  // Optional academic
  qualification: z.nativeEnum(QualificationLevel).optional(),
  schoolCollege: z.string().trim().max(200).optional(),
  boardUniversity: z.string().trim().max(200).optional(),
  passingYear: z
    .number()
    .int()
    .min(1990)
    .max(new Date().getFullYear())
    .optional(),
  percentage: z.number().min(0).optional(),
  pcmPcbPercentage: z.number().min(0).optional(),

  // Optional address
  village: z.string().trim().max(200).optional(),
  sector: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),

  // Optional demographics
  gender: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.nativeEnum(Gender).optional(),
  ),
  maritalStatus: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.nativeEnum(MaritalStatus).optional(),
  ),

  // Optional follow-up (allow null from clients)
  nextFollowUpAt: z.string().datetime().nullable().optional(),
  sendSms: z.boolean().optional(),
  sendEmail: z.boolean().optional(),

  // Optional flags
  purpose: z.string().trim().max(500).optional(),
  remarks: z.string().trim().max(1000).optional(),

  // Assignment — only used by admin/sub-admin (enforced in route)
  assignedToId: z.string().cuid().optional(),

  // Revival confirmation for LOST leads
  confirmRevival: z.boolean().optional(),
  revivalLeadId: z.string().cuid().optional(),
});

// ── Update Lead — all optional ──
export const UpdateLeadSchema = CreateLeadSchema.omit({
  phone: true, // phone cannot be changed (duplicate detection key)
  confirmRevival: true,
  revivalLeadId: true,
  assignedToId: true, // assignment is a separate endpoint
}).partial();

// ── State Transition ──
export const TransitionLeadSchema = z.object({
  toStatus: z.nativeEnum(LeadStatus),
  note: z.string().trim().max(2000).optional(),
  sendEmailToStudent: z.boolean().optional(),
  institutionName: z.string().trim().max(200).optional(),
  programName: z.string().trim().max(200).optional(),
  applicationNumber: z.string().trim().max(100).optional(),
});

// ── Assign Lead ──
export const AssignLeadSchema = z.object({
  assignedToId: z.string().cuid({ message: "Invalid user ID" }),
  reason: z.string().trim().max(500).optional(),
});

// ── Bulk Assign ──
export const BulkAssignSchema = z.object({
  leadIds: z.array(z.string().cuid()).min(1).max(50),
  assignedToId: z.string().cuid(),
  reason: z.string().trim().max(500).optional(),
});

// ── Bulk Status ──
export const BulkStatusSchema = z.object({
  leadIds: z.array(z.string().cuid()).min(1).max(50),
  toStatus: z.nativeEnum(LeadStatus),
  note: z.string().trim().max(2000).optional(),
});

// ── Lead List Query ──
export const LeadListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [20, 50, 80].includes(n), {
      message: "Page size must be 20, 50, or 80",
    })
    .default(20),
  status: z.nativeEnum(LeadStatus).optional(),
  assignedToId: z.string().cuid().optional(),
  courseId: z.string().cuid().optional(),
  sourceId: z.string().cuid().optional(),
  branchId: z.string().cuid().optional(),
  search: z.string().trim().max(100).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sortBy: z
    .enum(["createdAt", "studentName", "status", "nextFollowUpAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;
export type TransitionLeadInput = z.infer<typeof TransitionLeadSchema>;
export type AssignLeadInput = z.infer<typeof AssignLeadSchema>;
export type BulkAssignInput = z.infer<typeof BulkAssignSchema>;
export type BulkStatusInput = z.infer<typeof BulkStatusSchema>;
export type LeadListQuery = z.infer<typeof LeadListQuerySchema>;
