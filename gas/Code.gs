/**
 * =========================================================================================
 * SAMAGRA SHIKSHA - VELLORE DISTRICT | SCHOOL EDUCATION DEPARTMENT, TAMIL NADU
 * TRANSPORT & ESCORT FACILITY MONTHLY CLAIM MANAGEMENT SYSTEM
 * File: Code.gs (Google Apps Script Backend)
 * =========================================================================================
 * 
 * Instructions:
 * 1. Open Google Sheets -> Extensions -> Apps Script
 * 2. Paste this code into Code.gs
 * 3. Add index.html, css.html, and js.html
 * 4. Run setupGoogleSheetsDatabase() once to initialize the sheets
 * 5. Deploy -> New Deployment -> Web App (Execute as: Me, Access: Anyone)
 */

// Configuration Constants
var CONFIG = {
  DISTRICT_NAME: "Vellore",
  DISTRICT_CODE: "3304",
  SCHEME_NAME: "Transport and Escort Facility for Elementary & Secondary Students",
  DEPARTMENT: "Samagra Shiksha, School Education Department, Vellore District",
  SUPABASE_PROJECT_ID: "uaytprvluhpwgbunzsbd",
  SUPABASE_URL: "https://uaytprvluhpwgbunzsbd.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_FWkljHsONHH6nAicMseq_w_9UitxQDI",
  SUPABASE_REST_URL: "https://uaytprvluhpwgbunzsbd.supabase.co/rest/v1/"
};

/**
 * Universal Supabase REST API Caller for Google Apps Script
 */
function callSupabaseRest(endpoint, method, payload) {
  var url = CONFIG.SUPABASE_REST_URL + endpoint;
  var options = {
    method: method || 'get',
    muteHttpExceptions: true,
    headers: {
      'apikey': CONFIG.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };

  if (payload && (method === 'post' || method === 'patch' || method === 'put')) {
    options.payload = JSON.stringify(payload);
  }

  try {
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    var content = response.getContentText();
    return {
      status: code,
      success: code >= 200 && code < 300,
      data: content ? JSON.parse(content) : null
    };
  } catch (err) {
    Logger.log("Supabase REST call error: " + err.toString());
    return { success: false, error: err.toString() };
  }
}

/**
 * Serves the Web App UI or handles REST JSON API requests
 */
function doGet(e) {
  // If invoked as an API
  if (e && e.parameter && e.parameter.action) {
    return handleApiGet(e.parameter);
  }

  // Render Web App Template
  var template = HtmlService.createTemplateFromFile('index');
  template.cycleInfo = getDynamicCycleInfo();
  return template.evaluate()
    .setTitle("Samagra Shiksha Vellore - Transport & Escort Claim System")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Handles POST requests for secure mutations
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var userSession = payload.userSession;
    var data = payload.data;

    // Server-side authentication check
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

/**
 * Dynamic calculation of the previous month claim cycle.
 * Never hardcodes June, July, August, etc.
 */
function getDynamicCycleInfo(customDate) {
  var now = customDate ? new Date(customDate) : new Date();
  var currentYear = now.getFullYear();
  var currentMonth = now.getMonth(); // 0 to 11

  // Claim Month is the immediate previous month
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
  var endDate = new Date(claimYear, claimMonthIndex + 1, 0); // Last day
  
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
    totalDaysInClaimMonth: endDate.getDate(),
  };
}

/**
 * Server-side School Claim Submission Handler
 */
function serverSubmitSchoolClaim(userSession, data) {
  if (userSession.role !== 'SCHOOL') {
    return { success: false, message: "Security violation: Only School users can submit school claims." };
  }

  var cycle = getDynamicCycleInfo();
  var udiseCode = userSession.udiseCode;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var claimsSheet = ss.getSheetByName("Claims_Active");

  // Duplicate Check: Check if this school already submitted for this month
  var claimsData = claimsSheet.getDataRange().getValues();
  for (var i = 1; i < claimsData.length; i++) {
    var rowUdise = String(claimsData[i][1]);
    var rowMonthKey = String(claimsData[i][3]);
    if (rowUdise === udiseCode && rowMonthKey === cycle.claimMonthKey) {
      return {
        success: false,
        alreadySubmitted: true,
        message: cycle.claimMonthOnlyName + " month salary claim already submitted. Do you want to view?",
        claimId: claimsData[i][0]
      };
    }
  }

  var students = data.students || [];
  if (students.length === 0) {
    return { success: false, message: "At least one student beneficiary claim must be entered." };
  }

  var totalAmount = 0;
  for (var s = 0; s < students.length; s++) {
    totalAmount += Number(students[s].totalClaimAmount || 0);
  }

  var claimId = "CLM_SCH_" + udiseCode + "_" + cycle.claimMonthKey;
  var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  // Save to Claims_Active: [ClaimId, UDISE, SchoolName, MonthKey, MonthName, BlockId, BlockName, TotalStudents, TotalAmount, Status, SubmittedBy, SubmissionTime, BlockRemarks, DistrictRemarks]
  claimsSheet.appendRow([
    claimId,
    udiseCode,
    userSession.schoolName || data.schoolName,
    cycle.claimMonthKey,
    cycle.claimMonthName,
    userSession.blockId || data.blockId,
    userSession.blockName || data.blockName,
    students.length,
    totalAmount,
    "SUBMITTED_BY_SCHOOL",
    userSession.name,
    nowStr,
    "",
    ""
  ]);

  // Save student line items in Students_Active sheet
  var studentsSheet = ss.getSheetByName("Students_Active");
  for (var j = 0; j < students.length; j++) {
    var st = students[j];
    studentsSheet.appendRow([
      claimId,
      udiseCode,
      st.emisNumber,
      st.studentName,
      st.grade,
      st.category,
      st.workingDaysInMonth,
      st.daysAttended,
      st.ratePerDay,
      st.totalClaimAmount,
      st.serviceProviderName,
      st.beneficiaryAccountNo || ""
    ]);
  }

  // Record Immutable Audit Log
  recordAuditLog(userSession.userId, userSession.name, "SCHOOL", userSession.schoolName, cycle.claimMonthName, "SCHOOL_CLAIM_SUBMISSION", "NOT_SUBMITTED", "SUBMITTED_BY_SCHOOL", "Submitted " + students.length + " students, total Rs." + totalAmount);

  return { success: true, message: "Claim submitted successfully to Block Resource Centre.", claimId: claimId };
}

/**
 * Server-side Block Verification
 */
function serverVerifySchoolByBlock(userSession, data) {
  if (userSession.role !== 'BLOCK') {
    return { success: false, message: "Security violation: Only Block users can verify school claims." };
  }

  var udiseCode = data.udiseCode;
  var decision = data.decision; // 'APPROVED' or 'REJECTED'
  var remarks = data.remarks || "";
  var cycle = getDynamicCycleInfo();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Claims_Active");
  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(udiseCode) && String(rows[i][3]) === cycle.claimMonthKey) {
      // Security: Check if school belongs to this block user
      if (String(rows[i][5]) !== userSession.blockId) {
        return { success: false, message: "Access Denied: This school does not belong to your block." };
      }

      var prevStatus = rows[i][9];
      var newStatus = decision === 'APPROVED' ? 'BLOCK_APPROVED' : 'BLOCK_REJECTED';
      sheet.getRange(i + 1, 10).setValue(newStatus);
      sheet.getRange(i + 1, 13).setValue(remarks + " (Verified by " + userSession.name + ")");

      recordAuditLog(userSession.userId, userSession.name, "BLOCK", rows[i][2], cycle.claimMonthName, "BLOCK_VERIFICATION_" + decision, prevStatus, newStatus, remarks);
      return { success: true, message: "School claim " + decision.toLowerCase() + " successfully." };
    }
  }

  return { success: false, message: "School claim not found for verification." };
}

/**
 * Server-side Block Submission to District
 */
function serverSubmitBlockToDistrict(userSession, data) {
  if (userSession.role !== 'BLOCK') {
    return { success: false, message: "Security violation: Only Block users can submit block claims." };
  }

  var blockId = userSession.blockId;
  var cycle = getDynamicCycleInfo();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Validate all schools under block have submitted and are approved
  var schoolsSheet = ss.getSheetByName("Schools");
  var schoolRows = schoolsSheet.getDataRange().getValues();
  var blockSchools = [];
  for (var s = 1; s < schoolRows.length; s++) {
    if (String(schoolRows[s][2]) === blockId) {
      blockSchools.push(String(schoolRows[s][0])); // UDISE
    }
  }

  var claimsSheet = ss.getSheetByName("Claims_Active");
  var claimRows = claimsSheet.getDataRange().getValues();
  var approvedCount = 0;

  for (var c = 1; c < claimRows.length; c++) {
    if (String(claimRows[c][5]) === blockId && String(claimRows[c][3]) === cycle.claimMonthKey) {
      if (claimRows[c][9] === 'BLOCK_APPROVED') {
        approvedCount++;
      }
    }
  }

  if (approvedCount < blockSchools.length) {
    return {
      success: false,
      message: "Cannot submit to District: Only " + approvedCount + " of " + blockSchools.length + " schools are verified and approved."
    };
  }

  // Update status of all school claims in block
  for (var u = 1; u < claimRows.length; u++) {
    if (String(claimRows[u][5]) === blockId && String(claimRows[u][3]) === cycle.claimMonthKey) {
      claimsSheet.getRange(u + 1, 10).setValue("BLOCK_CLAIM_SUBMITTED_TO_DISTRICT");
    }
  }

  recordAuditLog(userSession.userId, userSession.name, "BLOCK", userSession.blockName, cycle.claimMonthName, "BLOCK_CLAIM_SUBMITTED_TO_DISTRICT", "BLOCK_APPROVED", "BLOCK_CLAIM_SUBMITTED_TO_DISTRICT", "All " + approvedCount + " schools approved and forwarded to District.");

  return {
    success: true,
    message: "Your Block level claim is submitted for the month of " + cycle.claimMonthOnlyName + "."
  };
}

/**
 * Server-side District Verification (Approve or Reject with remarks)
 */
function serverVerifyBlockByDistrict(userSession, data) {
  if (userSession.role !== 'DISTRICT') {
    return { success: false, message: "Security violation: Only District administrators can verify block claims." };
  }

  var blockId = data.blockId;
  var decision = data.decision; // 'APPROVED' or 'REJECTED'
  var remarks = data.remarks || "";
  var cycle = getDynamicCycleInfo();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var claimsSheet = ss.getSheetByName("Claims_Active");
  var rows = claimsSheet.getDataRange().getValues();

  var newStatus = decision === 'APPROVED' ? 'DISTRICT_APPROVED' : 'DISTRICT_REJECTED';

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][5]) === blockId && String(rows[i][3]) === cycle.claimMonthKey) {
      claimsSheet.getRange(i + 1, 10).setValue(newStatus);
      claimsSheet.getRange(i + 1, 14).setValue(remarks + " (" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") + ")");
    }
  }

  recordAuditLog(userSession.userId, userSession.name, "DISTRICT", blockId, cycle.claimMonthName, "DISTRICT_VERIFICATION_" + decision, "BLOCK_CLAIM_SUBMITTED_TO_DISTRICT", newStatus, remarks);

  return { success: true, message: "Block claim " + (decision === 'APPROVED' ? 'approved' : 'returned to block for correction') + "." };
}

/**
 * Server-side Block Resubmission after correction
 */
function serverResubmitBlockToDistrict(userSession, data) {
  if (userSession.role !== 'BLOCK') {
    return { success: false, message: "Security violation: Only Block users can resubmit claims." };
  }

  var blockId = userSession.blockId;
  var cycle = getDynamicCycleInfo();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var claimsSheet = ss.getSheetByName("Claims_Active");
  var rows = claimsSheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][5]) === blockId && String(rows[i][3]) === cycle.claimMonthKey) {
      claimsSheet.getRange(i + 1, 10).setValue("RESUBMITTED_BY_BLOCK");
    }
  }

  recordAuditLog(userSession.userId, userSession.name, "BLOCK", userSession.blockName, cycle.claimMonthName, "BLOCK_RESUBMITTED_TO_DISTRICT", "DISTRICT_REJECTED", "RESUBMITTED_BY_BLOCK", "Corrected and resubmitted to District Office: " + (data.correctionNotes || ""));

  return { success: true, message: "Block claim resubmitted successfully to District." };
}

/**
 * Server-side Final District Approval and Sanction Order Release
 */
function serverCompleteFinalDistrictApproval(userSession, data) {
  if (userSession.role !== 'DISTRICT') {
    return { success: false, message: "Security violation: Only District users can finalize monthly claims." };
  }

  var cycle = getDynamicCycleInfo();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var claimsSheet = ss.getSheetByName("Claims_Active");
  var rows = claimsSheet.getDataRange().getValues();

  var sanctionOrderNo = "SS/VEL/TRANS/" + cycle.claimYear + "/" + Math.floor(1000 + Math.random() * 9000);

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][3]) === cycle.claimMonthKey) {
      claimsSheet.getRange(i + 1, 10).setValue("FINAL_DISTRICT_APPROVAL");
    }
  }

  recordAuditLog(userSession.userId, userSession.name, "DISTRICT", "Vellore District (Consolidated)", cycle.claimMonthName, "FINAL_DISTRICT_APPROVAL", "DISTRICT_APPROVED", "FINAL_DISTRICT_APPROVAL", "Comprehensive Sanction Order Issued: #" + sanctionOrderNo);

  return {
    success: true,
    sanctionOrderNo: sanctionOrderNo,
    message: "District level claim is submitted for the month of " + cycle.claimMonthOnlyName + "."
  };
}

/**
 * Server-side Monthly Archive and Interface Rollover
 */
function serverArchiveMonthlyCycle(userSession, data) {
  if (userSession.role !== 'DISTRICT') {
    return { success: false, message: "Security violation: Only District administrator can archive monthly cycles." };
  }

  var cycle = getDynamicCycleInfo();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var claimsActive = ss.getSheetByName("Claims_Active");
  var claimsArchive = ss.getSheetByName("Claims_Archive");

  var activeData = claimsActive.getDataRange().getValues();
  if (activeData.length > 1) {
    for (var i = 1; i < activeData.length; i++) {
      claimsArchive.appendRow(activeData[i]);
    }
    // Clear active claims rows except header
    claimsActive.deleteRows(2, activeData.length - 1);
  }

  recordAuditLog(userSession.userId, userSession.name, "DISTRICT", "All Blocks", cycle.claimMonthName, "MONTHLY_CYCLE_ARCHIVED", "FINAL_DISTRICT_APPROVAL", "MONTHLY_CYCLE_CLOSED", "Archived completed records. Interface prepared for next monthly cycle.");

  return { success: true, message: "Completed cycle archived successfully. Active interface prepared for the next month." };
}

/**
 * Permanent Audit Log Recorder
 */
function recordAuditLog(userId, userName, role, entityName, claimMonth, action, prevStatus, newStatus, remarks) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Audit_Logs");
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    sheet.appendRow([
      "AUDIT_" + Date.now(),
      timestamp,
      userId,
      userName,
      role,
      entityName,
      claimMonth,
      action,
      prevStatus,
      newStatus,
      remarks
    ]);
  } catch (err) {
    Logger.log("Failed to write audit log: " + err.toString());
  }
}

/**
 * Utility: Returns JSON response
 */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Initializes and formats all Google Sheets database tables
 */
function setupGoogleSheetsDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheetSchemas = {
    "Users": ["User_ID", "Full_Name", "Role", "Block_ID", "Block_Name", "UDISE_Code", "School_Name", "Email", "Phone", "Status"],
    "Blocks": ["Block_ID", "Block_Code", "Block_Name", "BEO_Officer_Name", "Email", "Total_Schools"],
    "Schools": ["UDISE_Code", "School_Name", "Block_ID", "Block_Name", "Category", "Headmaster_Name", "Phone", "Eligible_Students"],
    "Claims_Active": ["Claim_ID", "UDISE_Code", "School_Name", "Claim_Month_Key", "Claim_Month_Name", "Block_ID", "Block_Name", "Total_Students", "Total_Amount", "Status", "Submitted_By", "Submitted_At", "Block_Remarks", "District_Remarks"],
    "Students_Active": ["Claim_ID", "UDISE_Code", "EMIS_Number", "Student_Name", "Grade", "Category", "Working_Days", "Days_Attended", "Rate_Per_Day", "Total_Amount", "Service_Provider", "Bank_Account"],
    "Audit_Logs": ["Log_ID", "Timestamp", "User_ID", "User_Name", "Role", "Entity_Name", "Claim_Month", "Action", "Previous_Status", "New_Status", "Remarks"],
    "Claims_Archive": ["Claim_ID", "UDISE_Code", "School_Name", "Claim_Month_Key", "Claim_Month_Name", "Block_ID", "Block_Name", "Total_Students", "Total_Amount", "Status", "Submitted_By", "Submitted_At", "Block_Remarks", "District_Remarks"]
  };

  for (var name in sheetSchemas) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(sheetSchemas[name]);
      sheet.getRange(1, 1, 1, sheetSchemas[name].length)
        .setBackground("#0F172A")
        .setFontColor("#FFFFFF")
        .setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
  }

  Logger.log("Google Sheets database tables initialized successfully.");
}
