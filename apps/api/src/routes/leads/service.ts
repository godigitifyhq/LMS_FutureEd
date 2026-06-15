import type { PrismaClient } from '@lms/db'
import type { LeadStatus, Role } from '@lms/types'

function toDateRangeStart(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function toDateRangeEnd(value: string): Date {
  return new Date(`${value}T23:59:59.999Z`)
}

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
  fatherName: true,
  courses: {
    select: {
      isPrimary: true,
      course: { select: { id: true, name: true } },
    },
  },
  confirmedApplication: {
    select: {
      admissionId: true,
      fileNumber: true,
      sentToStudentAt: true,
      sentToStudentEmail: true,
      isFormComplete: true,
    },
  },
  // Meta/WhatsApp source indicators — used for source badges in UI
  isFromWhatsApp: true,
  metaLeadgenId: true,
  metaAdName: true,
} as const

export const leadDetailSelect = {
  ...leadSummarySelect,
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
  // WhatsApp message detail — shown in lead detail WA panel
  waContactId: true,
  waFirstMessage: true,
  waMessageType: true,
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
    overdue?: boolean
  }
}) {
  const { userId, userRole, filters } = params

  // Collect top-level AND conditions so nothing overwrites each other
  const andClauses: Record<string, unknown>[] = []

  // ── Role-based visibility (EMPLOYEE sees only their own leads) ──
  if (userRole === 'EMPLOYEE') {
    andClauses.push({
      OR: [
        { assignedToId: userId },
        { createdById: userId },
      ],
    })
    // Confirmed leads fade out for employees after 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    andClauses.push({
      NOT: {
        AND: [
          { status: 'CONFIRMED' },
          { confirmedAt: { lt: oneHourAgo } },
        ],
      },
    })
  }

  // ── Status filter ──
  // When search is active: ignore status — results come from the full DB.
  // When no search and no explicit status: hide CONFIRMED/INTERESTED (they
  // have their own dedicated tabs).
  if (filters.search) {
    // global search — no status restriction
  } else if (filters.status) {
    andClauses.push({ status: filters.status })
  } else {
    andClauses.push({ status: { notIn: ['CONFIRMED', 'INTERESTED'] } })
  }

  // ── Other filters ──
  if (filters.assignedToId === 'unassigned') {
    andClauses.push({ assignedToId: null })
  } else if (filters.assignedToId) {
    andClauses.push({ assignedToId: filters.assignedToId })
  }
  if (filters.sourceId)     andClauses.push({ sourceId: filters.sourceId })
  if (filters.branchId)     andClauses.push({ branchId: filters.branchId })
  if (filters.overdue) {
    andClauses.push({ nextFollowUpAt: { lte: new Date() } })
    andClauses.push({ status: { notIn: ['CONFIRMED', 'DUPLICATE', 'LOST'] } })
  }

  if (filters.courseId) {
    andClauses.push({ courses: { some: { courseId: filters.courseId } } })
  }

  // ── Full-DB search (name, phone, email, father name, location) ──
  if (filters.search) {
    andClauses.push({
      OR: [
        { studentName:  { contains: filters.search, mode: 'insensitive' } },
        { phone:        { contains: filters.search } },
        { email:        { contains: filters.search, mode: 'insensitive' } },
        { fatherName:   { contains: filters.search, mode: 'insensitive' } },
        { city:         { contains: filters.search, mode: 'insensitive' } },
        { district:     { contains: filters.search, mode: 'insensitive' } },
        { village:      { contains: filters.search, mode: 'insensitive' } },
        { sector:       { contains: filters.search, mode: 'insensitive' } },
      ],
    })
  }

  if (filters.dateFrom ?? filters.dateTo) {
    andClauses.push({
      createdAt: {
        ...(filters.dateFrom ? { gte: toDateRangeStart(filters.dateFrom) } : {}),
        ...(filters.dateTo   ? { lte: toDateRangeEnd(filters.dateTo)   } : {}),
      },
    })
  }

  return andClauses.length === 0 ? {} : andClauses.length === 1 ? andClauses[0]! : { AND: andClauses }
}

// ── Duplicate check query ──
export async function findDuplicateLeads(params: {
  phone: string
  email: string | null | undefined
  prisma: PrismaClient
}) {
  const emailLower = params.email?.toLowerCase().trim() || null
  return params.prisma.lead.findMany({
    where: {
      OR: [
        { phone: params.phone },
        // Case-insensitive email match to catch ARYAN@gmail.com == aryan@gmail.com
        ...(emailLower
          ? [{ email: { equals: emailLower, mode: 'insensitive' as const } }]
          : []),
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
