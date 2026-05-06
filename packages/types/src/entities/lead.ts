import type {
    LeadStatus,
    Gender,
    MaritalStatus,
    QualificationLevel,
  } from '../enums'
  import type { UserSummary } from './user'
  import type { Course } from './course'
  
  export type LeadCourse = {
    id: string
    course: Course
    isPrimary: boolean
  }
  
  export type Lead = {
    id: string
    studentName: string
    phone: string
    fatherName: string | null
    dateOfBirth: Date | null
    alternatePhone: string | null
    whatsappNumber: string | null
    email: string | null
    gender: Gender | null
    maritalStatus: MaritalStatus | null
    village: string | null
    sector: string | null
    city: string | null
    district: string | null
    state: string | null
    qualification: QualificationLevel | null
    schoolCollege: string | null
    boardUniversity: string | null
    passingYear: number | null
    percentage: number | null
    pcmPcbPercentage: number | null
    sourceId: string | null
    sourceOther: string | null
    status: LeadStatus
    purpose: string | null
    remarks: string | null
    nextFollowUpAt: Date | null
    sendSms: boolean
    sendEmail: boolean
    isDuplicate: boolean
    duplicateOfId: string | null
    branchId: string
    assignedTo: UserSummary | null
    createdBy: UserSummary
    courses: LeadCourse[]
    createdAt: Date
    updatedAt: Date
  }
  
  // Lightweight version for list views — no nested objects
  export type LeadSummary = {
    id: string
    studentName: string
    phone: string
    email: string | null
    status: LeadStatus
    assignedTo: UserSummary | null
    primaryCourse: string | null
    nextFollowUpAt: Date | null
    createdAt: Date
  }