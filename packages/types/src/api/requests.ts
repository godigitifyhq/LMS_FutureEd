import type {
    Gender,
    MaritalStatus,
    QualificationLevel,
    InteractionType,
    LeadStatus,
  } from '../enums'
  
  // Auth
  export type LoginRequest = {
    email: string
    password: string
  }
  
  // Lead creation — only minimum fields required
  export type CreateLeadRequest = {
    studentName: string
    phone: string
    fatherName?: string
    dateOfBirth?: string
    sourceId?: string
    sourceOther?: string
    courseIds?: string[]
    sendSms?: boolean
    sendEmail?: boolean
  }
  
  // Lead update — all optional, only send what changed
  export type UpdateLeadRequest = {
    studentName?: string
    fatherName?: string
    dateOfBirth?: string
    alternatePhone?: string
    whatsappNumber?: string
    email?: string
    gender?: Gender
    maritalStatus?: MaritalStatus
    village?: string
    sector?: string
    city?: string
    district?: string
    state?: string
    qualification?: QualificationLevel
    schoolCollege?: string
    boardUniversity?: string
    passingYear?: number
    percentage?: number
    pcmPcbPercentage?: number
    sourceId?: string
    sourceOther?: string
    purpose?: string
    remarks?: string
    nextFollowUpAt?: string
    sendSms?: boolean
    sendEmail?: boolean
  }
  
  // State transition
  export type TransitionLeadRequest = {
    toStatus: LeadStatus
    note?: string
  }
  
  // Assignment
  export type AssignLeadRequest = {
    assignedToId: string
    reason?: string
  }
  
  // Interaction / Feedback
  export type CreateInteractionRequest = {
    type: InteractionType
    note?: string
    callRecordingUrl?: string
    callDurationSecs?: number
  }
  
  export type EditInteractionRequest = {
    note: string
  }
  
  // Confirmed application
  export type CreateConfirmedApplicationRequest = {
    aadharNo?: string
    apaarId?: string
    motherName?: string
    motherOccupation?: string
    motherIncome?: number
    fatherOccupation?: string
    fatherIncome?: number
    noOfSisters?: number
    noOfBrothers?: number
    nationality?: string
    religion?: string
    category?: string
    permanentAddress?: string
    permanentPhone?: string
    localGuardianName?: string
    localGuardianAddress?: string
    localGuardianPhone?: string
    bookingAmount?: number
    bookingCashDDNo?: string
    bookingBank?: string
    bookingDate?: string
    admissionAmount?: number
    admissionCashDDNo?: string
    admissionBank?: string
    admissionDate?: string
    duesAmount?: number
    dueDate?: string
    extraCurricular?: string
    authorisedBy?: string
  }