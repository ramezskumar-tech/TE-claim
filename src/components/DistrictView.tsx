import React, { useState, useEffect } from 'react';
import { BlockClaimRecord, SchoolClaimRecord, UserSession } from '../types/claim';
import { DynamicCycleInfo, formatCurrencyINR } from '../utils/dateCycle';
import { claimStore } from '../services/claimStore';
import { VELLORE_BLOCKS, VELLORE_SCHOOLS } from '../data/initialData';
import { printHtmlDocument, printStudentWiseClaimSheet, downloadStudentWiseClaimPdf } from '../utils/printHelper';
import { Building2, School, CheckCircle2, XCircle, AlertTriangle, Eye, ShieldCheck, Printer, Archive, ArrowRight, FileCheck2, RotateCcw, Check, X, Search, Pencil, ArrowLeft, Download, FileText } from 'lucide-react';
import { MaterialIcon } from './MaterialIcon';

interface DistrictViewProps {
  currentUser: UserSession;
  cycleInfo: DynamicCycleInfo;
  activeSubTab: 'dashboard' | 'verification';
  onNavigateTab: (tab: string) => void;
  onRefresh: () => void;
}

export const DistrictView: React.FC<DistrictViewProps> = ({
  currentUser,
  cycleInfo,
  activeSubTab,
  onNavigateTab,
  onRefresh,
}) => {
  // Immediately pull fresh block-wise claim entry data entered by block login users
  const [storeState, setStoreState] = useState(() => claimStore.reloadFromStorage());

  useEffect(() => {
    // Immediately pull latest entries when tab changes or mounts
    setStoreState(claimStore.reloadFromStorage());
    const unsub = claimStore.subscribe(() => {
      setStoreState(claimStore.getState());
    });
    return unsub;
  }, [activeSubTab]);

  const totalBlocksCount = VELLORE_BLOCKS.length;

  // Filter block claims for the active cycle
  const activeBlockClaims = storeState.blockClaims.filter(
    b => b.claimMonthKey === cycleInfo.claimMonthKey
  );

  // Status Metrics
  const submittedBlocks = activeBlockClaims;
  const submittedBlocksCount = submittedBlocks.length;
  const notSubmittedBlocksCount = totalBlocksCount - submittedBlocksCount;

  const pendingVerificationBlocks = activeBlockClaims.filter(
    b => b.status === 'BLOCK_CLAIM_SUBMITTED_TO_DISTRICT' || b.status === 'PENDING_DISTRICT_VERIFICATION'
  );
  const districtApprovedBlocks = activeBlockClaims.filter(
    b => b.status === 'DISTRICT_APPROVED' || b.status === 'FINAL_DISTRICT_APPROVAL'
  );
  const rejectedBlocks = activeBlockClaims.filter(
    b => b.status === 'DISTRICT_REJECTED' || b.status === 'CORRECTION_REQUIRED'
  );
  const resubmittedBlocks = activeBlockClaims.filter(
    b => b.status === 'RESUBMITTED_BY_BLOCK'
  );

  const isFinalDistrictSanctioned = activeBlockClaims.length === totalBlocksCount &&
    activeBlockClaims.every(b => b.status === 'FINAL_DISTRICT_APPROVAL');

  // Check if District can finalize approval
  const finalCheck = claimStore.canCompleteFinalDistrictApproval();

  // State for inspecting/verifying a block claim
  const [inspectingBlockClaim, setInspectingBlockClaim] = useState<BlockClaimRecord | null>(null);
  const [districtRemarks, setDistrictRemarks] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // View Approved Claim Modal
  const [viewApprovedModal, setViewApprovedModal] = useState<boolean>(false);
  const [selectedSchoolInBlock, setSelectedSchoolInBlock] = useState<SchoolClaimRecord | null>(null);

  // Drill-down: ID of the block whose verification button was clicked
  // When set: other block details disappear, only this block details & all school details appear!
  const [selectedVerificationBlockId, setSelectedVerificationBlockId] = useState<string | null>(null);

  // Modal to View & Print Student Attendance Copy for a school
  const [viewAttendanceSchool, setViewAttendanceSchool] = useState<SchoolClaimRecord | null>(null);

  // Alert and highlighting for unverified schools when Submit is clicked
  const [unverifiedSchoolUdises, setUnverifiedSchoolUdises] = useState<string[]>([]);
  const [submitValidationAlert, setSubmitValidationAlert] = useState<string | null>(null);

  const handleSchoolApprove = (udiseCode: string) => {
    claimStore.verifySchoolClaimByDistrict(udiseCode, 'APPROVED', currentUser);
    setUnverifiedSchoolUdises(prev => prev.filter(u => u !== udiseCode));
    setStoreState(claimStore.reloadFromStorage());
    onRefresh();
  };

  const handleSchoolReject = (udiseCode: string) => {
    claimStore.verifySchoolClaimByDistrict(udiseCode, 'REJECTED', currentUser);
    setUnverifiedSchoolUdises(prev => prev.filter(u => u !== udiseCode));
    setStoreState(claimStore.reloadFromStorage());
    onRefresh();
  };

  const handleSchoolReset = (udiseCode: string) => {
    claimStore.verifySchoolClaimByDistrict(udiseCode, 'RESET', currentUser);
    setStoreState(claimStore.reloadFromStorage());
    onRefresh();
  };

  const handleApproveAllSchoolsInBlock = (blockId: string) => {
    const schools = VELLORE_SCHOOLS.filter(s => s.blockId === blockId);
    schools.forEach(s => {
      claimStore.verifySchoolClaimByDistrict(s.udiseCode, 'APPROVED', currentUser);
    });
    setUnverifiedSchoolUdises([]);
    setSubmitValidationAlert(null);
    setStoreState(claimStore.reloadFromStorage());
    setActionSuccess(`All schools in this block have been verified and approved.`);
    onRefresh();
  };

  // Filter and search state for blocks list
  const [blockFilter, setBlockFilter] = useState<'ALL' | 'SUBMITTED' | 'PENDING_SUBMISSION' | 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const handleVerifyBlock = (decision: 'APPROVED' | 'REJECTED') => {
    if (!inspectingBlockClaim) return;
    setActionError(null);

    const res = claimStore.verifyBlockClaimByDistrict(
      inspectingBlockClaim.blockId,
      decision,
      districtRemarks,
      currentUser
    );

    if (!res.success) {
      setActionError(res.message);
    } else {
      setActionSuccess(res.message);
      setInspectingBlockClaim(null);
      setDistrictRemarks('');
      setStoreState(claimStore.reloadFromStorage());
      onRefresh();
    }
  };

  const handleQuickApprove = (claim: BlockClaimRecord) => {
    setActionError(null);
    const res = claimStore.verifyBlockClaimByDistrict(
      claim.blockId,
      'APPROVED',
      'Verified and approved by District Project Office.',
      currentUser
    );

    if (!res.success) {
      setActionError(res.message);
    } else {
      setActionSuccess(`Claim for ${claim.blockName} Block (₹${Number(claim.totalClaimAmount).toLocaleString('en-IN')}) verified & approved successfully.`);
      setStoreState(claimStore.reloadFromStorage());
      onRefresh();
    }
  };

  const handleCompleteFinalSanction = () => {
    setActionError(null);
    const res = claimStore.completeFinalDistrictApproval(currentUser);
    if (!res.success) {
      setActionError(res.message);
    } else {
      setActionSuccess(res.message);
      onRefresh();
    }
  };

  const handleArchiveCycle = () => {
    if (!window.confirm('Are you sure you want to close and archive this monthly cycle? Active claims will be saved to history and the next month cycle will begin.')) {
      return;
    }
    const res = claimStore.archiveCurrentCycleAndAdvance();
    if (res.success) {
      setActionSuccess(res.message);
      onRefresh();
    }
  };

  // Get school claims belonging to a block
  const getSchoolClaimsForBlock = (blockId: string) => {
    return storeState.schoolClaims.filter(
      sc => sc.blockId === blockId && sc.claimMonthKey === cycleInfo.claimMonthKey
    );
  };

  const filteredBlocks = VELLORE_BLOCKS.filter(block => {
    const claim = activeBlockClaims.find(b => b.blockId === block.id);
    const isSub = !!claim;

    if (blockFilter === 'SUBMITTED' && !isSub) return false;
    if (blockFilter === 'PENDING_SUBMISSION' && isSub) return false;
    if (blockFilter === 'PENDING_VERIFICATION' && (!claim || (claim.status !== 'BLOCK_CLAIM_SUBMITTED_TO_DISTRICT' && claim.status !== 'RESUBMITTED_BY_BLOCK'))) return false;
    if (blockFilter === 'APPROVED' && (!claim || (claim.status !== 'DISTRICT_APPROVED' && claim.status !== 'FINAL_DISTRICT_APPROVAL'))) return false;
    if (blockFilter === 'REJECTED' && (!claim || claim.status !== 'DISTRICT_REJECTED')) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return block.name.toLowerCase().includes(q) || block.bmoName.toLowerCase().includes(q) || block.code.includes(q);
    }

    return true;
  });

  // Calculate detailed 13 columns for each block
  const blockRows = filteredBlocks.map((block, idx) => {
    const schoolsInBlock = VELLORE_SCHOOLS.filter(s => s.blockId === block.id);
    const schoolClaimsInBlock = storeState.schoolClaims.filter(
      sc => sc.blockId === block.id && sc.claimMonthKey === cycleInfo.claimMonthKey
    );
    const claim = activeBlockClaims.find(b => b.blockId === block.id);
    const isSubmitted = !!claim;

    // 3. Total no.of schools availed transport facility
    const schoolsAvailedTransport = schoolClaimsInBlock.filter(sc =>
      sc.students.some(st => st.category === 'Transport' && st.daysAttended > 0)
    ).length;

    // 4. Total no.of schools availed Escort facility
    const schoolsAvailedEscort = schoolClaimsInBlock.filter(sc =>
      sc.students.some(st => st.category === 'Escort' && st.daysAttended > 0)
    ).length;

    // 5. Allotment of total number of students under transport facility
    const allotmentTransport = schoolsInBlock.reduce((acc, s) => {
      const totalAllot = s.defaultBeneficiaries || 4;
      return acc + Math.ceil(totalAllot * 0.6);
    }, 0);

    // 6. Allotment of total number of students under escort facility
    const allotmentEscort = schoolsInBlock.reduce((acc, s) => {
      const totalAllot = s.defaultBeneficiaries || 4;
      return acc + Math.max(1, totalAllot - Math.ceil(totalAllot * 0.6));
    }, 0);

    // 7. how many students availed transport facility in the 'previous month'
    const studentsAvailedTransport = schoolClaimsInBlock.reduce((acc, sc) => {
      return acc + sc.students.filter(st => st.category === 'Transport' && st.daysAttended > 0).length;
    }, 0);

    // 8. how many students availed escort facility in the 'previous month'
    const studentsAvailedEscort = schoolClaimsInBlock.reduce((acc, sc) => {
      return acc + sc.students.filter(st => st.category === 'Escort' && st.daysAttended > 0).length;
    }, 0);

    // 9. Total number of students availed this service in previous month (transport+escort)
    const totalStudentsAvailed = isSubmitted && claim.totalStudentsCount > 0
      ? claim.totalStudentsCount
      : (studentsAvailedTransport + studentsAvailedEscort);

    // 10. Claim Amount by school for the previous month
    const claimAmountBySchool = schoolClaimsInBlock.reduce((acc, sc) => acc + sc.totalClaimAmount, 0);

    // 11. claim amount approved by block
    const claimAmountApprovedByBlock = isSubmitted
      ? claim.totalClaimAmount
      : schoolClaimsInBlock.filter(sc =>
          sc.status === 'BLOCK_APPROVED' ||
          sc.status === 'BLOCK_CLAIM_SUBMITTED_TO_DISTRICT' ||
          sc.status === 'DISTRICT_APPROVED' ||
          sc.status === 'FINAL_DISTRICT_APPROVAL'
        ).reduce((acc, sc) => acc + sc.totalClaimAmount, 0);

    // 12. date and time of block submission
    const submissionDateTime = claim ? claim.submissionDateTime : 'Not Submitted';

    // 13. Claim Amount approved by the district
    const isDistrictApproved = claim && (
      claim.status === 'DISTRICT_APPROVED' ||
      claim.status === 'FINAL_DISTRICT_APPROVAL'
    );
    const isDistrictRejected = claim && (
      claim.status === 'DISTRICT_REJECTED' ||
      claim.status === 'CORRECTION_REQUIRED'
    );
    const amountApprovedByDistrict = isDistrictApproved ? claim.totalClaimAmount : 0;

    return {
      slNo: idx + 1,
      block,
      schoolsInBlock,
      schoolClaimsInBlock,
      claim,
      isSubmitted,
      schoolsAvailedTransport,
      schoolsAvailedEscort,
      allotmentTransport,
      allotmentEscort,
      studentsAvailedTransport,
      studentsAvailedEscort,
      totalStudentsAvailed,
      claimAmountBySchool,
      claimAmountApprovedByBlock,
      submissionDateTime,
      isDistrictApproved,
      isDistrictRejected,
      amountApprovedByDistrict,
    };
  });

  // Grand Totals across all blocks
  const grandTotals = {
    totalBlocks: blockRows.length,
    schoolsAvailedTransport: blockRows.reduce((a, b) => a + b.schoolsAvailedTransport, 0),
    schoolsAvailedEscort: blockRows.reduce((a, b) => a + b.schoolsAvailedEscort, 0),
    allotmentTransport: blockRows.reduce((a, b) => a + b.allotmentTransport, 0),
    allotmentEscort: blockRows.reduce((a, b) => a + b.allotmentEscort, 0),
    studentsAvailedTransport: blockRows.reduce((a, b) => a + b.studentsAvailedTransport, 0),
    studentsAvailedEscort: blockRows.reduce((a, b) => a + b.studentsAvailedEscort, 0),
    totalStudentsAvailed: blockRows.reduce((a, b) => a + b.totalStudentsAvailed, 0),
    claimAmountBySchool: blockRows.reduce((a, b) => a + b.claimAmountBySchool, 0),
    claimAmountApprovedByBlock: blockRows.reduce((a, b) => a + b.claimAmountApprovedByBlock, 0),
    amountApprovedByDistrict: blockRows.reduce((a, b) => a + b.amountApprovedByDistrict, 0),
  };

  // Dedicated School Details for the clicked block during drill-down verification
  const selectedBlock = selectedVerificationBlockId
    ? VELLORE_BLOCKS.find(b => b.id === selectedVerificationBlockId)
    : null;

  const selectedBlockClaim = selectedBlock
    ? activeBlockClaims.find(b => b.blockId === selectedBlock.id)
    : null;

  const selectedBlockRow = selectedVerificationBlockId
    ? blockRows.find(r => r.block.id === selectedVerificationBlockId)
    : null;

  const selectedBlockSchools = selectedVerificationBlockId
    ? VELLORE_SCHOOLS.filter(s => s.blockId === selectedVerificationBlockId)
    : [];

  const schoolRowsData = selectedBlockSchools.map((s, idx) => {
    const sc = storeState.schoolClaims.find(
      c => c.udiseCode === s.udiseCode && c.claimMonthKey === cycleInfo.claimMonthKey
    );
    const defaultAllot = s.defaultBeneficiaries || 4;
    const allotTransport = Math.ceil(defaultAllot * 0.6);
    const allotEscort = Math.max(1, defaultAllot - allotTransport);
    const workingDays = sc?.students[0]?.workingDaysInMonth || 22;

    const availedTransport = sc
      ? sc.students.filter(st => st.category === 'Transport' && st.daysAttended > 0).length
      : allotTransport;

    const availedEscort = sc
      ? sc.students.filter(st => st.category === 'Escort' && st.daysAttended > 0).length
      : allotEscort;

    const totalAvailed = availedTransport + availedEscort;
    const amountClaimed = sc ? sc.totalClaimAmount : totalAvailed * 600;
    const amountApprovedByBlock = sc ? sc.totalClaimAmount : totalAvailed * 600;

    const decision = sc?.districtVerification?.decision;
    const isApproved = decision === 'APPROVED';
    const isRejected = decision === 'REJECTED';
    const approvedAmount = isApproved ? amountApprovedByBlock : 0;
    const isUnverifiedAlerted = unverifiedSchoolUdises.includes(s.udiseCode);

    return {
      slNo: idx + 1,
      school: s,
      sc,
      workingDays,
      allotTransport,
      allotEscort,
      availedTransport,
      availedEscort,
      totalAvailed,
      amountClaimed,
      amountApprovedByBlock,
      decision,
      isApproved,
      isRejected,
      approvedAmount,
      isUnverifiedAlerted,
    };
  });

  const schoolGrandTotals = {
    totalSchools: schoolRowsData.length,
    allotTransport: schoolRowsData.reduce((a, b) => a + b.allotTransport, 0),
    allotEscort: schoolRowsData.reduce((a, b) => a + b.allotEscort, 0),
    availedTransport: schoolRowsData.reduce((a, b) => a + b.availedTransport, 0),
    availedEscort: schoolRowsData.reduce((a, b) => a + b.availedEscort, 0),
    totalAvailed: schoolRowsData.reduce((a, b) => a + b.totalAvailed, 0),
    amountClaimed: schoolRowsData.reduce((a, b) => a + b.amountClaimed, 0),
    amountApprovedByBlock: schoolRowsData.reduce((a, b) => a + b.amountApprovedByBlock, 0),
    amountApprovedByDistrict: schoolRowsData.reduce((a, b) => a + b.approvedAmount, 0),
    approvedCount: schoolRowsData.filter(r => r.isApproved).length,
    rejectedCount: schoolRowsData.filter(r => r.isRejected).length,
    pendingCount: schoolRowsData.filter(r => !r.decision).length,
  };

  const handleOpenAttendanceCopy = (row: typeof schoolRowsData[0]) => {
    if (row.sc) {
      setViewAttendanceSchool(row.sc);
      return;
    }
    const syntheticClaim: SchoolClaimRecord = {
      id: `CLM_${row.school.udiseCode}_${cycleInfo.claimMonthKey}`,
      claimMonthKey: cycleInfo.claimMonthKey,
      claimMonthName: cycleInfo.claimMonthName,
      calculationPeriod: cycleInfo.calculationPeriodString,
      udiseCode: row.school.udiseCode,
      schoolName: row.school.name,
      blockId: row.school.blockId,
      blockName: row.school.blockName,
      userId: `USR_HM_${row.school.udiseCode}`,
      submittedBy: row.school.headmasterName,
      submissionDateTime: cycleInfo.calculationPeriodString,
      status: 'BLOCK_CLAIM_SUBMITTED_TO_DISTRICT',
      students: [
        ...Array.from({ length: row.allotTransport }).map((_, i) => ({
          id: `ST_${row.school.udiseCode}_T_${i + 1}`,
          studentName: `Beneficiary Student (Transport ${i + 1})`,
          emisNumber: `3304${row.school.udiseCode.slice(-4)}${1000 + i + 1}`,
          grade: `Class ${6 + i}`,
          category: 'Transport' as const,
          workingDaysInMonth: row.workingDays,
          daysAttended: row.workingDays,
          ratePerDay: 30,
          totalClaimAmount: 600,
          serviceProviderName: 'Van / Auto Route',
        })),
        ...Array.from({ length: row.allotEscort }).map((_, i) => ({
          id: `ST_${row.school.udiseCode}_E_${i + 1}`,
          studentName: `Beneficiary Student (Escort ${i + 1})`,
          emisNumber: `3304${row.school.udiseCode.slice(-4)}${2000 + i + 1}`,
          grade: `Class ${1 + i}`,
          category: 'Escort' as const,
          workingDaysInMonth: row.workingDays,
          daysAttended: row.workingDays,
          ratePerDay: 30,
          totalClaimAmount: 600,
          serviceProviderName: 'Parent Escort',
        })),
      ],
      totalStudents: row.allotTransport + row.allotEscort,
      totalClaimAmount: (row.allotTransport + row.allotEscort) * 600,
    };
    setViewAttendanceSchool(syntheticClaim);
  };

  const handleSubmitBlockVerification = () => {
    if (!selectedVerificationBlockId) return;

    // Check which schools under this block are not yet verified (neither APPROVED nor REJECTED)
    const unverified = schoolRowsData.filter(r => !r.decision);

    if (unverified.length > 0) {
      setUnverifiedSchoolUdises(unverified.map(r => r.school.udiseCode));
      setSubmitValidationAlert(
        `Please complete verification for all schools before submitting. ${unverified.length} school(s) indicated with a red cross mark under Action column are not verified.`
      );
      return;
    }

    // All schools are verified!
    setUnverifiedSchoolUdises([]);
    setSubmitValidationAlert(null);

    const hasRejectedSchool = schoolRowsData.some(r => r.isRejected);
    const blockMeta = selectedBlock;
    const blockClaim = selectedBlockClaim;
    const approvedTotal = schoolGrandTotals.amountApprovedByDistrict;

    if (!hasRejectedSchool) {
      // If verification of all schools under this block is approved by district
      claimStore.verifyBlockClaimByDistrict(
        selectedVerificationBlockId,
        'APPROVED',
        'All school claims under this block verified and approved by District Project Office.',
        currentUser
      );
      setActionSuccess(
        `Block claim for ${blockMeta?.name} Block verified & Approved successfully. Approved amount ₹${(blockClaim?.totalClaimAmount || approvedTotal).toLocaleString('en-IN')} frozen.`
      );
    } else {
      // Suppose any school claim under this block is rejected by district
      claimStore.verifyBlockClaimByDistrict(
        selectedVerificationBlockId,
        'REJECTED',
        'One or more school claims rejected/returned for correction. Discrepancy notice sent to Block Home Page.',
        currentUser
      );
      setActionSuccess(
        `Block claim for ${blockMeta?.name} Block marked as Rejected and Returned. Discrepancy notification sent to Block Home Page and Claim Verification tab.`
      );
    }

    // Immediately submit button hides and all school details disappear under this block
    setSelectedVerificationBlockId(null);
    setStoreState(claimStore.reloadFromStorage());
    onRefresh();
  };

  const totalDistrictFundDemanded = activeBlockClaims.reduce((a, b) => a + Number(b.totalClaimAmount), 0);
  const totalDistrictBeneficiaries = activeBlockClaims.reduce((a, b) => a + Number(b.totalStudentsCount), 0);

  return (
    <div className="space-y-6">
      {/* District Header Overview Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">District Project Office · Samagra Shiksha Vellore</h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                  Admin Authority
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                <span>District Project Coordinator / CEO: <strong className="text-slate-800">{currentUser.name}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Jurisdiction: All 7 Educational Blocks</span>
                <span aria-hidden="true">·</span>
                <span>Cycle: <strong className="text-slate-800">{cycleInfo.claimMonthName}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isFinalDistrictSanctioned && (
              <button
                type="button"
                onClick={() => setViewApprovedModal(true)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                View Approved Claim
              </button>
            )}

            {isFinalDistrictSanctioned && (
              <button
                type="button"
                onClick={handleArchiveCycle}
                className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg flex items-center gap-1.5 transition-colors"
                title="Archive completed month and advance cycle"
              >
                <Archive className="w-3.5 h-3.5" />
                Close & Archive Month
              </button>
            )}
          </div>
        </div>

        {/* Dynamic 7-Stat Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mt-5 pt-5 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[10px] text-slate-500 font-medium">Total Blocks</div>
            <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">{totalBlocksCount}</div>
          </div>
          <div className="p-3 bg-emerald-50/70 rounded-lg border border-emerald-200">
            <div className="text-[10px] text-emerald-700 font-medium">Submitted Blocks</div>
            <div className="text-lg font-bold text-emerald-800 font-mono tabular-nums mt-0.5">{submittedBlocksCount}</div>
          </div>
          <div className="p-3 bg-amber-50/70 rounded-lg border border-amber-200">
            <div className="text-[10px] text-amber-700 font-medium">Not-Submitted Blocks</div>
            <div className="text-lg font-bold text-amber-800 font-mono tabular-nums mt-0.5">{notSubmittedBlocksCount}</div>
          </div>
          <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200">
            <div className="text-[10px] text-blue-700 font-medium">Pending Verification</div>
            <div className="text-lg font-bold text-blue-800 font-mono tabular-nums mt-0.5">{pendingVerificationBlocks.length}</div>
          </div>
          <div className="p-3 bg-teal-50/70 rounded-lg border border-teal-200">
            <div className="text-[10px] text-teal-700 font-medium">District Approved</div>
            <div className="text-lg font-bold text-teal-800 font-mono tabular-nums mt-0.5">{districtApprovedBlocks.length}</div>
          </div>
          <div className="p-3 bg-red-50/70 rounded-lg border border-red-200">
            <div className="text-[10px] text-red-700 font-medium">Rejected / Returned</div>
            <div className="text-lg font-bold text-red-800 font-mono tabular-nums mt-0.5">{rejectedBlocks.length}</div>
          </div>
          <div className="p-3 bg-purple-50/70 rounded-lg border border-purple-200">
            <div className="text-[10px] text-purple-700 font-medium">Resubmitted Blocks</div>
            <div className="text-lg font-bold text-purple-800 font-mono tabular-nums mt-0.5">{resubmittedBlocks.length}</div>
          </div>
        </div>
      </div>

      {/* Home Dashboard Quick Action Card when activeSubTab === 'dashboard' */}
      {activeSubTab === 'dashboard' && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white shadow-lg border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Transport / Escort Monthly Claim Cycle: {cycleInfo.claimMonthName}</span>
            </div>
            <h3 className="text-base font-bold tracking-tight text-white">
              Educational Blocks Claim Verification &amp; Sanction
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Verify block-wise claim entries for all 7 blocks of {currentUser.districtName || 'Vellore'} district for the previous month ({cycleInfo.claimMonthOnlyName}). Inspect school breakdown, verify student attendance, and release district sanction.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('verification')}
            className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <span>Go to Claim Verification</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Resubmission Alert Notification on District User Login Home Page */}
      {resubmittedBlocks.length > 0 && (
        <div className="p-4 rounded-2xl border-2 border-purple-400 bg-purple-50/95 text-purple-950 shadow-md ring-1 ring-purple-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <RotateCcw className="w-5 h-5 text-purple-600 shrink-0 mt-0.5 animate-spin" style={{ animationDuration: '4s' }} />
            <div>
              <div className="font-bold text-xs uppercase tracking-wider text-purple-900">
                Block Claim Resubmitted for District Review
              </div>
              <p className="text-xs text-purple-900 mt-0.5 leading-relaxed">
                <strong>{resubmittedBlocks.map(b => b.blockName).join(', ')} Block</strong> has resubmitted their claim for <strong>{cycleInfo.claimMonthOnlyName}</strong> after addressing previous return remarks.
              </p>
              <div className="text-[11px] text-purple-800 font-semibold mt-0.5">
                Ready for District Verification &amp; Sanction Approval.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setInspectingBlockClaim(resubmittedBlocks[0]);
              setDistrictRemarks('');
            }}
            className="px-4 py-2 rounded-full font-bold text-xs text-white bg-purple-600 hover:bg-purple-700 active:scale-95 transition-all shadow-xs shrink-0 cursor-pointer"
          >
            Review Resubmitted Claim
          </button>
        </div>
      )}

      {/* Slightly Glowing Banner Above District Block List After Final Sanction (Per Requirements) */}
      {isFinalDistrictSanctioned && (
        <div className="p-4 rounded-xl border border-emerald-400 bg-emerald-50/90 text-emerald-950 shadow-[0_0_16px_rgba(16,185,129,0.25)] ring-1 ring-emerald-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="font-bold text-sm tracking-tight">
                District level claim is submitted for the month of {cycleInfo.claimMonthOnlyName}.
              </div>
              <div className="text-xs text-emerald-900/80 mt-0.5">
                All Block-level claims and School claims across Vellore District are locked in read-only format. Sanction order released for fund disbursement.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setViewApprovedModal(true)}
            className="px-4 py-1.5 text-xs font-semibold text-emerald-950 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg shadow-2xs whitespace-nowrap flex items-center gap-1.5 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            View Approved Claim
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {actionSuccess}
        </div>
      )}

      {actionError && (
        <div className="p-3.5 bg-red-50 border border-red-300 text-red-900 rounded-lg text-xs font-medium flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
          {actionError}
        </div>
      )}

      {/* Claim Verification Active Tab Banner */}
      {activeSubTab === 'verification' && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border-2 border-emerald-500/30 backdrop-blur-md shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Claim Verification for the Month of {cycleInfo.claimMonthOnlyName}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Blocks of {currentUser.districtName || 'Vellore'} District
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Immediately pulling block-wise claim entry data entered by block login users (blocks of the logged-in district).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="px-3 py-1.5 rounded-xl bg-white/90 border border-emerald-200 shadow-2xs text-xs">
              <span className="text-slate-500">Submitted Blocks:</span>{' '}
              <strong className="text-emerald-800 font-mono font-bold">{submittedBlocksCount} / {totalBlocksCount}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Block-wise Verification / Drill-down Section */}
      {selectedVerificationBlockId !== null && selectedBlock ? (
        /* ========================================================================= */
        /* DEDICATED SCHOOL VERIFICATION FOR CLICKED BLOCK                          */
        /* (Other block details disappear, only this block & its schools appear)    */
        /* ========================================================================= */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden space-y-0 animate-in fade-in duration-200">
          {/* Header Card for this clicked Block */}
          <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedVerificationBlockId(null);
                  setSubmitValidationAlert(null);
                  setUnverifiedSchoolUdises([]);
                }}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors shrink-0 mt-0.5"
                title="Back to All Educational Blocks"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-emerald-400" />
                    <span>{selectedBlock.name} Block</span>
                  </h3>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    selectedBlockClaim?.status === 'DISTRICT_APPROVED' || (schoolGrandTotals.totalSchools > 0 && schoolGrandTotals.approvedCount === schoolGrandTotals.totalSchools)
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                      : selectedBlockClaim?.status === 'DISTRICT_REJECTED' || schoolGrandTotals.rejectedCount > 0
                      ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                      : 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                  }`}>
                    {selectedBlockClaim?.status === 'DISTRICT_APPROVED' || (schoolGrandTotals.totalSchools > 0 && schoolGrandTotals.approvedCount === schoolGrandTotals.totalSchools)
                      ? 'Approved by District'
                      : selectedBlockClaim?.status === 'DISTRICT_REJECTED' || schoolGrandTotals.rejectedCount > 0
                      ? 'Returned for Correction'
                      : 'Pending District Verification'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
                  <span>BEO: <strong className="text-white font-sans">{selectedBlock.bmoName}</strong></span>
                  <span>·</span>
                  <span>Schools: <strong className="text-white">{schoolGrandTotals.totalSchools}</strong></span>
                  <span>·</span>
                  <span>Beneficiaries: <strong className="text-emerald-300">{schoolGrandTotals.totalAvailed}</strong></span>
                  <span>·</span>
                  <span>Block Claimed: <strong className="text-white">₹{schoolGrandTotals.amountApprovedByBlock.toLocaleString('en-IN')}</strong></span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedVerificationBlockId(null);
                  setSubmitValidationAlert(null);
                  setUnverifiedSchoolUdises([]);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to All Blocks</span>
              </button>

              <button
                type="button"
                onClick={() => handleApproveAllSchoolsInBlock(selectedBlock.id)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="One-click approve all schools under this block"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Approve All Schools</span>
              </button>
            </div>
          </div>

          {/* Validation Alert Message Banner when Submit is clicked prematurely */}
          {submitValidationAlert && (
            <div className="p-4 bg-rose-50 border-b-2 border-rose-300 text-rose-950 text-xs font-bold flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{submitValidationAlert}</span>
              </div>
              <button
                type="button"
                onClick={() => setSubmitValidationAlert(null)}
                className="text-xs text-rose-700 hover:underline cursor-pointer font-bold px-2.5 py-1 rounded-md bg-rose-100"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* The block details of the district whose verification button was clicked */}
          <div className="p-4 bg-slate-50/90 border-b border-slate-200">
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>The Block details of {selectedBlock.name} Block ({currentUser.districtName || 'Vellore'} District)</span>
              </h4>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Single Block View · Other block details hidden
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-xs sm:text-sm text-left border-collapse">
                <thead className="bg-slate-100/95 text-slate-800 uppercase font-bold text-xs border-b border-slate-300">
                  <tr>
                    <th className="py-3 px-2 text-center align-middle w-12 text-slate-800">Sl.No</th>
                    <th className="py-3 px-3 align-middle min-w-[150px] text-slate-800">Name of the Block</th>
                    <th className="py-3 px-2 text-center align-middle w-24 whitespace-normal leading-tight text-slate-800">Schools (Trans)</th>
                    <th className="py-3 px-2 text-center align-middle w-24 whitespace-normal leading-tight text-slate-800">Schools (Escort)</th>
                    <th className="py-3 px-2 text-center align-middle w-24 whitespace-normal leading-tight text-slate-800">Allot. Transport</th>
                    <th className="py-3 px-2 text-center align-middle w-24 whitespace-normal leading-tight text-slate-800">Allot. Escort</th>
                    <th className="py-3 px-2 text-center text-slate-800 align-middle w-28 whitespace-normal leading-tight">Availed Transport</th>
                    <th className="py-3 px-2 text-center text-slate-800 align-middle w-28 whitespace-normal leading-tight">Availed Escort</th>
                    <th className="py-3 px-2.5 text-center font-extrabold text-slate-800 align-middle w-28 whitespace-normal leading-tight">Total Availed</th>
                    <th className="py-3 px-3 text-right align-middle w-32 whitespace-normal leading-tight text-slate-800">Claim Amount (School)</th>
                    <th className="py-3 px-3 text-right text-slate-800 align-middle w-32 whitespace-normal leading-tight">Approved by Block</th>
                    <th className="py-2.5 px-3 text-slate-800">Date &amp; Time of Submission</th>
                    <th className="py-2.5 px-3 text-center text-slate-800">Action / Status</th>
                    <th className="py-2.5 px-3 text-center text-slate-800">Claim Approved by District</th>
                  </tr>
                </thead>
                <tbody className="whitespace-nowrap font-medium">
                  {selectedBlockRow && (
                    <tr className="bg-white hover:bg-slate-50/90 transition-colors">
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-400">{selectedBlockRow.slNo}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        <div>
                          <span>{selectedBlockRow.block.name} Block</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal">BEO: {selectedBlockRow.block.bmoName}</div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-800">{selectedBlockRow.schoolsAvailedTransport}</td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-blue-800">{selectedBlockRow.schoolsAvailedEscort}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-slate-600">{selectedBlockRow.allotmentTransport}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-slate-600">{selectedBlockRow.allotmentEscort}</td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-800">{selectedBlockRow.studentsAvailedTransport}</td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-blue-800">{selectedBlockRow.studentsAvailedEscort}</td>
                      <td className="py-2.5 px-2.5 text-center font-mono font-extrabold text-slate-900 bg-slate-100">{selectedBlockRow.totalStudentsAvailed}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">₹{selectedBlockRow.claimAmountBySchool.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-900">₹{selectedBlockRow.claimAmountApprovedByBlock.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {selectedBlockRow.isSubmitted && selectedBlockRow.claim ? (
                          <div>
                            <div className="text-slate-900 font-semibold">{selectedBlockRow.claim.submissionDateTime}</div>
                            <div className="text-[10px] text-slate-500 font-sans">By {selectedBlockRow.claim.submittedBy}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not Submitted</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          selectedBlockRow.isDistrictApproved || (schoolGrandTotals.totalSchools > 0 && schoolGrandTotals.approvedCount === schoolGrandTotals.totalSchools)
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : selectedBlockRow.isDistrictRejected || schoolGrandTotals.rejectedCount > 0
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-blue-100 text-blue-800 border-blue-300'
                        }`}>
                          {selectedBlockRow.isDistrictApproved || (schoolGrandTotals.totalSchools > 0 && schoolGrandTotals.approvedCount === schoolGrandTotals.totalSchools)
                            ? 'Approved'
                            : selectedBlockRow.isDistrictRejected || schoolGrandTotals.rejectedCount > 0
                            ? 'Returned'
                            : 'Under Verification'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-900">
                        ₹{schoolGrandTotals.amountApprovedByDistrict.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* School Details Section Header */}
          <div className="px-5 py-3 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                All School Details under {selectedBlock.name} Block ({schoolRowsData.length} Schools)
              </h4>
            </div>
            <div className="text-xs text-slate-600 font-mono">
              Verified: <strong className="text-emerald-700">{schoolGrandTotals.approvedCount}</strong> Approved · <strong className="text-rose-700">{schoolGrandTotals.rejectedCount}</strong> Rejected · <strong className="text-amber-700">{schoolGrandTotals.pendingCount}</strong> Pending
            </div>
          </div>

          {/* 14-Column School Verification Table */}
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-xs">
            <table className="w-full text-xs sm:text-sm text-left border-collapse">
              <thead className="bg-slate-100/95 text-slate-800 uppercase font-bold text-xs border-b border-slate-300">
                <tr>
                  {/* 1. serial number */}
                  <th className="py-3 px-2 text-center text-slate-800" title="serial number">
                    serial number
                  </th>
                  {/* 2. school name */}
                  <th className="py-3 px-3 text-slate-800" title="school name">
                    school name
                  </th>
                  {/* 3. udise code */}
                  <th className="py-3 px-2.5 font-mono text-slate-800" title="udise code">
                    udise code
                  </th>
                  {/* 4. total number of school working days in previous month */}
                  <th className="py-3 px-2 text-center leading-tight text-slate-800" title="total number of school working days in previous month">
                    total number of school working<br />days in previous month
                  </th>
                  {/* 5. Allotment of total number of students under transport facility */}
                  <th className="py-3 px-2 text-center leading-tight text-slate-800" title="Allotment of total number of students under transport facility">
                    Allotment of total number of<br />students under transport facility
                  </th>
                  {/* 6. Allotment of total number of students under escort facility */}
                  <th className="py-3 px-2 text-center leading-tight text-slate-800" title="Allotment of total number of students under escort facility">
                    Allotment of total number of<br />students under escort facility
                  </th>
                  {/* 7. how many students availed transport facility in the 'previous month' */}
                  <th className="py-3 px-2 text-center text-slate-800 leading-tight" title="how many students availed transport facility in the 'previous month'">
                    how many students availed transport<br />facility in the 'previous month'
                  </th>
                  {/* 8. how many students availed escort facility in the 'previous month' */}
                  <th className="py-3 px-2 text-center text-slate-800 leading-tight" title="how many students availed escort facility in the 'previous month'">
                    how many students availed escort<br />facility in the 'previous month'
                  </th>
                  {/* 9. Total number of students availed this service in previous month( transport+escort) */}
                  <th className="py-3 px-2.5 text-center font-extrabold text-slate-800 leading-tight" title="Total number of students availed this service in previous month( transport+escort)">
                    Total number of students availed this<br />service in previous month( transport+escort)
                  </th>
                  {/* 10. Amount claimed by school */}
                  <th className="py-3 px-3 text-right leading-tight text-slate-800" title="Amount claimed by school">
                    Amount claimed<br />by school
                  </th>
                  {/* 11. Amount approved by block */}
                  <th className="py-3 px-3 text-right text-slate-800 leading-tight" title="Amount approved by block">
                    Amount approved<br />by block
                  </th>
                  {/* 12. Student attendance copy */}
                  <th className="py-3 px-3 text-center leading-tight text-slate-800" title="Student attendance copy">
                    Student attendance<br />copy
                  </th>
                  {/* 13. Action */}
                  <th className="py-3 px-3 text-center leading-tight text-slate-800" title="Action">
                    Action
                  </th>
                  {/* 14. Claim amount approved by district */}
                  <th className="py-3 px-3 text-center leading-tight text-slate-800" title="Claim amount approved by district">
                    Claim amount approved<br />by district
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 font-medium whitespace-nowrap">
                {schoolRowsData.map((row, idx) => (
                  <tr
                    key={row.school.udiseCode}
                    className={`transition-colors ${
                      row.isUnverifiedAlerted
                        ? 'bg-rose-50/70 ring-1 ring-inset ring-rose-300'
                        : idx % 2 === 0
                          ? 'bg-white hover:bg-slate-50/90'
                          : 'bg-slate-50/70 hover:bg-slate-100/80'
                    }`}
                  >
                    {/* 1. serial number */}
                    <td className="py-3 px-2 text-center font-mono font-bold text-slate-400">
                      {row.slNo}
                    </td>

                    {/* 2. school name */}
                    <td className="py-3 px-3 font-bold text-slate-900">
                      <div>
                        <span className="truncate max-w-[200px]" title={row.school.name}>{row.school.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        HM: {row.school.headmasterName}
                      </div>
                    </td>

                    {/* 3. udise code */}
                    <td className="py-3 px-2.5 font-mono text-slate-700">
                      {row.school.udiseCode}
                    </td>

                    {/* 4. total number of school working days in previous month */}
                    <td className="py-3 px-2 text-center font-mono text-slate-700">
                      {row.workingDays}
                    </td>

                    {/* 5. Allotment of total number of students under transport facility */}
                    <td className="py-3 px-2 text-center font-mono text-slate-600">
                      {row.allotTransport}
                    </td>

                    {/* 6. Allotment of total number of students under escort facility */}
                    <td className="py-3 px-2 text-center font-mono text-slate-600">
                      {row.allotEscort}
                    </td>

                    {/* 7. how many students availed transport facility in the 'previous month' */}
                    <td className="py-3 px-2 text-center font-mono font-bold text-emerald-800">
                      {row.availedTransport}
                    </td>

                    {/* 8. how many students availed escort facility in the 'previous month' */}
                    <td className="py-3 px-2 text-center font-mono font-bold text-blue-800">
                      {row.availedEscort}
                    </td>

                    {/* 9. Total number of students availed this service in previous month( transport+escort) */}
                    <td className="py-3 px-2.5 text-center font-mono font-extrabold text-slate-900 bg-slate-50">
                      {row.totalAvailed}
                    </td>

                    {/* 10. Amount claimed by school */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      ₹{row.amountClaimed.toLocaleString('en-IN')}
                    </td>

                    {/* 11. Amount approved by block */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-900">
                      ₹{row.amountApprovedByBlock.toLocaleString('en-IN')}
                    </td>

                    {/* 12. Student attendance copy (View & Print icon) */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenAttendanceCopy(row)}
                        className="px-2.5 py-1 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg font-semibold text-[11px] inline-flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                        title="View & Print Attendance Copy uploaded by school user"
                      >
                        <MaterialIcon name="visibility" className="text-xs text-blue-600" />
                        <MaterialIcon name="print" className="text-xs text-slate-700" />
                        <span>View &amp; Print</span>
                      </button>
                    </td>

                    {/* 13. Action */}
                    <td className="py-3 px-3 text-center">
                      {row.isApproved ? (
                        <div className="flex flex-col items-center justify-center gap-1 animate-in fade-in duration-150">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                            approved
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSchoolReset(row.school.udiseCode)}
                            className="p-1 rounded-full text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 cursor-pointer transition-colors shadow-2xs"
                            title="Edit decision (reopen tick/cross mark)"
                          >
                            <MaterialIcon name="edit" className="text-xs" />
                          </button>
                        </div>
                      ) : row.isRejected ? (
                        <div className="flex flex-col items-center justify-center gap-1 animate-in fade-in duration-150">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                            Rejected
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSchoolReset(row.school.udiseCode)}
                            className="p-1 rounded-full text-slate-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 cursor-pointer transition-colors shadow-2xs"
                            title="Edit decision (reopen tick/cross mark)"
                          >
                            <MaterialIcon name="edit" className="text-xs" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1">
                          {row.isUnverifiedAlerted && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-bold animate-bounce shadow-2xs">
                              <span className="text-rose-600 font-bold">✕</span>
                              <span>Action Required</span>
                            </div>
                          )}
                          <div className="flex items-center justify-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => handleSchoolApprove(row.school.udiseCode)}
                              className="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 border-2 border-emerald-500 flex items-center justify-center shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
                              title="Approve school claim (Tick Mark)"
                            >
                              <MaterialIcon name="check" className="text-sm font-bold" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSchoolReject(row.school.udiseCode)}
                              className="w-8 h-8 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border-2 border-rose-500 flex items-center justify-center shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
                              title="Reject / Return school claim (Cross Mark)"
                            >
                              <MaterialIcon name="close" className="text-sm font-bold" />
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* 14. Claim amount approved by district */}
                    <td className="py-3 px-3 text-center">
                      {row.isApproved ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 font-mono font-bold text-xs shadow-2xs select-none animate-in fade-in duration-150">
                          <span>₹{row.amountApprovedByBlock.toLocaleString('en-IN')}</span>
                          <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 pointer-events-none text-[10px] font-bold" title="Frozen claim amount approved by district">
                            ✓
                          </span>
                        </div>
                      ) : row.isRejected ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700 shadow-2xs uppercase tracking-wide animate-in fade-in duration-150">
                          claim return
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Grand Total Row for this Block */}
              <tfoot className="bg-slate-100 text-slate-900 font-bold border-t-2 border-slate-300 text-xs whitespace-nowrap">
                <tr>
                  <td colSpan={3} className="py-3 px-3 text-slate-900 uppercase">
                    Grand Total ({selectedBlock.name} Block - {schoolGrandTotals.totalSchools} Schools)
                  </td>
                  <td className="py-3 px-2 text-center font-mono text-slate-500">—</td>
                  <td className="py-3 px-2 text-center font-mono text-slate-800">
                    {schoolGrandTotals.allotTransport}
                  </td>
                  <td className="py-3 px-2 text-center font-mono text-slate-800">
                    {schoolGrandTotals.allotEscort}
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-bold text-slate-900">
                    {schoolGrandTotals.availedTransport}
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-bold text-slate-900">
                    {schoolGrandTotals.availedEscort}
                  </td>
                  <td className="py-3 px-2.5 text-center font-mono font-extrabold text-blue-900">
                    {schoolGrandTotals.totalAvailed}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    ₹{schoolGrandTotals.amountClaimed.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800">
                    ₹{schoolGrandTotals.amountApprovedByBlock.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3 text-center text-[11px] font-mono text-slate-600">
                    {schoolGrandTotals.totalSchools} Copies
                  </td>
                  <td className="py-3 px-3 text-center text-xs font-semibold text-slate-800">
                    <span>{schoolGrandTotals.approvedCount} Appr</span>
                    {schoolGrandTotals.rejectedCount > 0 && <span className="text-rose-600 ml-1">· {schoolGrandTotals.rejectedCount} Rej</span>}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-emerald-800 text-sm">
                    ₹{schoolGrandTotals.amountApprovedByDistrict.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Below the Last School: Submit Button Bar */}
          <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">
                Block Verification Status:
              </span>{' '}
              <span className="font-mono font-bold text-emerald-700">
                {schoolGrandTotals.approvedCount} of {schoolGrandTotals.totalSchools} Approved
              </span>
              {schoolGrandTotals.rejectedCount > 0 && (
                <span className="font-mono font-bold text-rose-700 ml-2">
                  · {schoolGrandTotals.rejectedCount} Rejected
                </span>
              )}
              {schoolGrandTotals.pendingCount > 0 && (
                <span className="font-mono font-bold text-amber-700 ml-2">
                  · {schoolGrandTotals.pendingCount} Pending Action
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedVerificationBlockId(null);
                  setSubmitValidationAlert(null);
                  setUnverifiedSchoolUdises([]);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel &amp; Return to All Blocks
              </button>

              {/* Submit button: Clicking this checks if all schools verified */}
              <button
                type="button"
                onClick={handleSubmitBlockVerification}
                className="px-8 py-2.5 rounded-full font-bold text-xs text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all shadow-md shadow-emerald-950/20 flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Submit Block Verification</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* MASTER BLOCK-WISE VERIFICATION TABLE                                      */
        /* ========================================================================= */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>{activeSubTab === 'verification' ? `Claim Verification for the Month of ${cycleInfo.claimMonthOnlyName}` : 'Educational Blocks Claim Status'}</span>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  Blocks of {currentUser.districtName || 'Vellore'} District
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Consolidated block-wise claim entry data for {cycleInfo.claimMonthOnlyName}. Click Verification button under Action column to inspect and verify all schools under any block.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search block / BEO..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-full focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.03),inset_0_2px_3px_rgba(0,0,0,0.04),inset_0_-1px_1px_rgba(255,255,255,0.95)]"
                />
              </div>

              {/* Filter Bar */}
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setBlockFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${blockFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  All ({totalBlocksCount})
                </button>
                <button
                  onClick={() => setBlockFilter('SUBMITTED')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${blockFilter === 'SUBMITTED' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Submitted ({submittedBlocksCount})
                </button>
                <button
                  onClick={() => setBlockFilter('PENDING_SUBMISSION')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${blockFilter === 'PENDING_SUBMISSION' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Pending Submission ({notSubmittedBlocksCount})
                </button>
                <button
                  onClick={() => setBlockFilter('APPROVED')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${blockFilter === 'APPROVED' ? 'bg-white text-teal-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  District Approved ({districtApprovedBlocks.length})
                </button>
              </div>
            </div>
          </div>

          {/* Master 14-Column Table */}
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-xs">
            <table className="w-full text-xs sm:text-sm text-left border-collapse">
              <thead className="bg-slate-100/95 text-slate-800 uppercase font-bold text-xs border-b border-slate-300">
                <tr>
                  {/* 1. Sl.No */}
                  <th className="py-3 px-2 text-center text-slate-800" title="Sl.No">
                    Sl.No
                  </th>

                  {/* 2. Name of the Block */}
                  <th className="py-3 px-3 text-slate-800" title="Name of the Block">
                    Name of the Block
                  </th>

                  {/* 3. Total no.of schools availed transport facility */}
                  <th className="py-3 px-2.5 text-center leading-tight text-slate-800" title="Total no.of schools availed transport facility">
                    Total no.of schools availed<br />transport facility
                  </th>

                  {/* 4. Total no.of schools availed Escort facility */}
                  <th className="py-3 px-2.5 text-center leading-tight text-slate-800" title="Total no.of schools availed Escort facility">
                    Total no.of schools availed<br />Escort facility
                  </th>

                  {/* 5. Allotment of total number of students under transport facility */}
                  <th className="py-3 px-2.5 text-center leading-tight text-slate-800" title="Allotment of total number of students under transport facility">
                    Allotment of total number of<br />students under transport facility
                  </th>

                  {/* 6. Allotment of total number of students under escort facility */}
                  <th className="py-3 px-2.5 text-center leading-tight text-slate-800" title="Allotment of total number of students under escort facility">
                    Allotment of total number of<br />students under escort facility
                  </th>

                  {/* 7. how many students availed transport facility in the 'previous month' */}
                  <th className="py-3 px-2.5 text-center text-slate-800 leading-tight" title="how many students availed transport facility in the 'previous month'">
                    how many students availed transport<br />facility in '{cycleInfo.claimMonthOnlyName}'
                  </th>

                  {/* 8. how many students availed escort facility in the 'previous month' */}
                  <th className="py-3 px-2.5 text-center text-slate-800 leading-tight" title="how many students availed escort facility in the 'previous month'">
                    how many students availed escort<br />facility in '{cycleInfo.claimMonthOnlyName}'
                  </th>

                  {/* 9. Total number of students availed this service in previous month( transport+escort) */}
                  <th className="py-3 px-2.5 text-center font-extrabold text-slate-800 leading-tight" title="Total number of students availed this service in previous month( transport+escort)">
                    Total number of students availed this<br />service in previous month( transport+escort)
                  </th>

                  {/* 10. Claim Amount by school for the previous month */}
                  <th className="py-3 px-3 text-right leading-tight text-slate-800" title="Claim Amount by school for the previous month">
                    Claim Amount by school<br />for the previous month
                  </th>

                  {/* 11. claim amount approved by block */}
                  <th className="py-3 px-3 text-right text-slate-800 leading-tight" title="claim amount approved by block">
                    claim amount<br />approved by block
                  </th>

                  {/* 12. date and time of block submission */}
                  <th className="py-3 px-3 leading-tight text-slate-800" title="date and time of block submission">
                    date and time of<br />block submission
                  </th>

                  {/* 13. Action */}
                  <th className="py-3 px-3 text-center leading-tight text-slate-800" title="Action">
                    Action
                  </th>

                  {/* 14. Claim Amount approved by the district */}
                  <th className="py-3 px-3 text-center leading-tight text-slate-800" title="Claim Amount approved by the district">
                    Claim Amount approved<br />by the district
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 font-medium whitespace-nowrap">
                {blockRows.map((row, idx) => (
                  <tr key={row.block.id} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50/90 transition-colors' : 'bg-slate-50/70 hover:bg-slate-100/80 transition-colors'}>
                    {/* 1. Sl.No */}
                    <td className="py-3 px-2 text-center font-mono font-bold text-slate-400">
                      {row.slNo}
                    </td>

                    {/* 2. Name of the Block */}
                    <td className="py-3 px-3 font-bold text-slate-900">
                      <div>
                        <span>{row.block.name} Block</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        {row.block.bmoName}
                      </div>
                    </td>

                    {/* 3. Total no.of schools availed transport facility */}
                    <td className="py-3 px-2.5 text-center font-mono font-bold text-emerald-800">
                      {row.schoolsAvailedTransport}
                    </td>

                    {/* 4. Total no.of schools availed Escort facility */}
                    <td className="py-3 px-2.5 text-center font-mono font-bold text-blue-800">
                      {row.schoolsAvailedEscort}
                    </td>

                    {/* 5. Allotment of total number of students under transport facility */}
                    <td className="py-3 px-2.5 text-center font-mono text-slate-600">
                      {row.allotmentTransport}
                    </td>

                    {/* 6. Allotment of total number of students under escort facility */}
                    <td className="py-3 px-2.5 text-center font-mono text-slate-600">
                      {row.allotmentEscort}
                    </td>

                    {/* 7. how many students availed transport facility in the 'previous month' */}
                    <td className="py-3 px-2.5 text-center font-mono font-bold text-emerald-800">
                      {row.studentsAvailedTransport}
                    </td>

                    {/* 8. how many students availed escort facility in the 'previous month' */}
                    <td className="py-3 px-2.5 text-center font-mono font-bold text-blue-800">
                      {row.studentsAvailedEscort}
                    </td>

                    {/* 9. Total number of students availed this service in previous month( transport+escort) */}
                    <td className="py-3 px-2.5 text-center font-mono font-extrabold text-slate-900 bg-slate-50">
                      {row.totalStudentsAvailed}
                    </td>

                    {/* 10. Claim Amount by school for the previous month */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {row.claimAmountBySchool > 0 ? `₹${row.claimAmountBySchool.toLocaleString('en-IN')}` : '₹0'}
                    </td>

                    {/* 11. claim amount approved by block */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-900">
                      {row.claimAmountApprovedByBlock > 0 ? `₹${row.claimAmountApprovedByBlock.toLocaleString('en-IN')}` : '₹0'}
                    </td>

                    {/* 12. date and time of block submission */}
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                      {row.isSubmitted && row.claim ? (
                        <div>
                          <div className="text-slate-900 font-semibold">{row.claim.submissionDateTime}</div>
                          <div className="text-[10px] text-slate-500 font-sans">By {row.claim.submittedBy}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Not Submitted</span>
                      )}
                    </td>

                    {/* 13. Action */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedVerificationBlockId(row.block.id)}
                          className={`px-3.5 py-1.5 rounded-full font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                            row.isDistrictApproved
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : row.isDistrictRejected
                              ? 'bg-rose-600 hover:bg-rose-700 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white'
                          }`}
                          title={`Click to verify all school claim details under ${row.block.name} block`}
                        >
                          <MaterialIcon name="visibility" className="text-xs" />
                          <span>Verification</span>
                        </button>

                        {row.isDistrictApproved && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Approved
                          </span>
                        )}
                        {row.isDistrictRejected && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            Returned
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 14. Claim Amount approved by the district */}
                    <td className="py-3 px-3 text-center">
                      {row.isDistrictApproved ? (
                        <div className="inline-flex items-center gap-1.5 text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-300 font-mono font-bold text-xs shadow-2xs select-none">
                          <span>₹{row.claimAmountApprovedByBlock.toLocaleString('en-IN')}</span>
                          <span
                            className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 pointer-events-none text-[10px] font-bold"
                            title="Frozen Approved Amount"
                          >
                            ✓
                          </span>
                        </div>
                      ) : row.isDistrictRejected ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700 shadow-2xs">
                          Returned
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Master District Grand Total Row */}
              <tfoot className="bg-slate-100 text-slate-900 font-bold border-t-2 border-slate-300 text-xs whitespace-nowrap">
                <tr>
                  <td colSpan={2} className="py-3 px-3 text-slate-900 uppercase">
                    Grand Total (District Total - {grandTotals.totalBlocks} Blocks)
                  </td>
                  <td className="py-3 px-2.5 text-center font-mono font-bold text-slate-900">
                    {grandTotals.schoolsAvailedTransport}
                  </td>
                  <td className="py-3 px-2.5 text-center font-mono font-bold text-slate-900">
                    {grandTotals.schoolsAvailedEscort}
                  </td>
                  <td className="py-3 px-2.5 text-center font-mono text-slate-800">
                    {grandTotals.allotmentTransport}
                  </td>
                  <td className="py-3 px-2.5 text-center font-mono text-slate-800">
                    {grandTotals.allotmentEscort}
                  </td>
                  <td className="py-3 px-2.5 text-center font-mono font-bold text-slate-900">
                    {grandTotals.studentsAvailedTransport}
                  </td>
                  <td className="py-3 px-2.5 text-center font-mono font-bold text-slate-900">
                    {grandTotals.studentsAvailedEscort}
                  </td>
                  <td className="py-3 px-2.5 text-center font-mono font-extrabold text-blue-900">
                    {grandTotals.totalStudentsAvailed}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    ₹{grandTotals.claimAmountBySchool.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800">
                    ₹{grandTotals.claimAmountApprovedByBlock.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">—</td>
                  <td className="py-3 px-3 text-center text-xs font-semibold text-slate-800">
                    {districtApprovedBlocks.length} Approved
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-emerald-800 text-sm">
                    ₹{grandTotals.amountApprovedByDistrict.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Strict Final District Sanction Control Bar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-600">
              {isFinalDistrictSanctioned ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Final District Sanction Order generated and disbursed for {cycleInfo.claimMonthName}.
                </span>
              ) : finalCheck.canApprove ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  All 7 blocks have submitted claims and all are verified & approved! Ready for Final District Approval.
                </span>
              ) : (
                <span className="text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Final Sanction Locked: {finalCheck.reasons.join(' · ')}
                </span>
              )}
            </div>

            <div>
              {isFinalDistrictSanctioned ? (
                <button
                  type="button"
                  onClick={() => setViewApprovedModal(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  View Approved Claim
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!finalCheck.canApprove}
                  onClick={handleCompleteFinalSanction}
                  title={
                    !finalCheck.canApprove
                      ? 'Only when all required blocks have submitted and all required Block claims have been verified and approved can you finalize.'
                      : 'Issue final district-level sanction order'
                  }
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileCheck2 className="w-4 h-4" />
                  Complete Final District Approval
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Block Inspection / District Verification Modal */}
      {inspectingBlockClaim && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  District Verification: {inspectingBlockClaim.blockName} Block
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Month: {inspectingBlockClaim.claimMonthName} · Submitted By: {inspectingBlockClaim.submittedBy} ({inspectingBlockClaim.submissionDateTime})
                </p>
              </div>
              <button
                onClick={() => setInspectingBlockClaim(null)}
                className="text-slate-400 hover:text-slate-700 p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div>
                  <span className="text-slate-500">Block Status:</span>
                  <div className="font-bold text-blue-700 mt-0.5">{inspectingBlockClaim.status.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <span className="text-slate-500">Schools Covered:</span>
                  <div className="font-bold text-slate-800 mt-0.5 tabular-nums">{inspectingBlockClaim.submittedSchoolsCount} of {inspectingBlockClaim.totalSchoolsCount}</div>
                </div>
                <div>
                  <span className="text-slate-500">Total Beneficiaries:</span>
                  <div className="font-bold text-slate-800 mt-0.5 tabular-nums">{inspectingBlockClaim.totalStudentsCount} students</div>
                </div>
                <div>
                  <span className="text-slate-500">Total Demanded:</span>
                  <div className="font-bold text-emerald-700 mt-0.5 tabular-nums">{formatCurrencyINR(inspectingBlockClaim.totalClaimAmount)}</div>
                </div>
              </div>

              {/* School-by-School Drill-Down Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Schools Under {inspectingBlockClaim.blockName} Block
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[11px] border-b border-slate-300">
                      <tr>
                        <th className="py-2.5 px-3 text-slate-800">#</th>
                        <th className="py-2.5 px-3 text-slate-800">UDISE Code</th>
                        <th className="py-2.5 px-3 text-slate-800">School Name</th>
                        <th className="py-2.5 px-3 text-right text-slate-800">Students</th>
                        <th className="py-2.5 px-3 text-right text-slate-800">Amount (₹)</th>
                        <th className="py-2.5 px-3 text-slate-800">Block Verification Remarks</th>
                        <th className="py-2.5 px-3 text-center text-slate-800">Inspect Students</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {getSchoolClaimsForBlock(inspectingBlockClaim.blockId).map((sc, idx) => (
                        <tr key={sc.id} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50/90' : 'bg-slate-50/70 hover:bg-slate-100/80'}>
                          <td className="py-2 px-3 text-slate-400 tabular-nums">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono tabular-nums">{sc.udiseCode}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900">{sc.schoolName}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{sc.totalStudents}</td>
                          <td className="py-2 px-3 text-right font-bold tabular-nums text-slate-800">
                            {formatCurrencyINR(sc.totalClaimAmount)}
                          </td>
                          <td className="py-2 px-3 text-slate-600 truncate max-w-xs">
                            {sc.blockVerification?.remarks || 'Approved by BEO'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedSchoolInBlock(sc)}
                              className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 flex items-center gap-1 mx-auto"
                            >
                              <MaterialIcon name="visibility" className="text-xs" />
                              View Students
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Student Inspection Modal within Block modal if clicked */}
              {selectedSchoolInBlock && (
                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-blue-900">
                      Student Breakdown for {selectedSchoolInBlock.schoolName} ({selectedSchoolInBlock.udiseCode})
                    </div>
                    <button
                      onClick={() => setSelectedSchoolInBlock(null)}
                      className="text-xs text-blue-700 hover:underline"
                    >
                      Hide
                    </button>
                  </div>
                  <div className="border border-blue-200 rounded overflow-hidden bg-white max-h-48 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-800 font-bold text-[10px] uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-1.5 px-2 text-slate-800">Student Name</th>
                          <th className="py-1.5 px-2 text-slate-800">EMIS</th>
                          <th className="py-1.5 px-2 text-slate-800">Facility</th>
                          <th className="py-1.5 px-2 text-right text-slate-800">Days</th>
                          <th className="py-1.5 px-2 text-right text-slate-800">Rate</th>
                          <th className="py-1.5 px-2 text-right text-slate-800">Amount</th>
                          <th className="py-1.5 px-2 text-slate-800">Helper / Mode</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedSchoolInBlock.students.map((st, idx) => (
                          <tr key={st.id} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50/90' : 'bg-slate-50/70 hover:bg-slate-100/80'}>
                            <td className="py-1 px-2 font-medium">{st.studentName}</td>
                            <td className="py-1 px-2 font-mono text-[10px] text-slate-500">{st.emisNumber}</td>
                            <td className="py-1 px-2">{st.category}</td>
                            <td className="py-1 px-2 text-right font-mono tabular-nums">{st.daysAttended}</td>
                            <td className="py-1 px-2 text-right font-mono tabular-nums">₹{st.ratePerDay}</td>
                            <td className="py-1 px-2 text-right font-bold font-mono tabular-nums text-slate-900">
                              ₹{st.totalClaimAmount}
                            </td>
                            <td className="py-1 px-2 text-slate-500 text-[10px]">{st.serviceProviderName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* District Decision Controls */}
              {!isFinalDistrictSanctioned && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    District Approval / Rejection Decision
                  </div>
                  <textarea
                    rows={2}
                    value={districtRemarks}
                    onChange={(e) => setDistrictRemarks(e.target.value)}
                    placeholder="Enter District sanction observation or rejection reasons for return to BEO..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                  />
                  <div className="flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleVerifyBlock('REJECTED')}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject & Return to Block for Correction
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerifyBlock('APPROVED')}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      District Approval
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingBlockClaim(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Approved Claim Modal (Per Requirements) */}
      {viewApprovedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-emerald-600" />
                  District Sanction Order: Vellore District Transport & Escort Claims
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sanction Order: <span className="font-mono font-bold text-slate-800">SS/VEL/TRANS/{cycleInfo.claimYear}/2490</span> · Month: {cycleInfo.claimMonthName} · Period: {cycleInfo.calculationPeriodString}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('district-sanction-content');
                    if (el) {
                      printHtmlDocument(`District_Sanction_Order_${cycleInfo.claimMonthName}`, el.innerHTML);
                    } else {
                      window.print();
                    }
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  title="Print official district sanction order"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Official Sanction Order</span>
                </button>
                <button
                  onClick={() => setViewApprovedModal(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 text-lg font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div id="district-sanction-content" className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Government Header Stamp */}
              <div className="text-center pb-4 border-b border-slate-200">
                <div className="text-xs uppercase font-semibold tracking-wider text-slate-500">Government of Tamil Nadu · School Education Department</div>
                <h2 className="text-lg font-bold text-slate-900 mt-1">OFFICE OF THE CHIEF EDUCATIONAL OFFICER & DPC</h2>
                <div className="text-xs text-slate-600">SAMAGRA SHIKSHA, VELLORE DISTRICT - 632 009</div>
                <div className="inline-block mt-2 px-3 py-1 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded font-mono text-xs font-bold">
                  PROCEEDINGS RC NO: 4091/SS/VEL/TRANS/{cycleInfo.claimYear}
                </div>
              </div>

              {/* Consolidated Block Summary Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Block-wise Approved Disbursement Summary
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-800 uppercase font-bold text-[11px] border-b border-slate-300">
                      <tr>
                        <th className="py-2.5 px-3 text-slate-800">#</th>
                        <th className="py-2.5 px-3 text-slate-800">Educational Block</th>
                        <th className="py-2.5 px-3 text-slate-800">BEO In-Charge</th>
                        <th className="py-2.5 px-3 text-right text-slate-800">Schools</th>
                        <th className="py-2.5 px-3 text-right text-slate-800">Beneficiaries</th>
                        <th className="py-2.5 px-3 text-right text-slate-800">Sanction Amount (₹)</th>
                        <th className="py-2.5 px-3 text-center text-slate-800">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeBlockClaims.map((bc, idx) => (
                        <tr key={bc.id} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50/90' : 'bg-slate-50/70 hover:bg-slate-100/80'}>
                          <td className="py-2 px-3 font-mono text-slate-400 tabular-nums">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{bc.blockName}</td>
                          <td className="py-2 px-3 text-slate-600">{bc.submittedBy}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">{bc.submittedSchoolsCount}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">{bc.totalStudentsCount}</td>
                          <td className="py-2 px-3 text-right font-bold font-mono tabular-nums text-emerald-700">
                            {formatCurrencyINR(bc.totalClaimAmount)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              SANCTIONED
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 text-slate-900 font-bold border-t-2 border-slate-300 text-xs">
                      <tr>
                        <td colSpan={4} className="py-3 px-3 text-right text-slate-900 uppercase">Consolidated District Grand Total:</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-blue-900 font-extrabold">{totalDistrictBeneficiaries} students</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-800 text-sm font-extrabold">
                          {formatCurrencyINR(totalDistrictFundDemanded)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setViewApprovedModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Attendance Copy View & Print Modal */}
      {viewAttendanceSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative max-w-4xl w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Top Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white">
                    Student Attendance Register &amp; Certificate Copy
                  </h4>
                  <p className="text-xs text-slate-300">
                    {viewAttendanceSchool.schoolName} ({viewAttendanceSchool.udiseCode}) · Month of {cycleInfo.claimMonthName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    printStudentWiseClaimSheet({
                      schoolName: viewAttendanceSchool.schoolName,
                      udiseCode: viewAttendanceSchool.udiseCode,
                      blockName: viewAttendanceSchool.blockName,
                      monthName: viewAttendanceSchool.claimMonthName,
                      totalWorkingDays: viewAttendanceSchool.students[0]?.workingDaysInMonth || 22,
                      students: viewAttendanceSchool.students,
                      hmName: viewAttendanceSchool.submittedBy,
                    });
                  }}
                  className="px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Copy</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    downloadStudentWiseClaimPdf({
                      schoolName: viewAttendanceSchool.schoolName,
                      udiseCode: viewAttendanceSchool.udiseCode,
                      blockName: viewAttendanceSchool.blockName,
                      monthName: viewAttendanceSchool.claimMonthName,
                      totalWorkingDays: viewAttendanceSchool.students[0]?.workingDaysInMonth || 22,
                      students: viewAttendanceSchool.students,
                      hmName: viewAttendanceSchool.submittedBy,
                    });
                  }}
                  className="px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Download PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewAttendanceSchool(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Complete Attendance Sheet Preview */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="text-center pb-4 border-b border-slate-200">
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 uppercase tracking-wide">
                    Government of Tamil Nadu · Department of School Education
                  </h3>
                  <p className="text-xs text-slate-600">
                    Samagra Shiksha · Transport &amp; Escort Beneficiary Claim Scheme · {cycleInfo.claimMonthName}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono">
                  <div>
                    <span className="text-slate-400 block text-[10px]">SCHOOL:</span>
                    <strong className="text-slate-800">{viewAttendanceSchool.schoolName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">UDISE CODE:</span>
                    <strong className="text-slate-800">{viewAttendanceSchool.udiseCode}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">BLOCK:</span>
                    <strong className="text-slate-800">{viewAttendanceSchool.blockName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">TOTAL BENEFICIARIES:</span>
                    <strong className="text-emerald-700">{viewAttendanceSchool.students.length} Students</strong>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm text-left">
                    <thead className="bg-slate-100 text-slate-800 uppercase font-bold text-[10px] border-b border-slate-300">
                      <tr>
                        <th className="py-2 px-2 text-center text-slate-800">S.No</th>
                        <th className="py-2 px-3 text-slate-800">Student Name</th>
                        <th className="py-2 px-3 font-mono text-slate-800">EMIS No</th>
                        <th className="py-2 px-2 text-center text-slate-800">Facility</th>
                        <th className="py-2 px-2 text-center text-slate-800">Days Attended</th>
                        <th className="py-2 px-3 text-right text-slate-800">Claim Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {viewAttendanceSchool.students.map((st, i) => (
                        <tr key={st.id || i} className={i % 2 === 0 ? 'bg-white hover:bg-slate-50/90' : 'bg-slate-50/70 hover:bg-slate-100/80'}>
                          <td className="py-2 px-2 text-center font-mono font-bold text-slate-400">{i + 1}</td>
                          <td className="py-2 px-3 font-bold text-slate-800">{st.studentName}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{st.emisNumber}</td>
                          <td className="py-2 px-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              st.category === 'Transport' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {st.category}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-slate-700">
                            {st.daysAttended} / {st.workingDaysInMonth || 22}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">
                            ₹{st.totalClaimAmount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 text-slate-900 font-bold border-t-2 border-slate-300">
                      <tr>
                        <td colSpan={4} className="py-2 px-3 text-slate-900 uppercase">Total School Sanction</td>
                        <td className="py-2 px-2 text-center font-mono text-slate-800 font-bold">
                          {viewAttendanceSchool.students.reduce((a, b) => a + b.daysAttended, 0)} Days
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-extrabold text-emerald-800">
                          ₹{viewAttendanceSchool.totalClaimAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
                  <strong>Headmaster Statutory Declaration:</strong> I hereby certify that the physical student attendance registers and vehicle/escort service logs for the month of {cycleInfo.claimMonthName} have been thoroughly audited and found correct.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
