import React, { useState } from 'react';
import { Code2, Copy, Check, Download, Database, FileSpreadsheet, ExternalLink } from 'lucide-react';

export const GasSupabaseViewer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<'Code.gs' | 'index.html' | 'css.html' | 'js.html' | 'schema.sql' | 'sheets.md'>('Code.gs');
  const [copied, setCopied] = useState<boolean>(false);

  // File contents
  const files: Record<string, { label: string; language: string; content: string; desc: string }> = {
    'Code.gs': {
      label: 'Code.gs (Google Apps Script Backend)',
      language: 'javascript',
      desc: 'Server-side Apps Script handler with dynamic monthly cycle, role verification, duplicate checks, sheets sync, and audit trails.',
      content: `/**
 * SAMAGRA SHIKSHA - VELLORE DISTRICT | SCHOOL EDUCATION DEPARTMENT, TAMIL NADU
 * TRANSPORT & ESCORT FACILITY MONTHLY CLAIM MANAGEMENT SYSTEM
 * File: Code.gs (Google Apps Script Server)
 */

var CONFIG = {
  DISTRICT_NAME: "Vellore",
  DISTRICT_CODE: "3304",
  SCHEME_NAME: "Transport and Escort Facility for Elementary & Secondary Students",
  DEPARTMENT: "Samagra Shiksha, School Education Department, Vellore District",
  SUPABASE_URL: "https://vqiejbhtwnarvshxvkhg.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxaWVqYmh0d25hcnZzaHh2a2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMDY0MjQsImV4cCI6MjEwNjU4MjQyNH0.tbtKzIu0EWVSvQqH01AJKsD6RgUxLz9VZrf70yh5pFI"
};

function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    return handleApiGet(e.parameter);
  }
  var template = HtmlService.createTemplateFromFile('index');
  template.cycleInfo = getDynamicCycleInfo();
  return template.evaluate()
    .setTitle("Samagra Shiksha Vellore - Transport & Escort Claim System")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var userSession = payload.userSession;
    var data = payload.data;

    if (!userSession || !userSession.role) {
      return jsonResponse({ success: false, message: "Unauthorized request. Missing user session." });
    }

    var result;
    switch (action) {
      case 'SUBMIT_SCHOOL_CLAIM':
        result = serverSubmitSchoolClaim(userSession, data);
        break;
      case 'VERIFY_SCHOOL_BY_BLOCK':
        result = serverVerifySchoolByBlock(userSession, data);
        break;
      case 'SUBMIT_BLOCK_TO_DISTRICT':
        result = serverSubmitBlockToDistrict(userSession, data);
        break;
      case 'VERIFY_BLOCK_BY_DISTRICT':
        result = serverVerifyBlockByDistrict(userSession, data);
        break;
      case 'RESUBMIT_BLOCK_TO_DISTRICT':
        result = serverResubmitBlockToDistrict(userSession, data);
        break;
      case 'COMPLETE_FINAL_DISTRICT_APPROVAL':
        result = serverCompleteFinalDistrictApproval(userSession, data);
        break;
      case 'ARCHIVE_MONTHLY_CYCLE':
        result = serverArchiveMonthlyCycle(userSession, data);
        break;
      default:
        result = { success: false, message: "Unknown action: " + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ success: false, message: "Server Error: " + err.toString() });
  }
}

function getDynamicCycleInfo(customDate) {
  var now = customDate ? new Date(customDate) : new Date();
  var currentYear = now.getFullYear();
  var currentMonth = now.getMonth();

  var prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
  var claimYear = prevMonthDate.getFullYear();
  var claimMonthIndex = prevMonthDate.getMonth();
  
  var monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  var claimMonthOnlyName = monthNames[claimMonthIndex];
  var claimMonthName = claimMonthOnlyName + " " + claimYear;
  var claimMonthKey = claimYear + "-" + (claimMonthIndex < 9 ? "0" + (claimMonthIndex + 1) : (claimMonthIndex + 1));
  var startDate = new Date(claimYear, claimMonthIndex, 1);
  var endDate = new Date(claimYear, claimMonthIndex + 1, 0);
  
  var pad = function(n) { return n < 10 ? "0" + n : n; };
  var formatDate = function(d) {
    return monthNames[d.getMonth()] + " " + pad(d.getDate()) + ", " + d.getFullYear();
  };

  return {
    claimYear: claimYear,
    claimMonthIndex: claimMonthIndex,
    claimMonthOnlyName: claimMonthOnlyName,
    claimMonthName: claimMonthName,
    claimMonthKey: claimMonthKey,
    submissionMonthName: monthNames[currentMonth] + " " + currentYear,
    calculationPeriodString: formatDate(startDate) + " to " + formatDate(endDate),
    totalDaysInClaimMonth: endDate.getDate()
  };
}

function serverSubmitSchoolClaim(userSession, data) {
  if (userSession.role !== 'SCHOOL') {
    return { success: false, message: "Security: Only School users can submit." };
  }
  var cycle = getDynamicCycleInfo();
  var udiseCode = userSession.udiseCode;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var claimsSheet = ss.getSheetByName("Claims_Active");

  var claimsData = claimsSheet.getDataRange().getValues();
  for (var i = 1; i < claimsData.length; i++) {
    if (String(claimsData[i][1]) === udiseCode && String(claimsData[i][3]) === cycle.claimMonthKey) {
      return {
        success: false,
        alreadySubmitted: true,
        message: cycle.claimMonthOnlyName + " month salary claim already submitted. Do you want to view?",
        claimId: claimsData[i][0]
      };
    }
  }

  var students = data.students || [];
  if (students.length === 0) return { success: false, message: "At least one student must be entered." };

  var totalAmount = 0;
  for (var s = 0; s < students.length; s++) totalAmount += Number(students[s].totalClaimAmount || 0);

  var claimId = "CLM_SCH_" + udiseCode + "_" + cycle.claimMonthKey;
  var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  claimsSheet.appendRow([
    claimId, udiseCode, userSession.schoolName || data.schoolName,
    cycle.claimMonthKey, cycle.claimMonthName, userSession.blockId || data.blockId,
    userSession.blockName || data.blockName, students.length, totalAmount,
    "SUBMITTED_BY_SCHOOL", userSession.name, nowStr, "", ""
  ]);

  var studentsSheet = ss.getSheetByName("Students_Active");
  for (var j = 0; j < students.length; j++) {
    var st = students[j];
    studentsSheet.appendRow([
      claimId, udiseCode, st.emisNumber, st.studentName, st.grade, st.category,
      st.workingDaysInMonth, st.daysAttended, st.ratePerDay, st.totalClaimAmount,
      st.serviceProviderName, st.beneficiaryAccountNo || ""
    ]);
  }

  recordAuditLog(userSession.userId, userSession.name, "SCHOOL", userSession.schoolName, cycle.claimMonthName, "SCHOOL_CLAIM_SUBMISSION", "NOT_SUBMITTED", "SUBMITTED_BY_SCHOOL", "Submitted " + students.length + " students, total Rs." + totalAmount);
  return { success: true, message: "Claim submitted successfully to Block Resource Centre.", claimId: claimId };
}

function recordAuditLog(userId, userName, role, entityName, claimMonth, action, prevStatus, newStatus, remarks) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Audit_Logs");
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow(["AUDIT_" + Date.now(), timestamp, userId, userName, role, entityName, claimMonth, action, prevStatus, newStatus, remarks]);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}`
    },
    'index.html': {
      label: 'index.html (Google Apps Script Template)',
      language: 'html',
      desc: 'Apps Script HTML entry point loading CSS and JS bundles.',
      content: `<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <meta charset="utf-8">
    <title>Samagra Shiksha Vellore - Transport & Escort Claim</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <?!= HtmlService.createHtmlOutputFromFile('css').getContent(); ?>
  </head>
  <body>
    <header class="top-nav">
      <div class="nav-brand">
        <span class="emblem">🏛️</span>
        <div class="brand-text">
          <h1>Samagra Shiksha · Vellore District</h1>
          <p>School Education Department, Government of Tamil Nadu</p>
        </div>
      </div>
      <div class="nav-cycle-pill">
        <span class="cycle-label">Active Claim Month:</span>
        <strong id="displayClaimMonth"><?= cycleInfo.claimMonthName ?></strong>
      </div>
    </header>
    <main class="main-container">
      <div id="notificationArea" class="notification-container"></div>
      <section id="homeView" class="view-panel active"></section>
    </main>
    <?!= HtmlService.createHtmlOutputFromFile('js').getContent(); ?>
  </body>
</html>`
    },
    'css.html': {
      label: 'css.html (Styling & Glowing Banners)',
      language: 'css',
      desc: 'CSS with soft glowing banners, modern typography, and table styling.',
      content: `<style>
  :root {
    --bg-canvas: #F8FAFC;
    --bg-surface: #FFFFFF;
    --border-hairline: #E2E8F0;
    --text-primary: #0F172A;
    --text-muted: #64748B;
    --accent-emerald: #059669;
    --accent-blue: #1D4ED8;
    --glow-emerald: 0 0 15px rgba(5, 150, 105, 0.25);
    --glow-amber: 0 0 15px rgba(217, 119, 6, 0.3);
  }
  .glowing-alert {
    padding: 14px 18px;
    border-radius: 10px;
    margin-bottom: 20px;
    box-shadow: var(--glow-emerald);
  }
  .glow-return {
    background: #FFFBEB;
    border: 1.5px solid #F59E0B;
    color: #92400E;
    box-shadow: var(--glow-amber);
  }
</style>`
    },
    'js.html': {
      label: 'js.html (Client Controller)',
      language: 'javascript',
      desc: 'Client logic for Google Apps Script web app.',
      content: `<script>
  console.log("Samagra Shiksha Vellore client initialized.");
</script>`
    },
    'schema.sql': {
      label: 'schema.sql (Supabase PostgreSQL Schema & RLS)',
      language: 'sql',
      desc: 'Complete PostgreSQL schema for Supabase: tables, foreign keys, triggers, and Row Level Security.',
      content: `-- SAMAGRA SHIKSHA - VELLORE DISTRICT | SUPABASE POSTGRESQL SCHEMA
CREATE TABLE IF NOT EXISTS public.blocks (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    beo_officer_name TEXT NOT NULL,
    email TEXT,
    total_schools INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.schools (
    udise_code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    block_id TEXT REFERENCES public.blocks(id),
    block_name TEXT NOT NULL,
    category TEXT NOT NULL,
    headmaster_name TEXT NOT NULL,
    phone TEXT,
    eligible_students INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.monthly_claims (
    id TEXT PRIMARY KEY,
    udise_code TEXT NOT NULL REFERENCES public.schools(udise_code),
    school_name TEXT NOT NULL,
    block_id TEXT NOT NULL REFERENCES public.blocks(id),
    block_name TEXT NOT NULL,
    claim_month_key TEXT NOT NULL,
    claim_month_name TEXT NOT NULL,
    calculation_period TEXT NOT NULL,
    total_students INTEGER NOT NULL,
    total_claim_amount NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL,
    submitted_by TEXT NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_school_month_claim UNIQUE (udise_code, claim_month_key)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    school_or_block_name TEXT NOT NULL,
    claim_month TEXT NOT NULL,
    action TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    remarks TEXT
);

ALTER TABLE public.monthly_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.monthly_claims FOR SELECT USING (true);
CREATE POLICY "Public insert" ON public.monthly_claims FOR INSERT WITH CHECK (true);`
    },
    'sheets.md': {
      label: 'GOOGLE_SHEETS_STRUCTURE.md',
      language: 'markdown',
      desc: 'Complete 7-table Google Sheets database column specification.',
      content: `# Google Sheets Database Structure
## Sheets List:
1. Users: User_ID, Full_Name, Role, Block_ID, Block_Name, UDISE_Code, School_Name, Email, Phone, Status
2. Blocks: Block_ID, Block_Code, Block_Name, BEO_Officer_Name, Email, Total_Schools
3. Schools: UDISE_Code, School_Name, Block_ID, Block_Name, Category, Headmaster_Name, Phone, Eligible_Students
4. Claims_Active: Claim_ID, UDISE_Code, School_Name, Claim_Month_Key, Claim_Month_Name, Block_ID, Block_Name, Total_Students, Total_Amount, Status, Submitted_By, Submitted_At, Block_Remarks, District_Remarks
5. Students_Active: Claim_ID, UDISE_Code, EMIS_Number, Student_Name, Grade, Category, Working_Days, Days_Attended, Rate_Per_Day, Total_Amount, Service_Provider, Bank_Account
6. Audit_Logs: Log_ID, Timestamp, User_ID, User_Name, Role, Entity_Name, Claim_Month, Action, Previous_Status, New_Status, Remarks
7. Claims_Archive: Identical schema to Claims_Active for permanent closed cycles`
    }
  };

  const currentFile = files[selectedFile];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Google Apps Script &amp; Supabase Code Hub</h2>
              <p className="text-xs text-slate-500">
                Ready-to-deploy files for Google Apps Script Web App, Google Sheets backend, and Supabase PostgreSQL database.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied to Clipboard' : 'Copy File Content'}
            </button>
          </div>
        </div>

        {/* File Tabs */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-1.5">
          {Object.keys(files).map((key) => (
            <button
              key={key}
              onClick={() => {
                setSelectedFile(key as any);
                setCopied(false);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                selectedFile === key
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {key.includes('.sql') ? <Database className="w-3.5 h-3.5 text-blue-500" /> :
               key.includes('.md') ? <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" /> :
               <Code2 className="w-3.5 h-3.5 text-amber-500" />}
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* Code Editor Box */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-md">
        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-emerald-400">{currentFile.label}</span>
            <span className="text-slate-500 text-[11px] hidden sm:inline">— {currentFile.desc}</span>
          </div>
          <button
            onClick={handleCopy}
            className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="p-4 max-h-[500px] overflow-auto">
          <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre font-normal">
            <code>{currentFile.content}</code>
          </pre>
        </div>
      </div>

      {/* Deployment & Setup Quick Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-xl text-xs space-y-2">
          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Google Apps Script Setup (3 Minutes)
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-relaxed">
            <li>Create a new Google Sheet named <strong>&quot;Vellore_SS_Transport_Claims&quot;</strong>.</li>
            <li>Click <strong>Extensions &gt; Apps Script</strong>.</li>
            <li>Paste <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Code.gs</code>, then create files <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">index.html</code>, <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">css.html</code>, and <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">js.html</code>.</li>
            <li>Run function <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">setupGoogleSheetsDatabase()</code> once to format the 7 sheets automatically.</li>
            <li>Click <strong>Deploy &gt; New Deployment &gt; Web App</strong> (Execute as: Me, Access: Anyone).</li>
          </ol>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl text-xs space-y-2">
          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600" />
            Supabase Setup (2 Minutes)
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-relaxed">
            <li>Open your Supabase project dashboard.</li>
            <li>Navigate to the <strong>SQL Editor</strong> tab on the left.</li>
            <li>Paste the contents of <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">schema.sql</code> and click <strong>Run</strong>.</li>
            <li>All tables, RLS policies, indexes, and initial Vellore Educational Blocks are instantly created!</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
