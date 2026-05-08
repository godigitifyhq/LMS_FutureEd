import type { PrismaClient } from '@lms/db'
import type { LeadStatus, Role } from '@lms/types'

// ── Shared lead select — what we return on every lead ──
export const leadSummarySelect = {
  id: true,
  studentName: true,
  phone: true,
  email: true,
  status: true,
  city: true,
  district: true,
  nextFollowUpAt: true,
  isDuplicate: true,
  confirmedAt: true,
  confirmedById: true,
  createdAt: true,
  updatedAt: true,
  source: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true, email: true, role: true } },
  createdBy: { select: { id: true, name: true } },
  courses: {
    select: {
      isPrimary: true,
      course: { select: { id: true, name: true } },
    },
  },
} as const

export const leadDetailSelect = {
  ...leadSummarySelect,
  fatherName: true,
  dateOfBirth: true,
  alternatePhone: true,
  whatsappNumber: true,
  gender: true,
  maritalStatus: true,
  village: true,
  sector: true,
  state: true,
  qualification: true,
  schoolCollege: true,
  boardUniversity: true,
  passingYear: true,
  percentage: true,
  pcmPcbPercentage: true,
  sourceOther: true,
  purpose: true,
  remarks: true,
  sendSms: true,
  sendEmail: true,
  duplicateOfId: true,
  branchId: true,
  branch: { select: { id: true, name: true, city: true } },
} as const

// ── Build WHERE clause based on role + filters ──
export function buildLeadWhereClause(params: {
  userId: string
  userRole: Role
  filters: {
    status?: LeadStatus
    assignedToId?: string
    courseId?: string
    sourceId?: string
    branchId?: string
    search?: string
    dateFrom?: string
    dateTo?: string
  }
}) {
  const { userId, userRole, filters } = params
  const where: Record<string, unknown> = {}

  // Role-based visibility
  if (userRole === 'EMPLOYEE') {
    where['OR'] = [
      { assignedToId: userId },
      { createdById: userId },
    ]
  }

  // Confirmed lead visibility window for employees
  if (userRole === 'EMPLOYEE') {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    where['NOT'] = {
      AND: [
        { status: 'CONFIRMED' },
        { confirmedAt: { lt: oneHourAgo } },
      ],
    }
  }

  // Filters
  if (filters.status) where['status'] = filters.status
  if (filters.assignedToId) where['assignedToId'] = filters.assignedToId
  if (filters.sourceId) where['sourceId'] = filters.sourceId
  if (filters.branchId) where['branchId'] = filters.branchId

  if (filters.courseId) {
    where['courses'] = {
      some: { courseId: filters.courseId },
    }
  }

  if (filters.search) {
    where['OR'] = [
      { studentName: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: filters.search } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  if (filters.dateFrom ?? filters.dateTo) {
    where['createdAt'] = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
    }
  }

  return where
}

// ── Duplicate check query ──
export async function findDuplicateLeads(params: {
  phone: string
  email: string | null | undefined
  prisma: PrismaClient
}) {
  return params.prisma.lead.findMany({
    where: {
      OR: [
        { phone: params.phone },
        ...(params.email ? [{ email: params.email }] : []),
      ],
    },
    select: {
      id: true,
      phone: true,
      email: true,
      status: true,
      isDuplicate: true,
      duplicateOfId: true,
      studentName: true,
    },
  })
}