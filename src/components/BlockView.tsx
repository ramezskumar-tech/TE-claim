import React, { useState, useRef } from 'react';
import { BlockClaimRecord, SchoolClaimRecord, UserSession, StudentClaimItem } from '../types/claim';
import { DynamicCycleInfo, formatCurrencyINR } from '../utils/dateCycle';
import { calculateStudentClaimAmount } from '../utils/claimCalculation';
import { claimStore } from '../services/claimStore';
import { VELLORE_BLOCKS, VELLORE_SCHOOLS } from '../data/initialData';
import {
  printStudentWiseClaimSheet,
  downloadOfficialClaimLandscapePdf,
  downloadClaimCsv,
  downloadSchoolWiseBlockClaimPdf,
  downloadStudentWiseBlockClaimLandscapePdf,
  downloadBlockCoveringLetterPdf,
  SchoolWiseClaimPdfRow
} from '../utils/printHelper';
import { 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Send, 
  AlertTriangle, 
  FileText, 
  Check, 
  X,
  Pencil,
  Save,
  ShieldCheck, 
  Printer, 
  Bell, 
  Clock, 
  Calendar,
  Users,
  Search,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { MaterialIcon } from './MaterialIcon';
import { TamilCoveringLetterModal } from './TamilCoveringLetterModal';

interface BlockViewProps {
  currentUser: UserSession;
  cycleInfo: DynamicCycleInfo;
  activeSubTab: 'dashboard' | 'verification';
  onNavigateTab: (tab: string) => void;
  onRefresh: () => void;
}

export const BlockView: React.FC<BlockViewProps> = ({
  currentUser,
  cycleInfo,
  activeSubTab,
  onNavigateTab,
  onRefresh,
}) => {
  const rawBlockId = currentUser.blockId || '330412';
  const cleanBlockId = rawBlockId.replace(/^BL/i, '').trim();
  const blockMeta = VELLORE_BLOCKS.find(b => 
    b.id === rawBlockId || 
    b.id === cleanBlockId || 
    b.code === cleanBlockId ||
    (b.name && currentUser.blockName && b.name.toUpperCase() === currentUser.blockName.toUpperCase())
  ) || VELLORE_BLOCKS[0];
  const blockId = blockMeta.id;

  const [, setTick] = useState(0);

  useEffect(() => {
    claimStore.syncFromSupabase().catch(() => {});
    const unsub = claimStore.subscribe(() => {
      setTick(t => t + 1);
    });
    const handleStorage = () => {
      claimStore.syncFromSupabase().catch(() => {});
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      unsub();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const schoolsInBlock = claimStore.getSchoolsForBlock(blockId);
  const blockClaim = claimStore.getBlockClaimForCurrentMonth(blockId);

  // All school claims submitted in this block for current cycle
  const storeState = claimStore.getState();
  const schoolClaimsInBlock = storeState.schoolClaims.filter(c => {
    const cBlockId = (c.blockId || '').replace(/^BL/i, '').trim();
    const isSameBlock = 
      cBlockId === blockId || 
      c.blockId === blockMeta.id ||
      (c.blockName && blockMeta.name && c.blockName.toUpperCase() === blockMeta.name.toUpperCase()) ||
      schoolsInBlock.some(s => s.udiseCode === c.udiseCode);
    const isSameCycle = c.claimMonthKey === cycleInfo.claimMonthKey || !c.claimMonthKey;
    const isSubmitted = 
      c.isClaimSubmitted === true || 
      c.isForwardedToBlock === true ||
      c.status === 'SUBMITTED_BY_SCHOOL' ||
      c.status === 'BLOCK_APPROVED' ||
      c.status === 'BLOCK_CLAIM_SUBMITTED_TO_DISTRICT' ||
      c.status === 'DISTRICT_APPROVED' ||
      c.status === 'FINAL_DISTRICT_APPROVAL';
    return isSameBlock && isSameCycle && isSubmitted;
  });

  // Counts & Metrics
  const totalSchools = schoolsInBlock.length;
  const submittedSchoolsCount = schoolClaimsInBlock.length;
  const notSubmittedSchoolsCount = totalSchools - submittedSchoolsCount;

  const approvedSchoolsCount = schoolClaimsInBlock.filter(
    c => c.status === 'BLOCK_APPROVED' || c.status === 'BLOCK_CLAIM_SUBMITTED_TO_DISTRICT' || c.status === 'DISTRICT_APPROVED' || c.status === 'FINAL_DISTRICT_APPROVAL'
  ).length;

  const rejectedSchoolsCount = schoolClaimsInBlock.filter(c => c.status === 'BLOCK_REJECTED').length;
  const pendingVerificationCount = schoolClaimsInBlock.filter(c => c.status === 'SUBMITTED_BY_SCHOOL' || c.status === 'PENDING_BLOCK_VERIFICATION').length;

  // Total Students Claimed & Total Amounts
  const totalStudentsClaimed = schoolClaimsInBlock.reduce((acc, c) => acc + c.totalStudents, 0);
  const totalAmountClaimed = schoolClaimsInBlock.reduce((acc, c) => acc + c.totalClaimAmount, 0);

  // District Approval Status
  const isDistrictApproved = blockClaim && (
    blockClaim.status === 'DISTRICT_APPROVED' ||
    blockClaim.status === 'FINAL_DISTRICT_APPROVAL'
  );

  const isBlockClaimSubmitted = blockClaim && (
    blockClaim.status === 'BLOCK_CLAIM_SUBMITTED_TO_DISTRICT' ||
    blockClaim.status === 'RESUBMITTED_BY_BLOCK' ||
    isDistrictApproved
  );

  const isReturnedByDistrict = blockClaim && (
    blockClaim.status === 'DISTRICT_REJECTED' || blockClaim.status === 'CORRECTION_REQUIRED'
  );

  // Total Amount Approved by District
  const totalAmountApprovedByDistrict = schoolClaimsInBlock.reduce((acc, c) => {
    const isApproved = isDistrictApproved ||
      c.status === 'DISTRICT_APPROVED' ||
      c.status === 'FINAL_DISTRICT_APPROVAL' ||
      c.districtVerification?.decision === 'APPROVED';
    return acc + (isApproved ? c.totalClaimAmount : 0);
  }, 0);

  // Verifier details from district
  const districtVerifierName = storeState.schoolClaims.find(c => c.blockId === blockId && c.districtVerification)?.districtVerification?.verifiedByName || 'Dr. M. Sangeetha, Chief Educational Officer / DPC';
  const districtVerifiedAt = storeState.schoolClaims.find(c => c.blockId === blockId && c.districtVerification)?.districtVerification?.verifiedAt || 'Official Sanction Order';

  // Filter state for schools list
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'NOT_SUBMITTED'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showBlockCoveringLetterModal, setShowBlockCoveringLetterModal] = useState<boolean>(false);

  // Selected school for student-level verification drill-down (When clicked, other schools disappear)
  const [selectedVerificationSchoolUdise, setSelectedVerificationSchoolUdise] = useState<string | null>(null);

  // =========================================================================
  // STUDENT VERIFICATION INTERACTIVE STATE
  // =========================================================================
  // 1. Approval status map: Record<studentId, boolean> (true = approved, false = unapproved/editing)
  const [studentApprovedMap, setStudentApprovedMap] = useState<Record<string, boolean>>({});

  // 2. Days availed override map: Record<studentId, number>
  const [studentDaysOverride, setStudentDaysOverride] = useState<Record<string, number>>({});

  // 3. Which student days column is currently in edit mode: studentId or null
  const [editingDaysStudentId, setEditingDaysStudentId] = useState<string | null>(null);

  // 4. Temporary input string while editing: Record<studentId, string>
  const [tempDaysInput, setTempDaysInput] = useState<Record<string, string>>({});

  // 5. Validation popup message: studentId or null (floats for 2 seconds)
  const [validationPopupStudentId, setValidationPopupStudentId] = useState<string | null>(null);

  // 6. Animated green tick mark after save: studentId or null (appears for 1 second)
  const [saveSuccessTickStudentId, setSaveSuccessTickStudentId] = useState<string | null>(null);

  // Focus Refs
  const daysInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const actionButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // School level submit validation state: which student ids were unverified
  const [unverifiedStudentIds, setUnverifiedStudentIds] = useState<string[]>([]);
  const [schoolSubmitAlertMessage, setSchoolSubmitAlertMessage] = useState<string | null>(null);

  // Block level submit validation state: which school udises were unverified
  const [unapprovedSchoolUdises, setUnapprovedSchoolUdises] = useState<string[]>([]);
  const [blockSubmitAlertMessage, setBlockSubmitAlertMessage] = useState<string | null>(null);

  // Master table freeze & blur effect
  const [isTableBlurredAndFreezed, setIsTableBlurredAndFreezed] = useState<boolean>(false);

  // Center device submission success overlay
  const [showSubmissionCenterPopup, setShowSubmissionCenterPopup] = useState<boolean>(false);

  // Download section visibility (shown after block submission)
  const [showDownloadSection, setShowDownloadSection] = useState<boolean>(false);

  const [verificationRemarks, setVerificationRemarks] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [resubmitSuccessToast, setResubmitSuccessToast] = useState<string | null>(null);

  // View Submitted Block Claim modal
  const [viewBlockClaimModal, setViewBlockClaimModal] = useState<boolean>(false);

  // Selected school record under drill-down
  const currentVerificationSchool = schoolsInBlock.find(s => s.udiseCode === selectedVerificationSchoolUdise) || VELLORE_SCHOOLS.find(s => s.udiseCode === selectedVerificationSchoolUdise);
  const currentVerificationClaim = schoolClaimsInBlock.find(c => c.udiseCode === selectedVerificationSchoolUdise);

  // Helper to calculate student approved amount (auto calculated like in school login user)
  const getStudentApprovedAmount = (st: StudentClaimItem): number => {
    const effectiveDays = studentDaysOverride[st.id] !== undefined ? studentDaysOverride[st.id] : st.daysAttended;
    const workingDays = st.workingDaysInMonth || 22;
    return calculateStudentClaimAmount(effectiveDays, workingDays);
  };

  // Calculate live approved amount for the entire school based on approved students
  const currentSchoolApprovedAmount = currentVerificationClaim ? currentVerificationClaim.students.reduce((acc, st) => {
    if (studentApprovedMap[st.id]) {
      return acc + getStudentApprovedAmount(st);
    }
    return acc;
  }, 0) : 0;

  // Handler to open school verification: Other schools disappear, student table appears!
  const handleOpenSchoolVerification = (udise: string) => {
    setSelectedVerificationSchoolUdise(udise);
    const targetClaim = schoolClaimsInBlock.find(c => c.udiseCode === udise);
    if (targetClaim) {
      if (!targetClaim.students || targetClaim.students.length === 0) {
        targetClaim.students = claimStore.generateDefaultStudentsForUdise(udise, targetClaim.totalStudents || 4);
      }
      setStudentApprovedMap({});
      setStudentDaysOverride({});
      setEditingDaysStudentId(null);
      setValidationPopupStudentId(null);
      setSaveSuccessTickStudentId(null);
      setUnverifiedStudentIds([]);
      setSchoolSubmitAlertMessage(null);
      setVerificationRemarks(targetClaim.blockVerification?.remarks || 'All student physical attendance registers verified with EMIS records.');
    }
  };

  // =========================================================================
  // ACTION FLOW 1: When user clicks green colour tick mark under Action column
  // =========================================================================
  const handleApproveStudent = (studentId: string) => {
    setStudentApprovedMap(prev => ({
      ...prev,
      [studentId]: true
    }));
    // Clear unverified flag if present
    setUnverifiedStudentIds(prev => prev.filter(id => id !== studentId));
  };

  // =========================================================================
  // ACTION FLOW 2: When user clicks pencil icon under Action column to edit
  // =========================================================================
  const handleEditApprovedStudent = (studentId: string) => {
    setStudentApprovedMap(prev => ({
      ...prev,
      [studentId]: false
    }));
  };

  // =========================================================================
  // ACTION FLOW 3: When Block user clicks red colour cross mark under Action column
  // =========================================================================
  const handleCrossMarkClick = (student: StudentClaimItem) => {
    const studentId = student.id;
    const currentDays = studentDaysOverride[studentId] !== undefined ? studentDaysOverride[studentId] : student.daysAttended;

    // 1. Show popup message under this column: "Please validate the attendance and save."
    setValidationPopupStudentId(studentId);

    // 2. Put column in editable mode
    setEditingDaysStudentId(studentId);
    setTempDaysInput(prev => ({ ...prev, [studentId]: String(currentDays) }));

    // 3. After 2 seconds, disappear this popup message
    setTimeout(() => {
      setValidationPopupStudentId(prev => (prev === studentId ? null : prev));
    }, 2000);

    // 4. Focus the input
    setTimeout(() => {
      daysInputRefs.current[studentId]?.focus();
      daysInputRefs.current[studentId]?.select();
    }, 100);
  };

  // =========================================================================
  // ACTION FLOW 4: When user clicks Save button for edited attendance
  // =========================================================================
  const handleSaveEditedDays = (student: StudentClaimItem) => {
    const studentId = student.id;
    const maxWorkingDays = student.workingDaysInMonth || 22;
    let parsed = parseInt(tempDaysInput[studentId] || '0', 10);
    if (isNaN(parsed) || parsed < 0) parsed = 0;
    if (parsed > maxWorkingDays) parsed = maxWorkingDays;

    // Save modified data
    setStudentDaysOverride(prev => ({ ...prev, [studentId]: parsed }));

    // Save button immediately hides
    setEditingDaysStudentId(null);

    // Green colour animated tick mark appears
    setSaveSuccessTickStudentId(studentId);

    // After 1 second, green colour tick mark disappears and cursor automatically goes under Action column
    setTimeout(() => {
      setSaveSuccessTickStudentId(prev => (prev === studentId ? null : prev));
      actionButtonRefs.current[studentId]?.focus();
    }, 1000);
  };

  // =========================================================================
  // SCHOOL SUBMIT BUTTON CLICK HANDLER (Below of the last student)
  // =========================================================================
  const handleSchoolSubmitClick = () => {
    if (!currentVerificationClaim) return;

    // Check if ALL students are verified
    const unverified = currentVerificationClaim.students.filter(st => !studentApprovedMap[st.id]);
    if (unverified.length > 0) {
      setUnverifiedStudentIds(unverified.map(s => s.id));
      setSchoolSubmitAlertMessage(`Please complete verification for all students. ${unverified.length} student(s) marked with a red cross are not verified.`);
      setTimeout(() => setSchoolSubmitAlertMessage(null), 3500);
      return;
    }

    // All students verified!
    setUnverifiedStudentIds([]);
    setSchoolSubmitAlertMessage(null);

    // Save school claim as BLOCK_APPROVED
    const res = claimStore.verifySchoolClaimByBlock(
      currentVerificationClaim.udiseCode,
      'APPROVED',
      verificationRemarks,
      currentUser,
      undefined,
      currentSchoolApprovedAmount
    );

    if (!res.success) {
      setActionError(res.message);
    } else {
      setActionSuccess(`School ${currentVerificationClaim.schoolName} verified and approved. Amount ₹${currentSchoolApprovedAmount.toLocaleString('en-IN')} approved.`);
      setTimeout(() => setActionSuccess(null), 3000);

      // Submit button immediately hides and all student details disappear (returns to master school table)
      setSelectedVerificationSchoolUdise(null);
      setVerificationRemarks('');
      onRefresh();
    }
  };

  // =========================================================================
  // BLOCK SUBMIT TO DISTRICT CLICK HANDLER (Under last school in center position)
  // =========================================================================
  const handleBlockSubmitToDistrictClick = () => {
    // Check if any school is not verified and approved
    const unapproved = schoolsInBlock.filter(s => {
      const c = schoolClaimsInBlock.find(sc => sc.udiseCode === s.udiseCode);
      return !c || (c.status !== 'BLOCK_APPROVED' && c.status !== 'BLOCK_CLAIM_SUBMITTED_TO_DISTRICT' && c.status !== 'DISTRICT_APPROVED');
    });

    if (unapproved.length > 0) {
      setUnapprovedSchoolUdises(unapproved.map(s => s.udiseCode));
      setBlockSubmitAlertMessage(`Cannot submit to District: ${unapproved.length} school(s) indicated with a red cross are not verified and approved yet.`);
      setTimeout(() => setBlockSubmitAlertMessage(null), 3500);
      return;
    }

    // All schools verified and approved!
    setUnapprovedSchoolUdises([]);
    setBlockSubmitAlertMessage(null);

    // 1. Submit button automatically hides
    // 2. All schools details are freezed and blurred
    setIsTableBlurredAndFreezed(true);

    // 3. Immediately animated tick mark appears in center of device with message:
    // "this Block(Block name) - current month (current month name) claim is successfully submitted to DPO, Samagra Shiksha, Vellore"
    setShowSubmissionCenterPopup(true);

    // Save block claim submission
    claimStore.submitBlockClaimToDistrict(blockId, currentUser);

    // 4. After two seconds this message disappeared. Previous blurred school details are restored it's original (but freezed) immediately below this download section appear
    setTimeout(() => {
      setShowSubmissionCenterPopup(false);
      setIsTableBlurredAndFreezed(false);
      setShowDownloadSection(true);
      onRefresh();
    }, 2000);
  };

  // 1. Download School-wise Claim Amount PDF (A4 Landscape with exact specified columns, headers, and signatures)
  const handleDownloadSchoolWiseClaimPdf = () => {
    const schoolRows: SchoolWiseClaimPdfRow[] = schoolsInBlock.map((s, idx) => {
      const claim = schoolClaimsInBlock.find(c => c.udiseCode === s.udiseCode);
      const isApproved = claim && (
        claim.status === 'BLOCK_APPROVED' ||
        claim.status === 'BLOCK_CLAIM_SUBMITTED_TO_DISTRICT' ||
        claim.status === 'DISTRICT_APPROVED' ||
        claim.status === 'FINAL_DISTRICT_APPROVAL'
      );

      const transStudents = claim ? claim.students.filter(st => st.category === 'Transport' && st.daysAttended > 0) : [];
      const escortStudents = claim ? claim.students.filter(st => st.category === 'Escort' && st.daysAttended > 0) : [];

      const transClaimAmt = transStudents.reduce((acc, st) => acc + st.totalClaimAmount, 0);
      const escortClaimAmt = escortStudents.reduce((acc, st) => acc + st.totalClaimAmount, 0);
      const totalClaimAmt = transClaimAmt + escortClaimAmt;

      const approvedTrans = isApproved ? transClaimAmt : 0;
      const approvedEscort = isApproved ? escortClaimAmt : 0;
      const approvedTot = isApproved ? (claim ? claim.totalClaimAmount : totalClaimAmt) : 0;

      return {
        slNo: idx + 1,
        schoolName: s.name,
        udiseCode: s.udiseCode,
        totalWorkingDays: claim?.students[0]?.workingDaysInMonth || 22,
        transportClaim: {
          noOfStudents: transStudents.length,
          amount: transClaimAmt,
        },
        escortClaim: {
          noOfStudents: escortStudents.length,
          amount: escortClaimAmt,
        },
        totalClaimedAmount: totalClaimAmt,
        approvedByBlock: {
          transport: approvedTrans,
          escort: approvedEscort,
          total: approvedTot,
        },
      };
    });

    const subDate = blockClaim?.submissionDateTime || new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    downloadSchoolWiseBlockClaimPdf({
      blockName: blockMeta.name,
      monthName: cycleInfo.claimMonthOnlyName,
      submissionDate: subDate,
      schools: schoolRows,
    });
  };

  // 2. Download Block wise claim amount (Student-wise claim amount across all schools in Block)
  const handleDownloadStudentWiseClaimPdf = () => {
    let globalSlNo = 1;
    const schoolGroups = schoolsInBlock.map(s => {
      const claim = schoolClaimsInBlock.find(c => c.udiseCode === s.udiseCode);
      const isApproved = claim && (
        claim.status === 'BLOCK_APPROVED' ||
        claim.status === 'BLOCK_CLAIM_SUBMITTED_TO_DISTRICT' ||
        claim.status === 'DISTRICT_APPROVED' ||
        claim.status === 'FINAL_DISTRICT_APPROVAL'
      );

      // Student rows for this school
      let studentsList: any[] = [];
      if (claim && claim.students && claim.students.length > 0) {
        studentsList = claim.students.map(st => {
          const daysAvailed = studentDaysOverride[st.id] !== undefined ? studentDaysOverride[st.id] : st.daysAttended;
          const claimedAmt = st.totalClaimAmount;
          // Approved amount by block
          const approvedAmt = (studentApprovedMap[st.id] || isApproved) 
            ? getStudentApprovedAmount(st) 
            : 0;

          return {
            slNo: globalSlNo++,
            studentName: st.studentName,
            emisNumber: st.emisNumber,
            grade: st.grade,
            panchayatName: st.panchayatName || `${blockMeta.name} Panchayat`,
            workingDays: st.workingDaysInMonth || claim.students[0]?.workingDaysInMonth || 22,
            mode: st.category,
            daysAvailed: daysAvailed,
            claimedAmount: claimedAmt,
            approvedAmount: approvedAmt,
          };
        });
      } else {
        // Fallback for school that has default beneficiaries in master
        const defaultTotal = s.defaultBeneficiaries || 4;
        for (let i = 1; i <= defaultTotal; i++) {
          studentsList.push({
            slNo: globalSlNo++,
            studentName: `Student Beneficiary ${i}`,
            emisNumber: `${s.udiseCode}${String(i).padStart(3, '0')}`,
            grade: `Class ${6 + (i % 4)}`,
            panchayatName: `${blockMeta.name} Panchayat`,
            workingDays: 22,
            mode: i % 2 === 1 ? 'Transport' : 'Escort',
            daysAvailed: 0,
            claimedAmount: 0,
            approvedAmount: 0,
          });
        }
      }

      return {
        schoolName: s.name,
        udiseCode: s.udiseCode,
        students: studentsList,
      };
    });

    const subDate = blockClaim?.submissionDateTime || new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    downloadStudentWiseBlockClaimLandscapePdf({
      blockName: blockMeta.name,
      monthName: cycleInfo.claimMonthOnlyName,
      submissionDate: subDate,
      schools: schoolGroups,
    });
  };

  // 3. Download Covering Letter PDF
  const handleDownloadCoveringLetterPdf = async () => {
    const subDate = blockClaim?.submissionDateTime || new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    await downloadBlockCoveringLetterPdf({
      blockName: blockMeta.name,
      monthName: cycleInfo.claimMonthOnlyName,
      submissionDate: subDate,
      totalSchools: totalSchools,
      totalStudents: totalStudentsClaimed,
      totalAmount: totalAmountClaimed,
      bmoName: blockMeta.bmoName,
    });
  };

  // Resubmit Block claim when returned/rejected by District
  const handleResubmitBlockToDistrict = () => {
    setActionError(null);
    const res = claimStore.submitBlockClaimToDistrict(blockId, currentUser);
    if (!res.success) {
      setActionError(res.message);
    } else {
      setResubmitSuccessToast('Claim resubmitted to District successfully. Notification sent to District user login home page.');
      setTimeout(() => setResubmitSuccessToast(null), 3500);
      onRefresh();
    }
  };

  const filteredSchools = schoolsInBlock.filter(school => {
    const claim = schoolClaimsInBlock.find(c => c.udiseCode === school.udiseCode);
    const isSubmitted = !!claim;

    if (statusFilter === 'SUBMITTED' && !isSubmitted) return false;
    if (statusFilter === 'NOT_SUBMITTED' && isSubmitted) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return school.name.toLowerCase().includes(q) || school.udiseCode.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* 2-Second Center Device Submission Success Popup */}
      {showSubmissionCenterPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative max-w-lg w-full bg-white/95 backdrop-blur-2xl rounded-3xl border-2 border-emerald-400 p-8 shadow-2xl text-center flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
            {/* Animated Green Tick Mark */}
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg ring-8 ring-emerald-50 animate-in zoom-in-75 duration-300">
              <Check className="w-10 h-10 stroke-[3.5] animate-bounce" />
            </div>

            {/* Message per exact requirement */}
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
                this Block({blockMeta.name}) - current month ({cycleInfo.claimMonthOnlyName}) claim is successfully submitted to DPO, Samagra Shiksha, Vellore
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Official consolidated sanction proposal generated and transferred to District Project Office.
              </p>
            </div>

            <div className="w-12 h-1 bg-emerald-500 rounded-full animate-pulse mt-1" />
          </div>
        </div>
      )}

      {/* Toast Popup for Resubmission */}
      {resubmitSuccessToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="px-6 py-3 rounded-full bg-slate-900/95 backdrop-blur-xl border border-emerald-500/60 text-white text-xs font-semibold shadow-2xl flex items-center gap-2.5 ring-2 ring-emerald-500/30">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="tracking-wide">{resubmitSuccessToast}</span>
          </div>
        </div>
      )}

      {actionSuccess && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="px-6 py-3 rounded-full bg-slate-900/95 backdrop-blur-xl border border-emerald-500/60 text-white text-xs font-semibold shadow-2xl flex items-center gap-2.5 ring-2 ring-emerald-500/30">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="tracking-wide">{actionSuccess}</span>
          </div>
        </div>
      )}

      {actionError && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="px-6 py-3 rounded-full bg-slate-900/95 backdrop-blur-xl border border-red-500/60 text-white text-xs font-semibold shadow-2xl flex items-center gap-2.5 ring-2 ring-red-500/30">
            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="tracking-wide">{actionError}</span>
          </div>
        </div>
      )}

      {/* Block Header Card */}
      <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-13 h-13 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">{blockMeta.name} Block</h2>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                  Block Code: {blockMeta.code}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Active BEO Portal
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1.5">
                <span>Block Educational Officer: <strong className="text-slate-900">{blockMeta.bmoName}</strong></span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span>Email: <strong className="text-slate-700">{blockMeta.email}</strong></span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span>Jurisdiction: <strong className="text-slate-900">{totalSchools} Primary/Middle/High Schools</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {(isBlockClaimSubmitted || showDownloadSection) && (
              <button
                type="button"
                onClick={() => setViewBlockClaimModal(true)}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-full shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span>View Submitted Block Claim</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedVerificationSchoolUdise(null);
                onNavigateTab(activeSubTab === 'verification' ? 'dashboard' : 'verification');
              }}
              className={`px-4 py-2 text-xs font-bold rounded-full transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                activeSubTab === 'verification'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <span>{activeSubTab === 'verification' ? 'Back to Home Dashboard' : 'Go to Claim Verification'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CASE A: HOME PAGE VIEW (`activeSubTab === 'dashboard'`)                   */}
      {/* ========================================================================= */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6">
          
          {/* 1. NOTIFICATIONS MODULE */}
          <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Notifications &amp; Claim Alerts</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  </h3>
                  <p className="text-xs text-slate-500">
                    Real-time official notifications, submission reminders, and District approval/rejection updates
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                Cycle: {cycleInfo.claimMonthName}
              </span>
            </div>

            <div className="space-y-3">
              {/* Reminder (Auto-hides after submission) */}
              {!isBlockClaimSubmitted ? (
                <div className="p-4 rounded-2xl bg-amber-50/90 border-2 border-amber-300 text-amber-950 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <div className="font-bold text-xs uppercase tracking-wider text-amber-900">
                        Monthly Claim Submission Reminder
                      </div>
                      <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed">
                        The calculation period for <strong>{cycleInfo.claimMonthOnlyName}</strong> has ended. Transport &amp; Escort facility claims from all schools under {blockMeta.name} Block should be verified and submitted to the District Educational Office.
                      </p>
                      <div className="text-[11px] text-amber-800 font-semibold mt-1">
                        Progress: {submittedSchoolsCount} of {totalSchools} schools submitted · {approvedSchoolsCount} verified &amp; approved
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('verification')}
                    className="px-4 py-2 rounded-full font-bold text-xs text-white bg-amber-600 hover:bg-amber-700 active:scale-95 transition-all shadow-xs shrink-0 cursor-pointer"
                  >
                    Verify &amp; Submit Claims
                  </button>
                </div>
              ) : null}

              {/* Submitted Confirmation */}
              {isBlockClaimSubmitted && (
                <div className="p-4 rounded-2xl bg-blue-50/90 border-2 border-blue-300 text-blue-950 shadow-xs flex items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-xs uppercase tracking-wider text-blue-900">
                        Block Claim Successfully Submitted to District
                      </div>
                      <p className="text-xs text-blue-900 mt-0.5 leading-relaxed">
                        Claim submitted by Block user (<strong>{blockClaim?.submittedBy || currentUser.name}</strong>) on{' '}
                        <strong className="font-mono text-slate-900">{blockClaim?.submissionDateTime || 'Recently'}</strong>. Consolidated {blockClaim?.submittedSchoolsCount || submittedSchoolsCount} schools, totalling ₹{(blockClaim?.totalClaimAmount || totalAmountClaimed).toLocaleString('en-IN')}.
                      </p>
                      <div className="text-[11px] text-blue-800 font-medium mt-0.5">
                        Status: Currently under review by District Educational Authority.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewBlockClaimModal(true)}
                    className="px-3.5 py-1.5 rounded-full font-bold text-xs text-blue-900 bg-white hover:bg-blue-100 border border-blue-300 shadow-2xs shrink-0 cursor-pointer"
                  >
                    View Submission
                  </button>
                </div>
              )}

              {/* District Approval Notification */}
              {isDistrictApproved && (
                <div className="p-4 rounded-2xl bg-emerald-50/95 border-2 border-emerald-400 text-emerald-950 shadow-sm flex items-start gap-3 animate-in fade-in duration-200">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs uppercase tracking-wider text-emerald-900">
                        District Sanction Approved
                      </span>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900">
                        ECS DBT Release
                      </span>
                    </div>
                    <p className="text-xs text-emerald-900 mt-0.5 leading-relaxed">
                      The Transport &amp; Escort facility block claim for <strong>{cycleInfo.claimMonthOnlyName}</strong> has been officially approved by the District Educational Authority (<strong>{districtVerifierName}</strong>) on <span className="font-mono">{districtVerifiedAt}</span>.
                    </p>
                    <div className="text-[11px] text-emerald-800 font-semibold mt-1">
                      Sanction Order released: Total approved amount of ₹{totalAmountApprovedByDistrict.toLocaleString('en-IN')} has been cleared for direct DBT disbursement to School SMC bank accounts.
                    </div>
                  </div>
                </div>
              )}

              {/* District Rejection / Return Notification */}
              {isReturnedByDistrict && (
                <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 animate-bounce" />
                    <div>
                      <div className="font-bold text-xs uppercase tracking-wider text-rose-900">
                        District Discrepancy Notice: Block Claim Returned for Correction
                      </div>
                      <p className="text-xs text-rose-900 mt-0.5 leading-relaxed">
                        The District Educational Authority has returned the block claim for <strong>{cycleInfo.claimMonthOnlyName}</strong>. 
                        Remarks: <strong className="text-rose-950">"{blockClaim?.rejectionRemarks || 'Discrepancy detected in student attendance records. Please review and resubmit.'}"</strong>
                      </p>
                      <div className="text-[11px] text-rose-800 font-medium mt-1">
                        Previous claim entry details are maintained. You can adjust verification and click Resubmit.
                      </div>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleResubmitBlockToDistrict}
                    className="px-5 py-2 rounded-full font-bold text-xs text-white bg-gradient-to-r from-rose-600 via-rose-700 to-rose-800 hover:from-rose-500 hover:to-rose-600 active:scale-95 transition-all shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Resubmit Block Claim to District</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 2. DASHBOARD MODULE */}
          <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Dashboard: School Claim Breakdown for {cycleInfo.claimMonthOnlyName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consolidated details of schools claimed in the previous claim month, students count, amount claimed, and amount approved by District
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('verification')}
                className="px-4 py-2 rounded-full font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-md flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                <span>Open Claim Verification Table</span>
                <MaterialIcon name="arrow_forward" className="text-sm" />
              </button>
            </div>

            {/* 4 Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Total Schools in Block</span>
                  <MaterialIcon name="school" className="text-lg text-slate-600" />
                </div>
                <div className="text-xl font-mono font-bold text-slate-900 mt-1">{totalSchools}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{submittedSchoolsCount} Submitted · {notSubmittedSchoolsCount} Pending</div>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 shadow-2xs">
                <div className="flex items-center justify-between text-blue-700 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Total Students Claimed</span>
                  <MaterialIcon name="groups" className="text-lg text-blue-600" />
                </div>
                <div className="text-xl font-mono font-bold text-blue-900 mt-1">{totalStudentsClaimed}</div>
                <div className="text-[10px] text-blue-700 mt-0.5">All transport &amp; escort beneficiaries</div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-2xs">
                <div className="flex items-center justify-between text-amber-800 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Amount Claimed by Schools</span>
                  <MaterialIcon name="payments" className="text-lg text-amber-600" />
                </div>
                <div className="text-xl font-mono font-bold text-amber-900 mt-1">₹{totalAmountClaimed.toLocaleString('en-IN')}</div>
                <div className="text-[10px] text-amber-700 mt-0.5">Total school level requests</div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 shadow-2xs">
                <div className="flex items-center justify-between text-emerald-800 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Approved Amount by District</span>
                  <MaterialIcon name="verified" className="text-lg text-emerald-600" />
                </div>
                <div className="text-xl font-mono font-bold text-emerald-950 mt-1">₹{totalAmountApprovedByDistrict.toLocaleString('en-IN')}</div>
                <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                  {isDistrictApproved ? '100% Cleared for Disbursement' : 'Pending District Final Order'}
                </div>
              </div>
            </div>

            {/* School Overview Table on Home */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-left border-collapse">
                  <thead className="bg-slate-100/95 text-slate-800 uppercase font-bold text-xs border-b border-slate-300">
                    <tr>
                      <th className="py-3.5 px-3 text-center w-12 align-middle text-slate-800">Sl.no</th>
                      <th className="py-3.5 px-3 align-middle min-w-[170px] text-slate-800">School Name &amp; UDISE</th>
                      <th className="py-3.5 px-3 align-middle min-w-[150px] text-slate-800">Category &amp; HM</th>
                      <th className="py-3.5 px-3 text-center align-middle w-28 whitespace-normal leading-tight text-slate-800">Students Claimed</th>
                      <th className="py-3.5 px-3 text-right align-middle w-36 whitespace-normal leading-tight text-slate-800">Amount Claimed by School</th>
                      <th className="py-3.5 px-3 text-right align-middle w-36 whitespace-normal leading-tight text-slate-800">Approved Amount by District</th>
                      <th className="py-3.5 px-3 text-center align-middle w-28 text-slate-800">Status</th>
                      <th className="py-3.5 px-3 text-center align-middle w-28 text-slate-800">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 font-medium text-slate-800">
                    {filteredSchools.map((school, idx) => {
                      const claim = schoolClaimsInBlock.find(c => c.udiseCode === school.udiseCode);
                      const isSubmitted = !!claim;
                      const studentsCount = claim ? claim.totalStudents : 0;
                      const claimedAmt = claim ? claim.totalClaimAmount : 0;
                      const isSchoolApproved = claim && (
                        isDistrictApproved ||
                        claim.status === 'DISTRICT_APPROVED' ||
                        claim.status === 'FINAL_DISTRICT_APPROVAL' ||
                        claim.districtVerification?.decision === 'APPROVED'
                      );
                      const approvedAmt = isSchoolApproved ? claimedAmt : 0;

                      return (
                        <tr key={school.udiseCode} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50/90 transition-colors whitespace-nowrap' : 'bg-slate-50/70 hover:bg-slate-100/80 transition-colors whitespace-nowrap'}>
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{school.name}</div>
                            <div className="text-[10.5px] font-mono text-slate-500">UDISE: {school.udiseCode}</div>
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            <div>{school.category}</div>
                            <div className="text-[10.5px] text-slate-500">HM: {school.headmasterName}</div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isSubmitted ? (
                              <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                {studentsCount} Students
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">0 (Pending)</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            {isSubmitted ? `₹${claimedAmt.toLocaleString('en-IN')}` : '₹0'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold">
                            {isSchoolApproved ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                ₹{approvedAmt.toLocaleString('en-IN')} ✓
                              </span>
                            ) : (
                              <span className="text-slate-400">₹0</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isSubmitted ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                {claim.status.replace(/_/g, ' ')}
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                NOT SUBMITTED
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isSubmitted ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onNavigateTab('verification');
                                  handleOpenSchoolVerification(school.udiseCode);
                                }}
                                className="px-3 py-1 rounded-full font-bold text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 shadow-2xs transition-all flex items-center gap-1 mx-auto cursor-pointer"
                              >
                                <MaterialIcon name="visibility" className="text-xs" />
                                <span>Verify Claim</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Awaiting</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 text-slate-900 font-bold border-t-2 border-slate-300 text-xs">
                    <tr>
                      <td colSpan={3} className="py-3 px-3 text-slate-900 uppercase">Grand Total</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">{totalStudentsClaimed} Students</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">₹{totalAmountClaimed.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800">₹{totalAmountApprovedByDistrict.toLocaleString('en-IN')}</td>
                      <td colSpan={2} className="py-3 px-3 text-center text-slate-600">
                        {isDistrictApproved ? 'District Sanction Complete' : 'Active Cycle'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* CASE B: CLAIM VERIFICATION TAB (`activeSubTab === 'verification'`)        */}
      {/* ========================================================================= */}
      {activeSubTab === 'verification' && (
        <div className="space-y-6">
          
          {/* Sub-view B1: Drill-down on clicked School: other schools disappear! */}
          {selectedVerificationSchoolUdise !== null && currentVerificationSchool && currentVerificationClaim ? (
            <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg space-y-6 animate-in fade-in zoom-in-95 duration-200">
              
              {/* Back to All Schools & School Details Top Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedVerificationSchoolUdise(null)}
                    className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5 font-bold text-xs"
                    title="Return to all schools list"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to All Schools</span>
                  </button>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span>{currentVerificationClaim.schoolName}</span>
                      <span className="text-xs font-mono font-semibold text-slate-500 px-2 py-0.5 bg-slate-100 rounded-md">
                        UDISE: {currentVerificationClaim.udiseCode}
                      </span>
                    </h3>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Submitted on: <strong className="font-mono text-slate-800">{currentVerificationClaim.submissionDateTime}</strong> by <strong>{currentVerificationClaim.submittedBy}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadOfficialClaimLandscapePdf({
                      schoolName: currentVerificationClaim.schoolName,
                      udiseCode: currentVerificationClaim.udiseCode,
                      blockName: currentVerificationClaim.blockName,
                      monthName: currentVerificationClaim.claimMonthName,
                      totalWorkingDays: currentVerificationClaim.students[0]?.workingDaysInMonth || 22,
                      students: currentVerificationClaim.students,
                      hmName: currentVerificationClaim.submittedBy
                    })}
                    className="px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>Print PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadClaimCsv({
                      schoolName: currentVerificationClaim.schoolName,
                      udiseCode: currentVerificationClaim.udiseCode,
                      blockName: currentVerificationClaim.blockName,
                      monthName: currentVerificationClaim.claimMonthName,
                      totalWorkingDays: currentVerificationClaim.students[0]?.workingDaysInMonth || 22,
                      students: currentVerificationClaim.students
                    })}
                    className="px-3.5 py-1.5 rounded-full text-xs font-bold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>

              {/* School Quota & Claim Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Total Claimed Students</span>
                  <span className="font-bold font-mono text-slate-900 text-sm block mt-0.5">
                    {currentVerificationClaim.totalStudents} Students
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Transport: {currentVerificationClaim.students.filter(s => s.category === 'Transport').length} · Escort: {currentVerificationClaim.students.filter(s => s.category === 'Escort').length}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Amount Claimed by School</span>
                  <span className="font-bold font-mono text-slate-900 text-sm block mt-0.5">
                    ₹{currentVerificationClaim.totalClaimAmount.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-500">School Submitted Request</span>
                </div>

                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-300">
                  <span className="text-[10.5px] uppercase font-bold text-emerald-800 block">Claim Amount Approved by Block</span>
                  <span className="font-bold font-mono text-emerald-950 text-base block mt-0.5">
                    ₹{currentSchoolApprovedAmount.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold">
                    Live Sum of Approved Students ({Object.values(studentApprovedMap).filter(Boolean).length} / {currentVerificationClaim.students.length} Approved)
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Verification Status</span>
                  <span className="font-bold text-slate-900 text-xs block mt-0.5">
                    {currentVerificationClaim.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-slate-500">BEO Level Verification</span>
                </div>
              </div>

              {/* Student Beneficiaries Table with Requested Interactive Workflow */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="px-4 py-3 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-800">
                    Student Details Verification ({currentVerificationClaim.students.length} Beneficiaries)
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Click <strong className="text-emerald-700">✓ Green Tick</strong> to approve (freezes amount with non-clickable tick). Click <strong className="text-rose-700">✕ Red Cross</strong> to edit &amp; validate attendance.
                  </div>
                </div>

                <div className="overflow-x-auto bg-white rounded-xl">
                  <table className="w-full text-xs sm:text-sm text-left border-collapse">
                    <thead className="bg-slate-100/95 text-slate-800 uppercase font-bold text-xs border-b border-slate-300">
                      <tr>
                        <th className="py-3 px-3 text-center w-14 align-middle text-slate-800">Serial Number</th>
                        <th className="py-3 px-3 min-w-[150px] align-middle text-slate-800">Student Name</th>
                        <th className="py-3 px-3 text-center min-w-[125px] align-middle text-slate-800">EMIS Number</th>
                        <th className="py-3 px-3 text-center min-w-[95px] align-middle text-slate-800">Class &amp; Section</th>
                        <th className="py-3 px-3 min-w-[130px] align-middle text-slate-800">Panchayat Name</th>
                        <th className="py-3 px-2.5 text-center w-28 whitespace-normal leading-tight align-middle text-slate-800">Total School Working Days</th>
                        <th className="py-3 px-3 text-center w-36 whitespace-normal leading-tight align-middle text-slate-800">
                          Days Availed in {cycleInfo.claimMonthOnlyName}
                        </th>
                        <th className="py-3 px-3 text-right w-36 whitespace-normal leading-tight align-middle text-slate-800">Amount Claimed by School</th>
                        <th className="py-3 px-3 text-center min-w-[120px] align-middle text-slate-800">Action</th>
                        <th className="py-3 px-3 text-right w-36 whitespace-normal leading-tight align-middle text-slate-800">Claim Amount Approved by Block</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 font-medium text-slate-800">
                      {currentVerificationClaim.students.map((st, idx) => {
                        const isApproved = !!studentApprovedMap[st.id];
                        const isUnverifiedFlagged = unverifiedStudentIds.includes(st.id) && !isApproved;
                        const effectiveDays = studentDaysOverride[st.id] !== undefined ? studentDaysOverride[st.id] : st.daysAttended;
                        const isDaysModified = studentDaysOverride[st.id] !== undefined && studentDaysOverride[st.id] !== st.daysAttended;
                        const calculatedApprovedAmount = getStudentApprovedAmount(st);

                        return (
                          <tr 
                            key={st.id || idx} 
                            className={`transition-colors whitespace-nowrap ${
                              isUnverifiedFlagged 
                                ? 'bg-rose-50/70 ring-1 ring-rose-300' 
                                : idx % 2 === 0
                                  ? 'bg-white hover:bg-slate-50/90'
                                  : 'bg-slate-50/70 hover:bg-slate-100/80'
                            }`}
                          >
                            {/* 1. Serial number */}
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">
                              {idx + 1}
                            </td>

                            {/* 2. Student name */}
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{st.studentName}</span>
                                {isUnverifiedFlagged && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded-full border border-rose-300">
                                    <X className="w-3 h-3 text-rose-600 stroke-[3]" />
                                    <span>Unverified</span>
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* 3. Emis number */}
                            <td className="py-3 px-3 font-mono text-slate-600">
                              {st.emisNumber}
                            </td>

                            {/* 4. Class & section */}
                            <td className="py-3 px-3 text-slate-700">
                              {st.grade}
                            </td>

                            {/* 5. Panchayat name */}
                            <td className="py-3 px-3 text-slate-700">
                              {st.panchayatName || `${blockMeta.name} Panchayat`}
                            </td>

                            {/* 6. Total number of school working days in previous month */}
                            <td className="py-3 px-2.5 text-center font-mono text-slate-700">
                              {st.workingDaysInMonth || 22}
                            </td>

                            {/* 7. Total number of days he (student) availed the transport/escort facility in the month of (previous month name) */}
                            <td className="py-3 px-3 text-center relative">
                              {/* 2-Second Floating Popup Message: "Please validate the attendance and save." */}
                              {validationPopupStudentId === st.id && (
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-bold shadow-xl border border-amber-400 whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 duration-150 flex items-center gap-1.5 pointer-events-none">
                                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                                  <span>Please validate the attendance and save.</span>
                                </div>
                              )}

                              {/* Editable state when Red cross mark was clicked */}
                              {editingDaysStudentId === st.id ? (
                                <div className="inline-flex items-center gap-1.5 animate-in zoom-in-95 duration-100">
                                  <input
                                    ref={el => { daysInputRefs.current[st.id] = el; }}
                                    type="number"
                                    min={0}
                                    max={st.workingDaysInMonth || 22}
                                    value={tempDaysInput[st.id] !== undefined ? tempDaysInput[st.id] : effectiveDays}
                                    onChange={(e) => setTempDaysInput(prev => ({ ...prev, [st.id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSaveEditedDays(st);
                                      }
                                    }}
                                    className="w-14 px-2 py-1 text-xs font-mono font-bold text-center border border-amber-500 rounded-lg bg-white shadow-[0_2px_4px_rgba(0,0,0,0.03),inset_0_2px_3px_rgba(0,0,0,0.05),inset_0_-1px_1px_rgba(255,255,255,0.95)] focus:ring-2 focus:ring-amber-500/20 outline-none"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditedDays(st)}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs cursor-pointer transition-colors flex items-center gap-1"
                                    title="Save validated attendance"
                                  >
                                    <Save className="w-3 h-3" />
                                    <span>Save</span>
                                  </button>
                                </div>
                              ) : (
                                /* Normal display mode or green animated tick mark after saving */
                                <div className="inline-flex items-center justify-center gap-1.5">
                                  <span className={`font-mono font-bold text-xs ${
                                    isDaysModified 
                                      ? 'text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200' 
                                      : 'text-emerald-900'
                                  }`}>
                                    {effectiveDays} Days
                                  </span>

                                  {/* Green colour animated tick mark appears after save, disappears after 1 second */}
                                  {saveSuccessTickStudentId === st.id && (
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 font-bold text-xs animate-in zoom-in-75 duration-150">
                                      ✓
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* 8. Amount claimed by school */}
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              ₹{st.totalClaimAmount.toLocaleString('en-IN')}
                            </td>

                            {/* 9. Action column */}
                            <td className="py-3 px-3 text-center">
                              {isApproved ? (
                                /* When Approved: tick mark & cross mark disappear; 'approved' message appears with pencil icon under it */
                                <div className="flex flex-col items-center justify-center gap-1 animate-in zoom-in-95 duration-150">
                                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full capitalize">
                                    approved
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleEditApprovedStudent(st.id)}
                                    title="Click to edit approval (tick & cross mark will reappear)"
                                    className="p-1 rounded-full text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                  >
                                    <MaterialIcon name="edit" className="text-xs" />
                                  </button>
                                </div>
                              ) : (
                                /* Initial/Edit State: Green colour tick mark and Red colour cross mark */
                                <div className="inline-flex items-center gap-2 animate-in zoom-in-95 duration-150">
                                  {/* Green colour tick mark button */}
                                  <button
                                    ref={el => { actionButtonRefs.current[st.id] = el; }}
                                    type="button"
                                    onClick={() => handleApproveStudent(st.id)}
                                    title="Approve student (freezes claim amount with non-clickable tick)"
                                    className="p-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-400/40 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                                  >
                                    <MaterialIcon name="check" className="text-sm" />
                                  </button>

                                  {/* Red colour cross mark button */}
                                  <button
                                    type="button"
                                    onClick={() => handleCrossMarkClick(st)}
                                    title="Reject or validate attendance (opens editable days input with save)"
                                    className="p-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-sm ring-2 ring-rose-400/40 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                                  >
                                    <MaterialIcon name="close" className="text-sm" />
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* 10. Claim amount approved by block */}
                            <td className="py-3 px-3 text-right">
                              {isApproved ? (
                                <span className="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-300 font-mono font-bold text-xs animate-in zoom-in-95 duration-150">
                                  <span>₹{calculatedApprovedAmount.toLocaleString('en-IN')}</span>
                                  {/* Green colour tick mark (non clickable text) */}
                                  <span className="text-emerald-600 font-bold text-xs pointer-events-none select-none">✓</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* End Row: Grand Total Row */}
                    <tfoot className="bg-slate-100 text-slate-900 font-bold border-t-2 border-slate-300 text-xs">
                      <tr>
                        <td colSpan={5} className="py-3 px-3 text-slate-900 uppercase">
                          Grand Total ({currentVerificationClaim.students.length} Beneficiaries)
                        </td>
                        <td className="py-3 px-2.5 text-center font-mono text-slate-700">
                          {currentVerificationClaim.students[0]?.workingDaysInMonth || 22} Days
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                          {currentVerificationClaim.students.reduce((acc, s) => {
                            const d = studentDaysOverride[s.id] !== undefined ? studentDaysOverride[s.id] : s.daysAttended;
                            return acc + d;
                          }, 0)} Days
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{currentVerificationClaim.totalClaimAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-[10px] font-bold text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                            {Object.values(studentApprovedMap).filter(Boolean).length} of {currentVerificationClaim.students.length} Approved
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800 text-sm">
                          ₹{currentSchoolApprovedAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Remarks Input */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-900 block">
                  BEO Verification Remarks:
                </label>
                <input
                  type="text"
                  value={verificationRemarks}
                  onChange={(e) => setVerificationRemarks(e.target.value)}
                  placeholder="Enter official BEO verification comments..."
                  className="w-full px-4 py-2 text-xs border border-slate-300 rounded-xl bg-white shadow-[0_2px_4px_rgba(0,0,0,0.03),inset_0_2px_3px_rgba(0,0,0,0.04),inset_0_-1px_1px_rgba(255,255,255,0.95)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium"
                />
              </div>

              {/* ======================================================== */}
              {/* SUBMIT BUTTON BELOW OF THE LAST STUDENT                  */}
              {/* ======================================================== */}
              {!isBlockClaimSubmitted && (
                <div className="flex flex-col items-center justify-center pt-4 pb-2">
                  {schoolSubmitAlertMessage && (
                    <div className="mb-3 px-5 py-2.5 rounded-2xl bg-rose-50 border-2 border-rose-400 text-rose-950 text-xs font-bold shadow-md animate-in fade-in slide-in-from-top-2 duration-150 flex items-center gap-2">
                      <X className="w-4 h-4 text-rose-600 stroke-[3]" />
                      <span>{schoolSubmitAlertMessage}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSchoolSubmitClick}
                    className="px-8 py-3 rounded-full font-bold text-sm text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all shadow-lg shadow-emerald-950/20 cursor-pointer flex items-center gap-2"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Submit School Claim (₹{currentSchoolApprovedAmount.toLocaleString('en-IN')})</span>
                  </button>
                </div>
              )}

            </div>
          ) : (

            /* Sub-view B2: Master School-Wise Table (When no school is selected for drill-down) */
            <div className="space-y-6">
              
              {/* Table wrapper with blur and freeze effect */}
              <div 
                className={`bg-white/95 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg space-y-6 transition-all duration-300 ${
                  isTableBlurredAndFreezed 
                    ? 'filter blur-sm pointer-events-none select-none opacity-75' 
                    : isBlockClaimSubmitted
                    ? 'pointer-events-none select-none'
                    : ''
                }`}
              >
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span>Claim Verification for the Month of {cycleInfo.claimMonthOnlyName}</span>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                        Schools of {blockMeta.name} Block
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select a school to inspect student attendance, check/cross individual students, and approve claim amounts.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search school / UDISE..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-full focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.03),inset_0_2px_3px_rgba(0,0,0,0.04),inset_0_-1px_1px_rgba(255,255,255,0.95)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Master School-Wise Claim Table with Exact Requested Columns */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto bg-white">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                      <thead className="bg-slate-100/95 text-slate-800 uppercase font-bold text-xs border-b border-slate-300">
                        <tr>
                          {/* 1. Sl.No */}
                          <th className="py-3 px-2.5 text-center w-12 align-middle text-slate-800">Sl.No</th>

                          {/* 2. Name of the school */}
                          <th className="py-3 px-3 min-w-[170px] align-middle text-slate-800">Name of the school</th>

                          {/* 3. UDISE code */}
                          <th className="py-3 px-3 min-w-[120px] align-middle text-slate-800">UDISE code</th>

                          {/* 4. Allotment of total number of students under transport facility */}
                          <th className="py-3 px-2.5 text-center w-28 whitespace-normal leading-tight align-middle text-slate-800">Allotment Transport</th>

                          {/* 5. Allotment of total number of students under escort facility */}
                          <th className="py-3 px-2.5 text-center w-28 whitespace-normal leading-tight align-middle text-slate-800">Allotment Escort</th>

                          {/* 6. how many students availed transport facility in the 'previous month' */}
                          <th className="py-3 px-2.5 text-center w-32 whitespace-normal leading-tight align-middle text-slate-800">Availed Transport ({cycleInfo.claimMonthOnlyName})</th>

                          {/* 7. how many students availed escort facility in the 'previous month' */}
                          <th className="py-3 px-2.5 text-center w-32 whitespace-normal leading-tight align-middle text-slate-800">Availed Escort ({cycleInfo.claimMonthOnlyName})</th>

                          {/* 8. Total number of students availed this service in previous month( transport+escort) */}
                          <th className="py-3 px-2.5 text-center w-32 whitespace-normal leading-tight align-middle text-slate-800">Total Availed (Trans+Escort)</th>

                          {/* 9. Claim Amount by school for the previous month */}
                          <th className="py-3 px-3 text-right w-36 whitespace-normal leading-tight align-middle text-slate-800">Claim Amount by School</th>

                          {/* 10. date and time of school submission */}
                          <th className="py-3 px-3 min-w-[130px] align-middle text-slate-800">Submission Date &amp; Time</th>

                          {/* 11. claim amount approved by block & 12. verification button under this column */}
                          <th className="py-3 px-3 text-center min-w-[160px] whitespace-normal leading-tight align-middle text-slate-800">Claim Amount Approved &amp; Verification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-100/70 font-medium">
                        {filteredSchools.map((school, idx) => {
                          const claim = schoolClaimsInBlock.find(c => c.udiseCode === school.udiseCode);
                          const isSubmitted = !!claim;

                          // Allotment quotas (derived from school master default beneficiaries)
                          const allotTotal = school.defaultBeneficiaries || 4;
                          const allotTransport = Math.ceil(allotTotal * 0.6);
                          const allotEscort = Math.max(1, allotTotal - allotTransport);

                          // Availed counts for the previous month
                          const availedTransport = claim ? claim.students.filter(s => s.category === 'Transport' && s.daysAttended > 0).length : 0;
                          const availedEscort = claim ? claim.students.filter(s => s.category === 'Escort' && s.daysAttended > 0).length : 0;
                          const totalAvailed = availedTransport + availedEscort;

                          const claimAmount = claim ? claim.totalClaimAmount : 0;
                          const submissionDateStr = claim ? claim.submissionDateTime : 'Not Submitted';
                          
                          // Approved amount by block
                          const isApprovedByBlock = claim && (
                            claim.status === 'BLOCK_APPROVED' ||
                            claim.status === 'BLOCK_CLAIM_SUBMITTED_TO_DISTRICT' ||
                            claim.status === 'DISTRICT_APPROVED' ||
                            claim.status === 'FINAL_DISTRICT_APPROVAL'
                          );
                          const approvedAmountByBlock = isApprovedByBlock ? claim.totalClaimAmount : 0;
                          const isUnapprovedSchoolFlagged = unapprovedSchoolUdises.includes(school.udiseCode);

                          return (
                            <tr 
                              key={school.udiseCode} 
                              className={`transition-colors whitespace-nowrap ${
                                isUnapprovedSchoolFlagged 
                                  ? 'bg-rose-50/70 ring-1 ring-rose-300' 
                                  : idx % 2 === 0
                                    ? 'bg-white hover:bg-slate-50/90'
                                    : 'bg-slate-50/70 hover:bg-slate-100/80'
                              }`}
                            >
                              {/* 1. Sl.No */}
                              <td className="py-3 px-2.5 text-center font-mono font-bold text-slate-400">
                                {idx + 1}
                              </td>

                              {/* 2. Name of the school */}
                              <td className="py-3 px-3 font-bold text-slate-900">
                                <div className="flex items-center gap-1.5">
                                  <span>{school.name}</span>
                                  {isUnapprovedSchoolFlagged && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded-full border border-rose-300">
                                      <span>✕</span>
                                      <span>Not Verified</span>
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 3. UDISE code */}
                              <td className="py-3 px-3 font-mono text-slate-700">
                                {school.udiseCode}
                              </td>

                              {/* 4. Allotment of total number of students under transport facility */}
                              <td className="py-3 px-2.5 text-center font-mono font-semibold text-slate-600">
                                {allotTransport}
                              </td>

                              {/* 5. Allotment of total number of students under escort facility */}
                              <td className="py-3 px-2.5 text-center font-mono font-semibold text-slate-600">
                                {allotEscort}
                              </td>

                              {/* 6. how many students availed transport facility in the 'previous month' */}
                              <td className="py-3 px-2.5 text-center font-mono font-bold text-emerald-800">
                                {isSubmitted ? availedTransport : '0'}
                              </td>

                              {/* 7. how many students availed escort facility in the 'previous month' */}
                              <td className="py-3 px-2.5 text-center font-mono font-bold text-blue-800">
                                {isSubmitted ? availedEscort : '0'}
                              </td>

                              {/* 8. Total number of students availed this service in previous month( transport+escort) */}
                              <td className="py-3 px-2.5 text-center font-mono font-extrabold text-slate-900 bg-slate-50">
                                {isSubmitted ? totalAvailed : '0'}
                              </td>

                              {/* 9. Claim Amount by school for the previous month */}
                              <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                                {isSubmitted ? `₹${claimAmount.toLocaleString('en-IN')}` : '₹0'}
                              </td>

                              {/* 10. date and time of school submission */}
                              <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                                {submissionDateStr}
                              </td>

                              {/* 11. claim amount approved by block & next column (right near) a green colour tick mark (non clickable) appear */}
                              <td className="py-3 px-3 text-center">
                                <div className="flex flex-col items-center gap-1.5">
                                  {isApprovedByBlock ? (
                                    <div className="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-300 font-mono font-bold text-xs">
                                      <span>₹{approvedAmountByBlock.toLocaleString('en-IN')}</span>
                                      {/* Right near: a green colour tick mark text */}
                                      <span className="text-emerald-600 font-bold text-xs pointer-events-none">✓</span>
                                    </div>
                                  ) : isUnapprovedSchoolFlagged ? (
                                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border-2 border-rose-400 animate-pulse">
                                      <span className="text-rose-600 font-bold">✕</span>
                                      <span>Not Verified</span>
                                    </div>
                                  ) : isSubmitted ? (
                                    <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 text-[11px]">
                                      Pending Verification
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">₹0</span>
                                  )}

                                  {/* Verification button */}
                                  {!isBlockClaimSubmitted && isSubmitted && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenSchoolVerification(school.udiseCode)}
                                      className="px-3.5 py-1.5 rounded-full font-bold text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                      title="Click to verify student details (other schools will disappear)"
                                    >
                                      <MaterialIcon name="visibility" className="text-xs" />
                                      <span>Verification</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>

                      {/* Master Grand Total Row */}
                      <tfoot className="bg-slate-100 text-slate-900 font-bold border-t-2 border-slate-300 text-xs">
                        <tr>
                          <td colSpan={3} className="py-3 px-3 text-slate-900 uppercase">
                            Grand Total ({totalSchools} Schools)
                          </td>
                          <td className="py-3 px-2.5 text-center font-mono text-slate-800">
                            {schoolsInBlock.reduce((acc, s) => acc + Math.ceil((s.defaultBeneficiaries || 4) * 0.6), 0)}
                          </td>
                          <td className="py-3 px-2.5 text-center font-mono text-slate-800">
                            {schoolsInBlock.reduce((acc, s) => acc + Math.max(1, (s.defaultBeneficiaries || 4) - Math.ceil((s.defaultBeneficiaries || 4) * 0.6)), 0)}
                          </td>
                          <td className="py-3 px-2.5 text-center font-mono font-bold text-slate-900">
                            {schoolClaimsInBlock.reduce((acc, c) => acc + c.students.filter(s => s.category === 'Transport' && s.daysAttended > 0).length, 0)}
                          </td>
                          <td className="py-3 px-2.5 text-center font-mono font-bold text-slate-900">
                            {schoolClaimsInBlock.reduce((acc, c) => acc + c.students.filter(s => s.category === 'Escort' && s.daysAttended > 0).length, 0)}
                          </td>
                          <td className="py-3 px-2.5 text-center font-mono font-extrabold text-blue-900">
                            {totalStudentsClaimed}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            ₹{totalAmountClaimed.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">—</td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-emerald-800">
                            ₹{schoolClaimsInBlock.filter(c => c.status === 'BLOCK_APPROVED' || c.status === 'BLOCK_CLAIM_SUBMITTED_TO_DISTRICT' || c.status === 'DISTRICT_APPROVED').reduce((acc, c) => acc + c.totalClaimAmount, 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

              </div>

              {/* ========================================================================= */}
              {/* SUBMIT BUTTON UNDER THE LAST SCHOOL IN CENTER POSITION                    */}
              {/* ========================================================================= */}
              {!isBlockClaimSubmitted && !showDownloadSection && (
                <div className="flex flex-col items-center justify-center my-6 animate-in fade-in duration-200">
                  {blockSubmitAlertMessage && (
                    <div className="mb-3 px-5 py-2.5 rounded-2xl bg-rose-50 border-2 border-rose-400 text-rose-950 text-xs font-bold shadow-lg animate-in fade-in slide-in-from-top-2 duration-150 flex items-center gap-2">
                      <X className="w-4 h-4 text-rose-600 stroke-[3]" />
                      <span>{blockSubmitAlertMessage}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleBlockSubmitToDistrictClick}
                    className="px-10 py-3.5 rounded-full font-bold text-sm text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all shadow-xl shadow-emerald-950/20 cursor-pointer flex items-center gap-2.5"
                  >
                    <Send className="w-4 h-4" />
                    <span>Submit Block Claim to District</span>
                  </button>
                  <p className="text-[11px] text-slate-500 mt-2 font-medium">
                    Consolidates all {totalSchools} schools of {blockMeta.name} Block and transmits to District Project Office.
                  </p>
                </div>
              )}

              {/* ========================================================================= */}
              {/* DOWNLOAD SECTION (Immediately below restored freezed school details)       */}
              {/* ========================================================================= */}
              {/* ========================================================================= */}
              {/* NEXT SECTION: THREE OFFICIAL STATUTORY DOWNLOAD FIELDS                     */}
              {/* ========================================================================= */}
              {(showDownloadSection || isBlockClaimSubmitted) && (
                <div className="p-6 bg-white/95 backdrop-blur-xl border-2 border-emerald-300 rounded-3xl shadow-lg space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <Download className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900">
                          Official Statutory Claim Documents &amp; Downloads
                        </h4>
                        <p className="text-xs text-slate-500">
                          {blockMeta.name} Block · Submitted for {cycleInfo.claimMonthOnlyName} to DPO, Samagra Shiksha, Vellore
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full w-fit">
                      Submitted &amp; Freezed
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                    
                    {/* Field 1: school wise claim amount for the month of (previous month name) */}
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-300 transition-all shadow-xs flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Statement 1</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">PDF Landscape A4</span>
                        </div>
                        <h5 className="font-bold text-slate-900 text-sm mt-1.5 leading-snug">
                          School wise claim amount for the month of {cycleInfo.claimMonthOnlyName}
                        </h5>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          Official landscape A4 statement with transport &amp; escort sub-columns, school totals, BEO approved amounts, and signatures of Coordinator and Supervisor.
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">Download PDF</span>
                        {/* Right near this: download icon */}
                        <button
                          type="button"
                          onClick={handleDownloadSchoolWiseClaimPdf}
                          className="px-4 py-2 rounded-full font-bold text-xs text-white bg-slate-900 hover:bg-slate-800 active:scale-95 transition-all shadow-md flex items-center gap-2 cursor-pointer"
                          title={`Download School-wise claim amount for ${cycleInfo.claimMonthOnlyName} (PDF)`}
                        >
                          <Download className="w-4 h-4 text-emerald-400" />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>

                    {/* Field 2: Student wise claim amount for the month of (previous month name) */}
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-300 transition-all shadow-xs flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Statement 2</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Landscape PDF A4</span>
                        </div>
                        <h5 className="font-bold text-slate-900 text-sm mt-1.5 leading-snug">
                          Student wise claim amount for the month of {cycleInfo.claimMonthOnlyName}
                        </h5>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          Student-wise claim statement with EMIS numbers, working days, transport/escort mode, school subtotals, block grand total, and coordinator/supervisor stamps.
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">Download PDF</span>
                        {/* Right near this: download icon */}
                        <button
                          type="button"
                          onClick={handleDownloadStudentWiseClaimPdf}
                          className="px-4 py-2 rounded-full font-bold text-xs text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 active:scale-95 transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                          title={`Download Student wise claim amount for ${cycleInfo.claimMonthOnlyName} (PDF)`}
                        >
                          <Download className="w-4 h-4 text-emerald-700" />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>

                    {/* Field 3: Covering letter */}
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-300 transition-all shadow-xs flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Statement 3</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">முன்னனுப்பு கடிதம்</span>
                        </div>
                        <h5 className="font-bold text-slate-900 text-sm mt-1.5 leading-snug">
                          Covering letter (அதிகாரப்பூர்வ முன்னனுப்பு கடிதம்)
                        </h5>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          Statutory official transmittal covering letter from BEO in approved official Tamil format addressed to District Project Coordinator / DPO, Samagra Shiksha, Vellore.
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-700">Covering Letter</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowBlockCoveringLetterModal(true)}
                            className="px-3.5 py-1.5 rounded-full font-bold text-xs text-indigo-950 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                            title="Preview, print or download official Tamil covering letter"
                          >
                            <MaterialIcon name="visibility" className="text-sm text-indigo-700" />
                            <span>Preview Letter</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowBlockCoveringLetterModal(true)}
                            className="px-3.5 py-1.5 rounded-full font-bold text-xs text-purple-950 bg-purple-100 hover:bg-purple-200 border border-purple-300 active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                            title="Download BEO Covering letter PDF"
                          >
                            <MaterialIcon name="download" className="text-sm text-purple-700" />
                            <span>Download PDF</span>
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW SUBMITTED BLOCK CLAIM MODAL                         */}
      {/* ======================================================== */}
      {viewBlockClaimModal && blockClaim && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-white/80 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Consolidated Block Claim: {blockClaim.blockName} Block</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Submission Date: <span className="font-mono text-slate-900 font-bold">{blockClaim.submissionDateTime}</span> · Submitted By: {blockClaim.submittedBy}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewBlockClaimModal(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Schools Consolidated</span>
                  <span className="font-bold text-slate-900 text-sm block mt-0.5">{blockClaim.submittedSchoolsCount} Schools</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Beneficiaries</span>
                  <span className="font-bold text-slate-900 text-sm block mt-0.5">{blockClaim.totalStudentsCount} Students</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Claim Amount</span>
                  <span className="font-bold font-mono text-slate-900 text-sm block mt-0.5">₹{blockClaim.totalClaimAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">District Status</span>
                  <span className="font-bold text-emerald-950 text-xs block mt-0.5">{blockClaim.status.replace(/_/g, ' ')}</span>
                </div>
              </div>

              {/* List of Schools in Block Claim */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/95 text-slate-800 uppercase font-bold text-[10.5px] border-b border-slate-300">
                    <tr>
                      <th className="py-2.5 px-3 text-slate-800">#</th>
                      <th className="py-2.5 px-3 text-slate-800">School Name</th>
                      <th className="py-2.5 px-3 text-slate-800">UDISE</th>
                      <th className="py-2.5 px-3 text-center text-slate-800">Students Claimed</th>
                      <th className="py-2.5 px-3 text-right text-slate-800">Amount Claimed</th>
                      <th className="py-2.5 px-3 text-center text-slate-800">BEO Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80">
                    {schoolClaimsInBlock.map((sc, i) => (
                      <tr key={sc.id || i} className={i % 2 === 0 ? 'bg-white hover:bg-slate-50/90' : 'bg-slate-50/70 hover:bg-slate-100/80'}>
                        <td className="py-2 px-3 font-mono text-slate-400">{i + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{sc.schoolName}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{sc.udiseCode}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-blue-900">{sc.totalStudents}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">₹{sc.totalClaimAmount.toLocaleString('en-IN')}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            VERIFIED &amp; APPROVED
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setViewBlockClaimModal(false)}
                className="px-5 py-2 rounded-full font-bold text-xs text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Tamil Covering Letter Modal for Block Login */}
      <TamilCoveringLetterModal
        isOpen={showBlockCoveringLetterModal}
        onClose={() => setShowBlockCoveringLetterModal(false)}
        type="block"
        blockData={{
          blockName: blockMeta.name,
          bmoName: blockMeta.bmoName || currentUser.name || 'வட்டாரக் கல்வி அலுவலர்',
          monthName: cycleInfo.claimMonthName,
          calculationPeriod: cycleInfo.calculationPeriodString,
          totalSchools: totalSchools,
          totalStudents: totalStudentsClaimed,
          transportStudentsCount: schoolClaimsInBlock.reduce((acc, c) => acc + (c.students?.filter(s => s.category === 'Transport').length || 0), 0),
          escortStudentsCount: schoolClaimsInBlock.reduce((acc, c) => acc + (c.students?.filter(s => s.category === 'Escort').length || 0), 0),
          totalTransportAmount: schoolClaimsInBlock.reduce((acc, c) => acc + (c.students?.filter(s => s.category === 'Transport').reduce((sAcc, st) => sAcc + st.totalClaimAmount, 0) || 0), 0),
          totalEscortAmount: schoolClaimsInBlock.reduce((acc, c) => acc + (c.students?.filter(s => s.category === 'Escort').reduce((sAcc, st) => sAcc + st.totalClaimAmount, 0) || 0), 0),
          totalAmount: totalAmountClaimed,
          submissionDate: blockClaim?.submissionDateTime || (districtVerifiedAt && districtVerifiedAt !== 'Official Sanction Order' ? districtVerifiedAt : new Date().toLocaleDateString('en-IN')),
        }}
      />

    </div>
  );
};
