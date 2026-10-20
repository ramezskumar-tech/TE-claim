/**
 * Types & Data Models for Samagra Shiksha Vellore District
 * Transport & Escort Facility Monthly Claim System
 */

export type UserRole = 'SCHOOL' | 'BLOCK' | 'DISTRICT';

export type ClaimStatus =
  | 'NOT_SUBMITTED'
  | 'SUBMITTED_BY_SCHOOL'
  | 'PENDING_BLOCK_VERIFICATION'
  | 'BLOCK_APPROVED'
  | 'BLOCK_REJECTED'
  | 'BLOCK_CLAIM_SUBMITTED_TO_DISTRICT'
  | 'PENDING_DISTRICT_VERIFICATION'
  | 'DISTRICT_REJECTED'
  | 'CORRECTION_REQUIRED'
  | 'RESUBMITTED_BY_BLOCK'
  | 'DISTRICT_APPROVED'
  | 'FINAL_DISTRICT_APPROVAL'
  | 'MONTHLY_CYCLE_CLOSED';

export interface UserSession {
  userId: string;
  name: string;
  role: UserRole;
  blockId?: string;
  blockName?: string;
  udiseCode?: string;
  schoolName?: string;
  districtName?: string;
}

export interface StudentClaimItem {
  id: string;
  studentName: string;
  emisNumber: string;
  grade: string;
  category: 'Transport' | 'Escort';
  workingDaysInMonth: number;
  daysAttended: number;
  ratePerDay: number;
  totalClaimAmount: number;
  serviceProviderName: string; // Driver / Escort helper name
  beneficiaryAccountNo?: string;
  remarks?: string;
  fatherName?: string;
  habitationName?: string;
  contactNumber?: string;
  photoUrl?: string; // Stored URL in last column of Supabase master table
  gender?: string;
  community?: string;
  religion?: string;
  panchayatName?: string;
}

export interface AppointedVehicleItem {
  id: string;
  vehicleNo: string;
  driverName: string;
  contactNumber: string;
}

export interface AppointedEscortItem {
  id: string;
  escortName: string;
  roleOrRelation: string;
  contactNumber: string;
}

export interface SmcBankDetails {
  accountHolderName: string;
  accountNumber?: string;
  branch: string;
  ifscCode: string;
  resolutionDocUrl?: string;
  resolutionDocName?: string;
  resolutionDocType?: 'pdf' | 'image';
  isSaved?: boolean;
}

export interface SchoolClaimRecord {
  id: string;
  claimMonthKey: string; // e.g. "2026-09"
  claimMonthName: string; // e.g. "September 2026"
  calculationPeriod: string; // e.g. "September 01, 2026 to September 30, 2026"
  udiseCode: string;
  schoolName: string;
  blockId: string;
  blockName: string;
  userId: string;
  submittedBy: string;
  submissionDateTime: string;
  status: ClaimStatus;
  isClaimSubmitted?: boolean;
  isClaimVerified?: boolean;
  hmDeclarationCompleted?: boolean;
  isForwardedToBlock?: boolean;
  forwardedToBlockAt?: string;
  students: StudentClaimItem[];
  totalStudents: number;
  totalClaimAmount: number;
  appointedVehicles?: AppointedVehicleItem[];
  appointedEscorts?: AppointedEscortItem[];
  smcDetails?: SmcBankDetails;
  usagePhotos?: {
    id: string;
    name: string;
    dataUrl: string;
    storageUrl?: string;
    uploadedAt: string;
  }[];
  attendanceDocUrl?: string;
  blockVerification?: {
    verifiedByUserId: string;
    verifiedByName: string;
    verifiedAt: string;
    decision: 'APPROVED' | 'REJECTED';
    remarks: string;
  };
  districtVerification?: {
    verifiedByUserId: string;
    verifiedByName: string;
    verifiedAt: string;
    decision: 'APPROVED' | 'REJECTED';
    remarks: string;
  };
}

export interface BlockClaimRecord {
  id: string;
  claimMonthKey: string;
  claimMonthName: string;
  calculationPeriod: string;
  blockId: string;
  blockName: string;
  userId: string;
  submittedBy: string;
  submissionDateTime: string;
  status: ClaimStatus;
  totalSchoolsCount: number;
  submittedSchoolsCount: number;
  totalStudentsCount: number;
  totalClaimAmount: number;
  rejectionRemarks?: string;
  resubmissionCount: number;
  history: Array<{
    action: string;
    timestamp: string;
    performedBy: string;
    role: string;
    notes?: string;
  }>;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  schoolOrBlockName: string;
  claimMonth: string;
  action: string;
  previousStatus: string;
  newStatus: string;
  remarks: string;
}

export interface NotificationItem {
  id: string;
  type: 'RETURN' | 'APPROVAL' | 'RESUBMISSION' | 'SUBMISSION' | 'FINAL_SANCTION';
  title: string;
  message: string;
  claimMonth: string;
  targetRole: UserRole;
  targetBlockId?: string;
  targetUdiseCode?: string;
  createdAt: string;
  active: boolean;
}

export interface MonthlyCycleState {
  currentCycleMonthKey: string; // e.g. "2026-09"
  currentCycleMonthName: string; // e.g. "September 2026"
  claimSubmissionMonthName: string; // e.g. "October 2026"
  calculationPeriod: string; // e.g. "01/09/2026 to 30/09/2026"
  isDistrictSanctionCompleted: boolean;
  districtSanctionDateTime?: string;
  sanctionOrderNumber?: string;
  isArchived: boolean;
}
