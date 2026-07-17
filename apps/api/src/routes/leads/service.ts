import type { PrismaClient } from '@lms/db'
import type { LeadStatus, Role } from '@lms/types'

function toDateRangeStart(value: string): Date {
  // Treat YYYY-MM-DD as IST midnight so date boundaries match the analytics service
  return new Date(`${value}T00:00:00.000+05:30`);
}

function toDateRangeEnd(value: string): Date {
  return new Date(`${value}T23:59:59.999+05:30`);
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
    statuses?: LeadStatus[]     // multi-status filter — takes priority over single status
    interactionType?: string    // leads with at least one interaction of this type (any user)
    interactedByUserId?: string // leads where this specific user logged any non-status interaction
    assignedToId?: string
    courseId?: string
    sourceId?: string
    branchId?: string
    search?: string
    dateFrom?: string
    dateTo?: string
    overdue?: boolean
    upcoming?: boolean          // leads with nextFollowUpAt in the next 7 days
    showAllStatuses?: boolean   // bypass ALL status exclusion (Total Leads card)
    excludeTerminal?: boolean   // exclude only CONFIRMED/DUPLICATE/LOST — matches dashboard active count
    excludeUnassigned?: boolean // only leads that have an assignee — leaderboard "Assigned" drill-throughs
    // Explicit opt-in for "confirmed during this window" (Admissions page /
    // dashboard's Confirmed Today). Without it, dateFrom/dateTo always means
    // "created during this window" — matching the cohort-style confirmedLeads
    // metric used by the leaderboard/employee-detail reports, whose drill-throughs
    // must filter the same way to reconcile with the number they display.
    dateBy?: 'createdAt' | 'confirmedAt'
    // Admission year (YYYY) — matched against the year segment of the confirmed
    // application's file number ("20/2020" → 2020), which is the year the
    // admission belongs to. Deliberately not a date filter: a file number is
    // assigned per branch per admission year and can be issued in a different
    // calendar year than confirmedAt/createdAt.
    admissionYear?: string
    leadIds?: string[]          // restrict to a precomputed set of lead IDs — used by
                                 // the "interacted by owner" drill-through (see leads/list.ts)
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
  }

  // ── Status filter ──
  // An explicit status/statuses selection always wins — showAllStatuses only
  // exists to relax the *default* exclusion (e.g. "Total Leads" drill-through)
  // and must not silently override a status the user actually picked.
  if (filters.statuses && filters.statuses.length > 0) {
    andClauses.push({ status: { in: filters.statuses } })
  } else if (filters.status) {
    andClauses.push({ status: filters.status })
  } else if (filters.showAllStatuses) {
    // All statuses — used by "Total Leads" drill-through
  } else if (filters.search) {
    // Full-text search — no status restriction
  } else if (filters.overdue || filters.upcoming) {
    // overdue/upcoming have their own status constraints added below; don't also add default
  } else if (filters.assignedToId) {
    // Unassigned (?assignedToId=unassigned) or specific employee — match dashboard exclusion set
    andClauses.push({ status: { notIn: ['CONFIRMED', 'DUPLICATE', 'LOST'] } })
  } else if (filters.excludeTerminal) {
    // Active Leads card: exclude only truly closed statuses — keep INTERESTED visible
    andClauses.push({ status: { notIn: ['CONFIRMED', 'DUPLICATE', 'LOST'] } })
  } else {
    // Default leads list — hide statuses that have dedicated tabs (Admissions, Interested)
    andClauses.push({ status: { notIn: ['CONFIRMED', 'INTERESTED'] } })
  }

  // ── Other filters ──
  if (filters.assignedToId === 'unassigned') {
    andClauses.push({ assignedToId: null })
  } else if (filters.assignedToId) {
    andClauses.push({ assignedToId: filters.assignedToId })
  } else if (filters.excludeUnassigned) {
    andClauses.push({ assignedToId: { not: null } })
  }
  if (filters.sourceId)     andClauses.push({ sourceId: filters.sourceId })
  if (filters.branchId)     andClauses.push({ branchId: filters.branchId })
  if (filters.leadIds)      andClauses.push({ id: { in: filters.leadIds } })
  if (filters.overdue) {
    // "Overdue" means due in the past — a custom date range here narrows
    // *which* overdue follow-ups to show (by due date), it never reveals
    // future-dated ones. So the upper bound is min(dateTo, now).
    const overdueUpperBound = filters.dateTo
      ? new Date(Math.min(toDateRangeEnd(filters.dateTo).getTime(), Date.now()))
      : new Date()
    andClauses.push({
      nextFollowUpAt: {
        ...(filters.dateFrom ? { gte: toDateRangeStart(filters.dateFrom) } : {}),
        lte: overdueUpperBound,
      },
    })
    andClauses.push({ status: { notIn: ['CONFIRMED', 'DUPLICATE', 'LOST'] } })
  }
  if (filters.upcoming) {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    andClauses.push({ nextFollowUpAt: { gt: now, lte: in7Days } })
    andClauses.push({ status: { notIn: ['CONFIRMED', 'DUPLICATE', 'LOST'] } })
  }

  if (filters.courseId) {
    andClauses.push({ courses: { some: { courseId: filters.courseId } } })
  }

  // ── Admission year (file number "20/2020" → 2020) ──
  // Matches the trailing year rather than the exact "/YYYY" suffix: some file
  // numbers were entered with a space after the slash ("81/ 2026"), and those
  // belong to that year just the same. Every file number follows <seq>/<year>,
  // so a trailing-year match can't collide with the sequence part.
  // Leads with no file number can't belong to an admission year, so they drop
  // out of the result set entirely — that's intended.
  if (filters.admissionYear) {
    andClauses.push({
      confirmedApplication: {
        fileNumber: { endsWith: filters.admissionYear },
      },
    })
  }

  // ── Interaction filters ──
  if (filters.interactionType) {
    andClauses.push({
      interactions: { some: { type: filters.interactionType, isDeleted: false } }
    })
  }
  if (filters.interactedByUserId) {
    // The date range means "interacted in this window" here, not "lead
    // created in this window" — matches how the Employee Performance card's
    // leadsInteracted count is computed (by interaction date, not lead date).
    andClauses.push({
      interactions: {
        some: {
          userId: filters.interactedByUserId,
          isDeleted: false,
          type: { not: 'STATUS_CHANGED' },
          ...(filters.dateFrom || filters.dateTo
            ? {
                createdAt: {
                  ...(filters.dateFrom ? { gte: toDateRangeStart(filters.dateFrom) } : {}),
                  ...(filters.dateTo   ? { lte: toDateRangeEnd(filters.dateTo)   } : {}),
                },
              }
            : {}),
        },
      },
    })
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

  if ((filters.dateFrom ?? filters.dateTo) && !filters.overdue) {
    // Defaults to createdAt (cohort semantics — "leads created in this
    // window", matching computeEmployeeStats' confirmedLeads/leadsInteracted
    // used by the leaderboard/employee-detail reports). Only the Admissions
    // page and the dashboard's Confirmed Today card explicitly opt into
    // confirmedAt via dateBy, since for them the window means "confirmed in
    // this window". When interactedByUserId is also set, this AND's with its
    // own interaction-level date filter above — both the lead's creation and
    // the interaction itself must fall in the window, matching leadsInteracted's
    // "leads created in this period, currently assigned to them, that they interacted with".
    // When overdue is set, the range is already applied to nextFollowUpAt above —
    // applying it to createdAt too would exclude overdue leads whose creation date
    // falls outside the (unrelated) due-date range.
    const dateField = filters.dateBy === 'confirmedAt' ? 'confirmedAt' : 'createdAt'
    andClauses.push({
      [dateField]: {
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
