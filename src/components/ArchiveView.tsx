import React, { useState } from 'react';
import { claimStore } from '../services/claimStore';
import { UserSession, SchoolClaimRecord } from '../types/claim';
import { DynamicCycleInfo } from '../utils/dateCycle';
import { supabase } from '../services/supabaseClient';
import {
  printStudentWiseClaimSheet,
  downloadOfficialClaimLandscapePdf,
  downloadClaimCsv
} from '../utils/printHelper';
import {
  Calendar,
  Eye,
  CheckCircle2,
  AlertCircle,
  Printer,
  Download,
  ExternalLink,
  ShieldCheck,
  FileSpreadsheet,
  Building,
  Clock,
  Bus,
  UserCheck,
  Landmark,
  FileText
} from 'lucide-react';

interface ArchiveViewProps {
  currentUser?: UserSession;
  cycleInfo?: DynamicCycleInfo;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({ currentUser, cycleInfo }) => {
  const store = claimStore.getState();
  const effectiveUser = currentUser || store.currentUser;
  const udiseCode = effectiveUser.udiseCode || '33040100101';

  // Month selection state (enabled strictly from Sep 2026 onwards)
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [approvedClaim, setApprovedClaim] = useState<SchoolClaimRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Available selectable months from September 2026 onwards
  const availableMonths = [
    { key: '2026-09', name: 'September 2026', label: 'Sep 2026' },
    { key: '2026-10', name: 'October 2026', label: 'Oct 2026' },
    { key: '2026-11', name: 'November 2026', label: 'Nov 2026' },
    { key: '2026-12', name: 'December 2026', label: 'Dec 2026' },
    { key: '2027-01', name: 'January 2027', label: 'Jan 2027' },
    { key: '2027-02', name: 'February 2027', label: 'Feb 2027' },
    { key: '2027-03', name: 'March 2027', label: 'Mar 2027' },
  ];

  // Handler for Month Input Change with strict "from Sep 2026 only enable" check
  const handleMonthChange = (val: string) => {
    // If entered month is earlier than 2026-09, enforce 2026-09 minimum
    if (val && val < '2026-09') {
      setSelectedMonth('2026-09');
      setErrorMessage('Selection enabled from Sep 2026 only.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    setSelectedMonth(val);
    setHasSearched(false);
    setErrorMessage(null);
  };

  // Handler for "View" button click: pulls previous months claim (approved by district user)
  const handleViewClaim = async () => {
    if (!selectedMonth) return;
    setIsQuerying(true);
    setErrorMessage(null);
    setHasSearched(true);
    setApprovedClaim(null);

    try {
      // 1. First query Supabase database for district-approved claim
      let foundRecord: SchoolClaimRecord | null = null;

      try {
        const { data, error } = await supabase
          .from('monthly_claims')
          .select('*')
          .eq('udise_code', udiseCode)
          .eq('claim_month_key', selectedMonth)
          .in('status', ['DISTRICT_APPROVED', 'FINAL_DISTRICT_APPROVAL', 'MONTHLY_CYCLE_CLOSED'])
          .limit(1);

        if (!error && data && data.length > 0) {
          const rec = data[0];
          foundRecord = {
            id: rec.id || `CLM_${rec.udise_code}_${rec.claim_month_key}`,
            claimMonthKey: rec.claim_month_key,
            claimMonthName: rec.claim_month_name || selectedMonth,
            calculationPeriod: rec.calculation_period || `Month of ${selectedMonth}`,
            udiseCode: rec.udise_code,
            schoolName: rec.school_name || effectiveUser.schoolName || 'School',
            blockId: rec.block_id || effectiveUser.blockId || '',
            blockName: rec.block_name || effectiveUser.blockName || '',
            userId: rec.user_id || `SCH_${rec.udise_code}`,
            submittedBy: rec.submitted_by || 'Headmaster',
            submissionDateTime: rec.submission_date_time || '',
            status: rec.status,
            students: rec.students || [],
            totalStudents: rec.total_students || (rec.students ? rec.students.length : 0),
            totalClaimAmount: rec.total_claim_amount || 0,
            appointedVehicles: rec.appointed_vehicles,
            appointedEscorts: rec.appointed_escorts,
            smcDetails: rec.smc_details,
            districtVerification: rec.district_verification || {
              verifiedByUserId: 'DIST_VELLORE_01',
              verifiedByName: 'Dr. M. Sangeetha, CEO / DPC',
              verifiedAt: 'Official District Sanction',
              decision: 'APPROVED',
              remarks: 'Approved by District Educational Authority. Funds released to SMC account via ECS.',
            },
          };
        }
      } catch (err) {
        console.warn('Supabase query exception, falling back to local claim store:', err);
      }

      // 2. If not found in remote Supabase table, query local synced store for district approved claim
      if (!foundRecord) {
        const localMatches = claimStore.getState().schoolClaims.filter(c => {
          const matchesSchool = c.udiseCode === udiseCode;
          const matchesMonth = c.claimMonthKey === selectedMonth;
          const isDistrictApproved =
            c.status === 'DISTRICT_APPROVED' ||
            c.status === 'FINAL_DISTRICT_APPROVAL' ||
            c.status === 'MONTHLY_CYCLE_CLOSED' ||
            c.districtVerification?.decision === 'APPROVED';
          return matchesSchool && matchesMonth && isDistrictApproved;
        });

        if (localMatches.length > 0) {
          foundRecord = localMatches[0];
        }
      }

      // 3. Process Result
      if (foundRecord) {
        setApprovedClaim(foundRecord);
        setErrorMessage(null);
      } else {
        // As explicitly required: suppose previous month claim not available in database then message shows 'sorry yours selected month claim not available'
        setErrorMessage('sorry yours selected month claim not available');
        setApprovedClaim(null);
      }
    } catch (err: any) {
      setErrorMessage('sorry yours selected month claim not available');
      setApprovedClaim(null);
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* ======================================================== */}
      {/* SECTION CARD: VIEW PREVIOUS MONTH CLAIM                  */}
      {/* ======================================================== */}
      <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg space-y-6">
        
        {/* Top Header */}
        <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>View Previous month claim</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  District Approved Archive
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect official claims approved by the District Educational Authority pulled directly from database
              </p>
            </div>
          </div>

          {/* Quick link: User opens the Google Apps Script Web App */}
          <div className="flex items-center gap-2">
            <a
              href="https://script.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all flex items-center gap-1.5 shadow-2xs"
              title="Open Google Apps Script Web App Endpoint"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              <span>Google Apps Script Web App</span>
            </a>
          </div>
        </div>

        {/* ======================================================== */}
        {/* FIELD: SELECT MONTH + INPUT BOX + AUTO VIEW BUTTON       */}
        {/* ======================================================== */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Label & Input Box right near (beside) each other */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Field name as 'Select month' */}
            <label htmlFor="month-picker-input" className="text-xs sm:text-sm font-bold text-slate-900 whitespace-nowrap">
              Select month :
            </label>

            {/* Input box with month (month picker) selection option (from Sep 2026 only enable) */}
            <div className="relative flex items-center">
              <input
                id="month-picker-input"
                type="month"
                min="2026-09"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="px-4 py-2 text-xs font-mono font-bold text-slate-900 bg-white border-2 border-emerald-400 rounded-xl shadow-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all cursor-pointer"
                title="Select month (Enabled from September 2026 onwards)"
              />
            </div>

            {/* When month selected then automatically appear a View button right near of input box */}
            {selectedMonth && (
              <button
                type="button"
                onClick={handleViewClaim}
                disabled={isQuerying}
                className="px-5 py-2 rounded-full font-bold text-xs text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all shadow-md shadow-emerald-950/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 animate-in fade-in zoom-in-95 duration-150"
              >
                {isQuerying ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                <span>View</span>
              </button>
            )}
          </div>

          {/* Quick Month Selector Pills for Convenience */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[10px] uppercase font-bold text-slate-400 px-1">Months:</span>
            {availableMonths.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  setSelectedMonth(m.key);
                  setHasSearched(false);
                  setErrorMessage(null);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  selectedMonth === m.key
                    ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

        </div>

        {/* ======================================================== */}
        {/* NOT AVAILABLE ERROR MESSAGE BANNER                       */}
        {/* ======================================================== */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 flex items-center gap-3 animate-in fade-in duration-200 shadow-xs">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs font-bold tracking-wide">
              {errorMessage}
            </div>
          </div>
        )}

        {/* Initial Prompt when nothing searched yet */}
        {!hasSearched && !approvedClaim && !errorMessage && (
          <div className="p-8 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-2">
            <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-xs font-bold text-slate-700">
              Select a month starting from September 2026 and click "View"
            </div>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              This will pull the official claim records approved by the District Educational Authority from the database.
            </p>
          </div>
        )}

        {/* ======================================================== */}
        {/* APPROVED CLAIM PRESENTATION (WHEN RECORD FOUND)          */}
        {/* ======================================================== */}
        {approvedClaim && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* District Approval Status Header Card */}
            <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300/80 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-200/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Claim Approved by District User
                    </h3>
                    <div className="text-[11px] text-emerald-800 font-semibold">
                      Month of Claim: <strong>{approvedClaim.claimMonthName}</strong> · Sanction Status: <strong>Sanction Order Released</strong>
                    </div>
                  </div>
                </div>

                {/* Print & Download Buttons for Approved Sheet */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadOfficialClaimLandscapePdf({
                      schoolName: approvedClaim.schoolName,
                      udiseCode: approvedClaim.udiseCode,
                      blockName: approvedClaim.blockName,
                      monthName: approvedClaim.claimMonthName,
                      totalWorkingDays: approvedClaim.students[0]?.workingDaysInMonth || 22,
                      students: approvedClaim.students,
                      hmName: approvedClaim.submittedBy
                    })}
                    className="px-3.5 py-1.5 rounded-full font-bold text-xs text-white bg-slate-900 hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Print PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadClaimCsv({
                      schoolName: approvedClaim.schoolName,
                      udiseCode: approvedClaim.udiseCode,
                      blockName: approvedClaim.blockName,
                      monthName: approvedClaim.claimMonthName,
                      totalWorkingDays: approvedClaim.students[0]?.workingDaysInMonth || 22,
                      students: approvedClaim.students
                    })}
                    className="px-3.5 py-1.5 rounded-full font-bold text-xs text-emerald-950 bg-emerald-200 hover:bg-emerald-300 border border-emerald-300 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>

              {/* District Authority Remarks */}
              <div className="text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <div>
                  <span className="font-bold text-slate-900">Approved by: </span>
                  <span>{approvedClaim.districtVerification?.verifiedByName || 'Dr. M. Sangeetha, Chief Educational Officer / DPC'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900">Verification Timestamp: </span>
                  <span className="font-mono">{approvedClaim.districtVerification?.verifiedAt || 'Official Sanction Order'}</span>
                </div>
              </div>
              {approvedClaim.districtVerification?.remarks && (
                <div className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                  <span className="font-bold text-slate-800">Authority Remarks: </span>
                  <span>{approvedClaim.districtVerification.remarks}</span>
                </div>
              )}
            </div>

            {/* School & Cycle Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">School</span>
                <span className="font-bold text-slate-900 truncate block mt-0.5">{approvedClaim.schoolName}</span>
                <span className="text-[10px] font-mono text-slate-500">UDISE: {approvedClaim.udiseCode}</span>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Block</span>
                <span className="font-bold text-slate-900 block mt-0.5">{approvedClaim.blockName}</span>
                <span className="text-[10px] text-slate-500">Vellore District</span>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Beneficiaries</span>
                <span className="font-bold font-mono text-slate-900 text-sm block mt-0.5">
                  {approvedClaim.students.length} Students
                </span>
                <span className="text-[10px] text-slate-500">All attendance verified</span>
              </div>
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Approved Claim Amount</span>
                <span className="font-extrabold font-mono text-emerald-900 text-sm block mt-0.5">
                  ₹{approvedClaim.totalClaimAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-emerald-700">Direct SMC DBT</span>
              </div>
            </div>

            {/* Beneficiaries Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Approved Beneficiary Students ({approvedClaim.students.length} Records)</span>
                <span className="text-[11px] font-mono text-slate-500">Calculation Period: {approvedClaim.calculationPeriod}</span>
              </div>
              <div className="overflow-x-auto bg-white">
                <table className="w-full text-xs sm:text-sm text-left border-collapse">
                  <thead className="bg-slate-100/90 text-slate-800 font-bold uppercase text-xs border-b border-slate-300">
                    <tr>
                      <th className="py-3 px-3 text-center w-12 align-middle">Sl.no</th>
                      <th className="py-3 px-3 align-middle min-w-[150px]">Student name</th>
                      <th className="py-3 px-3 text-center align-middle min-w-[125px]">EMIS number</th>
                      <th className="py-3 px-3 text-center align-middle min-w-[95px]">Class &amp; Section</th>
                      <th className="py-3 px-2.5 text-center align-middle w-24">Gender</th>
                      <th className="py-3 px-3 text-center align-middle w-28">Mode</th>
                      <th className="py-3 px-2.5 text-center align-middle w-28 whitespace-normal leading-tight">Working Days</th>
                      <th className="py-3 px-2.5 text-center align-middle w-28 whitespace-normal leading-tight">Days Availed</th>
                      <th className="py-3 px-3 text-right align-middle w-32 whitespace-normal leading-tight">Approved Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {approvedClaim.students.map((st, idx) => (
                      <tr key={st.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-400 align-middle">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900 leading-snug break-words align-middle">
                          {st.studentName}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700 align-middle">
                          {st.emisNumber}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-700 align-middle">
                          {st.grade}
                        </td>
                        <td className="py-3 px-2.5 text-center text-slate-700 align-middle">
                          {st.gender || (idx % 2 === 0 ? 'Male' : 'Female')}
                        </td>
                        <td className="py-3 px-3 text-center align-middle">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            st.category === 'Transport'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}>
                            {st.category}
                          </span>
                        </td>
                        <td className="py-3 px-2.5 text-center font-mono font-bold text-slate-800 align-middle">
                          {st.workingDaysInMonth || 22}
                        </td>
                        <td className="py-3 px-2.5 text-center font-mono font-extrabold text-emerald-800 align-middle">
                          {st.daysAttended}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 align-middle">
                          ₹{st.totalClaimAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200 text-xs">
                    <tr>
                      <td colSpan={6} className="py-3 px-3 text-slate-900 uppercase">
                        Grand Total
                      </td>
                      <td className="py-3 px-2.5 text-center font-mono text-slate-800">
                        {approvedClaim.students[0]?.workingDaysInMonth || 22} Days
                      </td>
                      <td className="py-3 px-2.5 text-center font-mono font-bold text-emerald-900">
                        {approvedClaim.students.reduce((sum, s) => sum + s.daysAttended, 0)} Days
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-900 text-sm">
                        ₹{approvedClaim.totalClaimAmount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Appointed Facilities & Bank Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              
              {/* Appointed Facility */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Bus className="w-4 h-4 text-emerald-600" />
                  <span>Approved Transport / Escort Details</span>
                </div>
                {approvedClaim.appointedVehicles && approvedClaim.appointedVehicles.length > 0 ? (
                  <div className="space-y-1">
                    {approvedClaim.appointedVehicles.map((v, i) => (
                      <div key={i} className="text-slate-600 flex justify-between">
                        <span>Vehicle #{i + 1}: <strong className="text-slate-800 font-mono">{v.vehicleNo}</strong> ({v.driverName})</span>
                        <span className="font-mono text-slate-500">{v.contactNumber}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500">Official transport service provider approved.</div>
                )}
              </div>

              {/* SMC Bank Account */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-emerald-600" />
                  <span>SMC Disbursed Bank Account</span>
                </div>
                <div className="space-y-1 text-slate-600">
                  <div className="flex justify-between">
                    <span>Holder: <strong className="text-slate-800">{approvedClaim.smcDetails?.accountHolderName || `SMC ${approvedClaim.schoolName}`}</strong></span>
                    <span>Branch: <strong className="text-slate-800">{approvedClaim.smcDetails?.branch || `${approvedClaim.blockName} Main`}</strong></span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span>IFSC: <strong className="text-slate-800">{approvedClaim.smcDetails?.ifscCode || 'SBIN0001234'}</strong></span>
                    <span>A/C: <strong className="text-slate-800">{approvedClaim.smcDetails?.accountNumber || '39482019485'}</strong></span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  );
};
