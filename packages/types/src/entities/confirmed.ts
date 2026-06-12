import type { Gender, MaritalStatus, QualificationLevel } from "../enums";

export type AcademicRecord = {
  id: string;
  level: QualificationLevel;
  stream: string | null;
  institution: string | null;
  board: string | null;
  passingYear: number | null;
  percentage: number | null;
  grade: string | null;
};

export type EntranceExamDetail = {
  id: string;
  examName: string;
  rollNo: string | null;
  score: string | null;
  rank: number | null;
};

export type DocumentType = {
  id: string;
  name: string;
  isRequired: boolean;
  isActive: boolean;
};

export type LeadDocument = {
  id: string;
  documentType: DocumentType;
  fileUrl: string;
  fileName: string;
  isVerified: boolean;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  uploadedAt: Date;
};

export type ConfirmedApplication = {
  id: string;
  leadId: string;
  aadharNo: string | null;
  apaarId: string | null;
  gender: Gender | null;
  maritalStatus: MaritalStatus | null;
  fatherName: string | null;
  motherName: string | null;
  motherOccupation: string | null;
  motherIncome: number | null;
  fatherOccupation: string | null;
  fatherIncome: number | null;
  noOfSisters: number | null;
  noOfBrothers: number | null;
  nationality: string | null;
  religion: string | null;
  category: string | null;
  postalAddress: string | null;
  permanentAddress: string | null;
  permanentPhone: string | null;
  localGuardianName: string | null;
  localGuardianAddress: string | null;
  localGuardianPhone: string | null;
  bookingAmount: number | null;
  bookingCashDDNo: string | null;
  bookingBank: string | null;
  bookingDate: Date | null;
  admissionAmount: number | null;
  admissionCashDDNo: string | null;
  admissionBank: string | null;
  admissionDate: Date | null;
  duesAmount: number | null;
  dueDate: Date | null;
  extraCurricular: string | null;
  authorisedBy: string | null;
  remarks: string | null;
  admissionId: string | null;
  fileNumber: string | null;
  isFormComplete: boolean;
  sentToStudentAt: Date | null;
  sentToStudentEmail: string | null;
  academicRecords: AcademicRecord[];
  entranceExams: EntranceExamDetail[];
  documents: LeadDocument[];
  createdAt: Date;
  updatedAt: Date;
};
