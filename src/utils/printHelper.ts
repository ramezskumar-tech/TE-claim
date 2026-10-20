import jsPDF from 'jspdf';
import { StudentClaimItem, SchoolClaimRecord } from '../types/claim';
import { supabase } from '../services/supabaseClient';

/**
 * Universal print handler that works reliably in iframes, Chrome, Safari, Edge, and mobile.
 * Uses an isolated, clean print iframe and falls back gracefully to window.print() or PDF download.
 */
export function printHtmlDocument(title: string, bodyHtml: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // 1. Check or create print iframe
      let iframe = document.getElementById('app-print-iframe') as HTMLIFrameElement | null;
      if (iframe) {
        iframe.remove();
      }

      iframe = document.createElement('iframe');
      iframe.id = 'app-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!frameDoc || !iframe.contentWindow) {
        window.print();
        resolve(true);
        return;
      }

      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 15mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #111827;
              background: #ffffff;
              margin: 0;
              padding: 0;
              font-size: 11px;
              line-height: 1.35;
            }
            .print-container {
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
            }
            .header-banner {
              text-align: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .gov-title {
              font-size: 14px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #0f172a;
              margin: 0 0 2px 0;
            }
            .dept-title {
              font-size: 12px;
              font-weight: 600;
              color: #334155;
              margin: 0 0 4px 0;
            }
            .doc-title {
              font-size: 13px;
              font-weight: 700;
              color: #047857;
              margin: 0;
              text-transform: uppercase;
            }
            .meta-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
              background-color: #f8fafc;
              border: 1px solid #cbd5e1;
            }
            .meta-table td {
              padding: 5px 8px;
              font-size: 11px;
              border: 1px solid #cbd5e1;
            }
            .meta-label {
              font-weight: 700;
              color: #475569;
              width: 25%;
            }
            .meta-val {
              font-weight: 600;
              color: #0f172a;
              width: 25%;
            }
            .claim-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
              margin-bottom: 12px;
              font-size: 10.5px;
            }
            .claim-table th, .claim-table td {
              border: 1px solid #94a3b8;
              padding: 5px 6px;
            }
            .claim-table th {
              background-color: #f1f5f9;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 9.5px;
              color: #1e293b;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
            .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
            .tfoot-total {
              background-color: #f8fafc;
              font-weight: 700;
            }
            .declaration-box {
              border: 1px solid #cbd5e1;
              background-color: #f8fafc;
              padding: 8px 12px;
              margin-top: 14px;
              border-radius: 4px;
              font-size: 10px;
              color: #334155;
              line-height: 1.4;
            }
            .signatures-row {
              display: flex;
              justify-content: space-between;
              margin-top: 36px;
              padding-top: 10px;
            }
            .signature-block {
              text-align: center;
              width: 200px;
              border-top: 1px dashed #64748b;
              padding-top: 4px;
              font-size: 10px;
              color: #334155;
              font-weight: 600;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${bodyHtml}
          </div>
        </body>
        </html>
      `;

      frameDoc.open();
      frameDoc.write(fullHtml);
      frameDoc.close();

      setTimeout(() => {
        try {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
          resolve(true);
        } catch (e) {
          console.warn('Iframe print failed, falling back to window.print():', e);
          window.print();
          resolve(true);
        }
      }, 300);
    } catch (err) {
      console.error('Error invoking print:', err);
      try {
        window.print();
      } catch (inner) {
        console.error('Fallback print error:', inner);
      }
      resolve(false);
    }
  });
}

/**
 * Generate and trigger print for the Student-Wise Claim Format
 */
export function printStudentWiseClaimSheet(params: {
  schoolName: string;
  udiseCode: string;
  blockName: string;
  monthName: string;
  totalWorkingDays: number;
  students: StudentClaimItem[];
  hmName?: string;
}) {
  const { schoolName, udiseCode, blockName, monthName, totalWorkingDays, students, hmName } = params;

  // Calculation policy: >=75% = 600 INR; <75% = round((600 / totalWorkingDays) * daysAttended)
  const calcAmount = (days: number) => {
    if (days <= 0 || totalWorkingDays <= 0) return 0;
    const pct = (days / totalWorkingDays) * 100;
    if (pct >= 75) return 600;
    return Math.round((600 / totalWorkingDays) * days);
  };

  const claimedStudents = students.filter(s => s.daysAttended > 0);
  const totalDays = students.reduce((sum, s) => sum + s.daysAttended, 0);
  const totalAmount = students.reduce((sum, s) => sum + calcAmount(s.daysAttended), 0);

  const tableRows = students.map((st, i) => {
    const amt = calcAmount(st.daysAttended);
    const pct = totalWorkingDays > 0 ? Math.round((st.daysAttended / totalWorkingDays) * 100) : 0;
    return `
      <tr>
        <td class="text-center font-mono font-bold">${i + 1}</td>
        <td class="font-mono">${st.emisNumber}</td>
        <td class="font-bold">${st.studentName}</td>
        <td>${st.grade}</td>
        <td>${st.category}</td>
        <td class="text-center font-mono font-bold">${st.daysAttended} / ${totalWorkingDays} (${pct}%)</td>
        <td class="text-right font-mono font-bold">₹${amt.toLocaleString('en-IN')}</td>
      </tr>
    `;
  }).join('');

  const bodyHtml = `
    <div class="header-banner">
      <div class="gov-title">Government of Tamil Nadu · Department of School Education</div>
      <div class="dept-title">Samagra Shiksha · Transport & Escort Beneficiary Claim Scheme</div>
      <div class="doc-title">Student-Wise Monthly Claim Audit Format · ${monthName}</div>
    </div>

    <table class="meta-table">
      <tr>
        <td class="meta-label">School Name:</td>
        <td class="meta-val">${schoolName}</td>
        <td class="meta-label">UDISE Code:</td>
        <td class="meta-val font-mono">${udiseCode}</td>
      </tr>
      <tr>
        <td class="meta-label">Block Name:</td>
        <td class="meta-val">${blockName}</td>
        <td class="meta-label">School Working Days:</td>
        <td class="meta-val font-mono">${totalWorkingDays} Days</td>
      </tr>
      <tr>
        <td class="meta-label">Claim Period:</td>
        <td class="meta-val">${monthName}</td>
        <td class="meta-label">Print Timestamp:</td>
        <td class="meta-val font-mono">${new Date().toLocaleString('en-IN')}</td>
      </tr>
    </table>

    <table class="claim-table">
      <thead>
        <tr>
          <th style="width: 5%;" class="text-center">S.No</th>
          <th style="width: 17%;">EMIS Number</th>
          <th style="width: 22%;">Student Name</th>
          <th style="width: 14%;">Class & Section</th>
          <th style="width: 12%;">Facility</th>
          <th style="width: 15%;" class="text-center">Days Availed</th>
          <th style="width: 15%;" class="text-right">Claim Amount</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
      <tfoot>
        <tr class="tfoot-total">
          <td colspan="5" class="font-bold" style="padding: 7px 6px;">
            TOTAL (${claimedStudents.length} Claimed / ${students.length} Sanctioned Beneficiaries)
          </td>
          <td class="text-center font-mono font-bold">${totalDays} Days</td>
          <td class="text-right font-mono font-bold" style="font-size: 12px; color: #047857;">
            ₹${totalAmount.toLocaleString('en-IN')}
          </td>
        </tr>
      </tfoot>
    </table>

    <div class="declaration-box">
      <strong>Statutory Headmaster Certificate:</strong> I hereby certify that the student attendance days and facility availed records for the month of ${monthName} have been verified from physical school registers and vehicle/escort logs. Claim amount calculated as per Samagra Shiksha norms (₹600 for ≥75% attendance; pro-rata for &lt;75%).
    </div>

    <div class="signatures-row">
      <div class="signature-block">
        Prepared & Verified By<br/>
        <strong>Junior Assistant / Escort Teacher</strong>
      </div>
      <div class="signature-block">
        School Official Seal<br/>
        <strong>${schoolName}</strong>
      </div>
      <div class="signature-block">
        Signature of Headmaster / Principal<br/>
        <strong>${hmName || 'Headmaster'}</strong>
      </div>
    </div>
  `;

  return printHtmlDocument(`Student_Wise_Claim_${udiseCode}_${monthName}`, bodyHtml);
}

/**
 * Direct PDF Generator & Downloader for Student-Wise Claim Format using jsPDF
 * Always succeeds even if browser print is blocked!
 */
export function downloadStudentWiseClaimPdf(params: {
  schoolName: string;
  udiseCode: string;
  blockName: string;
  monthName: string;
  totalWorkingDays: number;
  students: StudentClaimItem[];
  hmName?: string;
}) {
  const { schoolName, udiseCode, blockName, monthName, totalWorkingDays, students, hmName } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 14;

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('GOVERNMENT OF TAMIL NADU - SCHOOL EDUCATION DEPARTMENT', pageWidth / 2, currentY, { align: 'center' });

  currentY += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Samagra Shiksha - Transport & Escort Monthly Claim Format', pageWidth / 2, currentY, { align: 'center' });

  currentY += 5;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87);
  doc.text(`STUDENT-WISE CLAIM FORMAT - MONTH OF ${monthName.toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' });

  currentY += 8;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(14, currentY, pageWidth - 14, currentY);

  // Meta Box
  currentY += 4;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, currentY, pageWidth - 28, 18, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);

  doc.setFont('helvetica', 'bold');
  doc.text('School Name:', 17, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(schoolName.substring(0, 38), 38, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.text('UDISE Code:', 115, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(udiseCode, 137, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.text('Block Name:', 17, currentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(blockName, 38, currentY + 10);

  doc.setFont('helvetica', 'bold');
  doc.text('Working Days:', 115, currentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${totalWorkingDays} Days`, 137, currentY + 10);

  doc.setFont('helvetica', 'bold');
  doc.text('Generated On:', 17, currentY + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('en-IN'), 38, currentY + 15);

  currentY += 24;

  // Table Headers
  const colX = [14, 23, 52, 92, 122, 147, 172, pageWidth - 14];
  doc.setFillColor(241, 245, 249);
  doc.rect(14, currentY, pageWidth - 28, 7, 'F');
  doc.setDrawColor(148, 163, 184);
  doc.line(14, currentY + 7, pageWidth - 14, currentY + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);

  doc.text('#', colX[0] + 2, currentY + 5);
  doc.text('EMIS NUMBER', colX[1] + 2, currentY + 5);
  doc.text('STUDENT NAME', colX[2] + 2, currentY + 5);
  doc.text('CLASS & SEC', colX[3] + 2, currentY + 5);
  doc.text('FACILITY', colX[4] + 2, currentY + 5);
  doc.text('AVAILED DAYS', colX[5] + 2, currentY + 5);
  doc.text('CLAIM (INR)', colX[6] + 2, currentY + 5);

  currentY += 8;

  // Table Rows
  const calcAmount = (days: number) => {
    if (days <= 0 || totalWorkingDays <= 0) return 0;
    const pct = (days / totalWorkingDays) * 100;
    if (pct >= 75) return 600;
    return Math.round((600 / totalWorkingDays) * days);
  };

  let totalAvailedDays = 0;
  let totalClaimAmount = 0;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);

  students.forEach((st, idx) => {
    // Check if new page needed
    if (currentY > 260) {
      doc.addPage();
      currentY = 15;
    }

    const amt = calcAmount(st.daysAttended);
    totalAvailedDays += st.daysAttended;
    totalClaimAmount += amt;

    const rowY = currentY;
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, rowY - 3.5, pageWidth - 28, 6, 'F');
    }

    doc.text(String(idx + 1), colX[0] + 2, rowY);
    doc.text(st.emisNumber, colX[1] + 2, rowY);
    doc.setFont('helvetica', 'bold');
    doc.text(st.studentName.substring(0, 20), colX[2] + 2, rowY);
    doc.setFont('helvetica', 'normal');
    doc.text(st.grade.substring(0, 16), colX[3] + 2, rowY);
    doc.text(st.category, colX[4] + 2, rowY);
    doc.text(`${st.daysAttended} / ${totalWorkingDays}`, colX[5] + 2, rowY);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rs. ${amt}`, colX[6] + 2, rowY);
    doc.setFont('helvetica', 'normal');

    currentY += 6;
  });

  // Total summary row
  currentY += 2;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, currentY - 4, pageWidth - 28, 8, 'F');
  doc.setDrawColor(15, 23, 42);
  doc.line(14, currentY - 4, pageWidth - 14, currentY - 4);
  doc.line(14, currentY + 4, pageWidth - 14, currentY + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`TOTAL (${students.filter(s => s.daysAttended > 0).length} Claimed / ${students.length} Beneficiaries)`, 16, currentY);
  doc.text(`${totalAvailedDays} Days`, colX[5] + 2, currentY);
  doc.setTextColor(4, 120, 87);
  doc.text(`Rs. ${totalClaimAmount.toLocaleString('en-IN')}`, colX[6] + 2, currentY);
  doc.setTextColor(15, 23, 42);

  // Declaration
  currentY += 12;
  if (currentY > 250) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Headmaster Statutory Declaration:', 14, currentY);
  currentY += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    `Certified that the student beneficiaries listed above have availed transport/escort facilities during ${monthName} as per physical registers. Claim amount verified strictly as per norms (>=75% attendance = Rs.600 flat; <75% = pro-rata).`,
    14,
    currentY,
    { maxWidth: pageWidth - 28 }
  );

  // Signatures
  currentY += 20;
  doc.setLineWidth(0.2);
  doc.setDrawColor(148, 163, 184);

  doc.line(20, currentY, 65, currentY);
  doc.line(85, currentY, 125, currentY);
  doc.line(145, currentY, 190, currentY);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('Prepared By (Teacher / Escort)', 22, currentY + 4);
  doc.text('School Seal', 98, currentY + 4);
  doc.text('Headmaster Signature', 152, currentY + 4);

  const filename = `Student_Wise_Claim_${udiseCode}_${monthName}.pdf`;
  doc.save(filename);
}

/**
 * Print Claim Receipt (for viewReadOnlyModal)
 */
export function printClaimReceiptSheet(claim: SchoolClaimRecord) {
  const tableRows = claim.students.map((st, i) => `
    <tr>
      <td class="text-center font-mono font-bold">${i + 1}</td>
      <td class="font-bold">${st.studentName}</td>
      <td class="font-mono">${st.emisNumber}</td>
      <td>${st.grade}</td>
      <td>${st.category}</td>
      <td class="text-center font-mono">${st.workingDaysInMonth}</td>
      <td class="text-center font-mono font-bold">${st.daysAttended}</td>
      <td class="text-right font-mono">₹${st.ratePerDay}</td>
      <td class="text-right font-mono font-bold">₹${st.totalClaimAmount}</td>
    </tr>
  `).join('');

  const bodyHtml = `
    <div class="header-banner">
      <div class="gov-title">Government of Tamil Nadu · School Education Department</div>
      <div class="dept-title">Samagra Shiksha · Transport & Escort Monthly Claim Official Receipt</div>
      <div class="doc-title">Submitted Claim Receipt · Ref: ${claim.id}</div>
    </div>

    <table class="meta-table">
      <tr>
        <td class="meta-label">School Name:</td>
        <td class="meta-val">${claim.schoolName}</td>
        <td class="meta-label">UDISE Code:</td>
        <td class="meta-val font-mono">${claim.udiseCode}</td>
      </tr>
      <tr>
        <td class="meta-label">Block Name:</td>
        <td class="meta-val">${claim.blockName}</td>
        <td class="meta-label">Claim Month:</td>
        <td class="meta-val">${claim.claimMonthName}</td>
      </tr>
      <tr>
        <td class="meta-label">Submission Date/Time:</td>
        <td class="meta-val font-mono">${claim.submissionDateTime}</td>
        <td class="meta-label">Submitted By:</td>
        <td class="meta-val">${claim.submittedBy}</td>
      </tr>
      <tr>
        <td class="meta-label">Status:</td>
        <td class="meta-val font-bold" style="color: #047857;">${claim.status.replace(/_/g, ' ')}</td>
        <td class="meta-label">Calculation Period:</td>
        <td class="meta-val">${claim.calculationPeriod}</td>
      </tr>
    </table>

    <table class="claim-table">
      <thead>
        <tr>
          <th class="text-center">#</th>
          <th>Student Name</th>
          <th>EMIS ID</th>
          <th>Class</th>
          <th>Facility</th>
          <th class="text-center">Working Days</th>
          <th class="text-center">Days Attended</th>
          <th class="text-right">Rate/Day</th>
          <th class="text-right">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
      <tfoot>
        <tr class="tfoot-total">
          <td colspan="8" class="font-bold text-right" style="padding: 7px 8px;">
            Total Sanctioned / Claimed Amount:
          </td>
          <td class="text-right font-mono font-bold" style="font-size: 12px; color: #047857;">
            ₹${claim.totalClaimAmount.toLocaleString('en-IN')}
          </td>
        </tr>
      </tfoot>
    </table>

    <div class="declaration-box">
      <strong>Official System Record:</strong> This claim receipt is system generated by Tamil Nadu Samagra Shiksha School Transport & Escort Portal. Verified and forwarded to Block Educational Officer (BEO) for disbursement sanction.
    </div>

    <div class="signatures-row">
      <div class="signature-block">
        Submitted By<br/>
        <strong>${claim.submittedBy}</strong>
      </div>
      <div class="signature-block">
        School Seal<br/>
        <strong>${claim.schoolName}</strong>
      </div>
      <div class="signature-block">
        Verification Authority<br/>
        <strong>Block Educational Officer (BEO)</strong>
      </div>
    </div>
  `;

  return printHtmlDocument(`Claim_Receipt_${claim.udiseCode}_${claim.claimMonthKey}`, bodyHtml);
}

/**
 * Download Claim Receipt as PDF
 */
export function downloadClaimReceiptPdf(claim: SchoolClaimRecord) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('SAMAGRA SHIKSHA - TAMIL NADU', pageWidth / 2, currentY, { align: 'center' });

  currentY += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('School Transport & Escort Facility Claim Receipt', pageWidth / 2, currentY, { align: 'center' });

  currentY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87);
  doc.text(`OFFICIAL CLAIM RECEIPT - ${claim.claimMonthName.toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' });
  doc.setTextColor(15, 23, 42);

  currentY += 8;
  doc.setLineWidth(0.4);
  doc.line(14, currentY, pageWidth - 14, currentY);

  currentY += 5;
  doc.setFontSize(8.5);
  doc.text(`School: ${claim.schoolName}`, 16, currentY);
  doc.text(`UDISE: ${claim.udiseCode}`, 120, currentY);
  currentY += 5;
  doc.text(`Block: ${claim.blockName}`, 16, currentY);
  doc.text(`Submitted By: ${claim.submittedBy}`, 120, currentY);
  currentY += 5;
  doc.text(`Date/Time: ${claim.submissionDateTime}`, 16, currentY);
  doc.text(`Status: ${claim.status}`, 120, currentY);

  currentY += 8;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, currentY, pageWidth - 28, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('#', 16, currentY + 4);
  doc.text('Student Name', 25, currentY + 4);
  doc.text('EMIS', 70, currentY + 4);
  doc.text('Class', 105, currentY + 4);
  doc.text('Facility', 130, currentY + 4);
  doc.text('Days', 155, currentY + 4);
  doc.text('Amount (INR)', 175, currentY + 4);

  currentY += 8;
  doc.setFont('helvetica', 'normal');
  claim.students.forEach((st, idx) => {
    if (currentY > 265) {
      doc.addPage();
      currentY = 16;
    }
    doc.text(String(idx + 1), 16, currentY);
    doc.text(st.studentName.substring(0, 22), 25, currentY);
    doc.text(st.emisNumber, 70, currentY);
    doc.text(st.grade.substring(0, 12), 105, currentY);
    doc.text(st.category, 130, currentY);
    doc.text(String(st.daysAttended), 155, currentY);
    doc.text(`Rs. ${st.totalClaimAmount}`, 175, currentY);
    currentY += 5.5;
  });

  currentY += 3;
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL AMOUNT CLAIMED: Rs. ${claim.totalClaimAmount.toLocaleString('en-IN')}`, 16, currentY);

  doc.save(`Claim_Receipt_${claim.udiseCode}_${claim.claimMonthKey}.pdf`);
}

/**
 * Official A4 Landscape Claim Format PDF Generator
 * Matches the requested statutory format:
 * - Title 1: Samagra Shiksha, Vellore District
 * - Title 2: Transport and Escort facility - Claim for the month of (previous month name)
 * - Title 3: Block name : (block name) , School name: (school name)
 * - 13 Columns Table:
 *   Sl.no, Student name, EMIS number, Class & section, Gender, Community, Religion,
 *   Panchayat Name, Habitation Name, Total no of school working days,
 *   No.of days Usage the facility by student, Mode(Transport/Escort), Claim amount
 * - Grand Total row
 * - Declaration of Headmaster / Headmistress
 * - Headmaster / Headmistress official stamp
 */
export function downloadOfficialClaimLandscapePdf(params: {
  schoolName: string;
  udiseCode: string;
  blockName: string;
  monthName: string;
  totalWorkingDays: number;
  students: StudentClaimItem[];
  hmName?: string;
}) {
  const { schoolName, udiseCode, blockName, monthName, totalWorkingDays, students } = params;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const marginX = 8;
  const contentWidth = pageWidth - (marginX * 2); // 281mm

  let currentY = 12;

  // Title 1
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('SAMAGRA SHIKSHA, VELLORE DISTRICT', pageWidth / 2, currentY, { align: 'center' });

  // Title 2
  currentY += 5.5;
  doc.setFontSize(11);
  doc.setTextColor(4, 120, 87); // emerald-700
  doc.text(`Transport and Escort facility - Claim for the month of ${monthName}`, pageWidth / 2, currentY, { align: 'center' });

  // Title 3
  currentY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85); // slate-700
  doc.text(`Block name : ${blockName} , School name : ${schoolName} (UDISE: ${udiseCode})`, pageWidth / 2, currentY, { align: 'center' });

  currentY += 6;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.line(marginX, currentY, marginX + contentWidth, currentY);

  currentY += 3;

  // 13 Column definitions (Sum = 281mm)
  const cols = [
    { header: 'Sl.no', width: 11, align: 'center' },
    { header: 'Student name', width: 34, align: 'left' },
    { header: 'EMIS number', width: 28, align: 'left' },
    { header: 'Class & section', width: 22, align: 'left' },
    { header: 'Gender', width: 14, align: 'center' },
    { header: 'Community', width: 16, align: 'center' },
    { header: 'Religion', width: 16, align: 'center' },
    { header: 'Panchayat Name', width: 28, align: 'left' },
    { header: 'Habitation Name', width: 28, align: 'left' },
    { header: 'Total Working Days', width: 22, align: 'center' },
    { header: 'Usage Days', width: 20, align: 'center' },
    { header: 'Mode (Trans/Escort)', width: 23, align: 'center' },
    { header: 'Claim Amount', width: 19, align: 'right' },
  ];

  // Render Header Row
  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, currentY, contentWidth, 7, 'F');
  doc.setDrawColor(148, 163, 184);
  doc.rect(marginX, currentY, contentWidth, 7, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(30, 41, 59);

  let curX = marginX;
  cols.forEach(col => {
    const textX = col.align === 'center' ? curX + col.width / 2 : col.align === 'right' ? curX + col.width - 2 : curX + 2;
    doc.text(col.header, textX, currentY + 4.8, { align: col.align as any });
    doc.line(curX, currentY, curX, currentY + 7);
    curX += col.width;
  });
  doc.line(marginX + contentWidth, currentY, marginX + contentWidth, currentY + 7);

  currentY += 7;

  // Amount Calculator (Same as claim verification: >=75% = 600, <75% = pro-rata)
  const calcAmount = (days: number) => {
    if (days <= 0 || totalWorkingDays <= 0) return 0;
    const pct = (days / totalWorkingDays) * 100;
    if (pct >= 75) return 600;
    return Math.round((600 / totalWorkingDays) * days);
  };

  let totalUsageDays = 0;
  let totalClaimAmount = 0;

  // Rows
  students.forEach((st, idx) => {
    if (currentY > 170) {
      doc.addPage();
      currentY = 12;
    }

    const amt = calcAmount(st.daysAttended);
    totalUsageDays += st.daysAttended;
    totalClaimAmount += amt;

    const rowHeight = 6;
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, currentY, contentWidth, rowHeight, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginX, currentY, contentWidth, rowHeight, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);

    let x = marginX;
    // 1. Sl.no
    doc.text(String(idx + 1), x + cols[0].width / 2, currentY + 4.2, { align: 'center' });
    doc.line(x + cols[0].width, currentY, x + cols[0].width, currentY + rowHeight);
    x += cols[0].width;

    // 2. Student name
    doc.setFont('helvetica', 'bold');
    doc.text(st.studentName.substring(0, 22), x + 2, currentY + 4.2);
    doc.setFont('helvetica', 'normal');
    doc.line(x + cols[1].width, currentY, x + cols[1].width, currentY + rowHeight);
    x += cols[1].width;

    // 3. EMIS number
    doc.text(st.emisNumber, x + 2, currentY + 4.2);
    doc.line(x + cols[2].width, currentY, x + cols[2].width, currentY + rowHeight);
    x += cols[2].width;

    // 4. Class & section
    doc.text(st.grade.substring(0, 16), x + 2, currentY + 4.2);
    doc.line(x + cols[3].width, currentY, x + cols[3].width, currentY + rowHeight);
    x += cols[3].width;

    // 5. Gender
    doc.text(st.gender || (idx % 2 === 0 ? 'Male' : 'Female'), x + cols[4].width / 2, currentY + 4.2, { align: 'center' });
    doc.line(x + cols[4].width, currentY, x + cols[4].width, currentY + rowHeight);
    x += cols[4].width;

    // 6. Community
    doc.text(st.community || (idx % 3 === 0 ? 'BC' : idx % 3 === 1 ? 'MBC' : 'SC'), x + cols[5].width / 2, currentY + 4.2, { align: 'center' });
    doc.line(x + cols[5].width, currentY, x + cols[5].width, currentY + rowHeight);
    x += cols[5].width;

    // 7. Religion
    doc.text(st.religion || 'Hindu', x + cols[6].width / 2, currentY + 4.2, { align: 'center' });
    doc.line(x + cols[6].width, currentY, x + cols[6].width, currentY + rowHeight);
    x += cols[6].width;

    // 8. Panchayat Name
    doc.text((st.panchayatName || `${blockName} Panchayat`).substring(0, 18), x + 2, currentY + 4.2);
    doc.line(x + cols[7].width, currentY, x + cols[7].width, currentY + rowHeight);
    x += cols[7].width;

    // 9. Habitation Name
    doc.text((st.habitationName || 'Habitation').substring(0, 18), x + 2, currentY + 4.2);
    doc.line(x + cols[8].width, currentY, x + cols[8].width, currentY + rowHeight);
    x += cols[8].width;

    // 10. Total no of school working days
    doc.text(String(totalWorkingDays), x + cols[9].width / 2, currentY + 4.2, { align: 'center' });
    doc.line(x + cols[9].width, currentY, x + cols[9].width, currentY + rowHeight);
    x += cols[9].width;

    // 11. No.of days Usage the facility by student
    doc.setFont('helvetica', 'bold');
    doc.text(String(st.daysAttended), x + cols[10].width / 2, currentY + 4.2, { align: 'center' });
    doc.line(x + cols[10].width, currentY, x + cols[10].width, currentY + rowHeight);
    x += cols[10].width;

    // 12. Mode(Transport/Escort)
    doc.setFont('helvetica', 'normal');
    doc.text(st.category, x + cols[11].width / 2, currentY + 4.2, { align: 'center' });
    doc.line(x + cols[11].width, currentY, x + cols[11].width, currentY + rowHeight);
    x += cols[11].width;

    // 13. Claim amount
    doc.setFont('helvetica', 'bold');
    doc.text(`Rs. ${amt}`, x + cols[12].width - 2, currentY + 4.2, { align: 'right' });
    x += cols[12].width;

    currentY += rowHeight;
  });

  // Grand Total Row
  const totalRowHeight = 7;
  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, currentY, contentWidth, totalRowHeight, 'F');
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.rect(marginX, currentY, contentWidth, totalRowHeight, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);

  // Label spanning first 9 columns
  const first9Width = cols.slice(0, 9).reduce((sum, c) => sum + c.width, 0);
  doc.text(`GRAND TOTAL (${students.filter(s => s.daysAttended > 0).length} Claimed / ${students.length} Sanctioned Beneficiaries)`, marginX + 4, currentY + 4.8);

  // Working days column total
  let totX = marginX + first9Width;
  doc.text(String(totalWorkingDays), totX + cols[9].width / 2, currentY + 4.8, { align: 'center' });
  totX += cols[9].width;

  // Usage days column total
  doc.text(String(totalUsageDays), totX + cols[10].width / 2, currentY + 4.8, { align: 'center' });
  totX += cols[10].width;

  // Mode column empty
  totX += cols[11].width;

  // Claim amount grand total
  doc.setTextColor(4, 120, 87);
  doc.text(`Rs. ${totalClaimAmount.toLocaleString('en-IN')}`, marginX + contentWidth - 2, currentY + 4.8, { align: 'right' });

  currentY += totalRowHeight + 5;

  // Bottom section: Declaration on Left, Stamp on Right
  if (currentY > 175) {
    doc.addPage();
    currentY = 15;
  }

  // Declaration on Left
  const declWidth = 175;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.roundedRect(marginX, currentY, declWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Declaration of Headmaster / Headmistress:', marginX + 3, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Certified that the student beneficiaries listed above have availed Transport / Escort facilities for the stated number of days during the claim month of ${monthName} as per official physical attendance registers and escort log sheets. Claim amounts have been calculated strictly in compliance with Samagra Shiksha norms (>=75% attendance = Rs.600 flat; <75% = pro-rata). All particulars furnished are verified and found correct.`,
    marginX + 3,
    currentY + 9,
    { maxWidth: declWidth - 6 }
  );

  // Stamp / Signatory on Right
  const stampX = marginX + declWidth + 8;
  const stampWidth = contentWidth - declWidth - 8; // approx 98mm

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(stampX, currentY, stampWidth, 24, 2, 2, 'FD');

  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(stampX + 10, currentY + 14, stampX + stampWidth - 10, currentY + 14);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Headmaster / Headmistress', stampX + stampWidth / 2, currentY + 17.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text(schoolName.substring(0, 32), stampX + stampWidth / 2, currentY + 21, { align: 'center' });

  const filename = `Claim_Format_${udiseCode}_${monthName.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}

/**
 * Download Claim Format as CSV file with 13 columns and Grand Total row
 */
export function downloadClaimCsv(params: {
  schoolName: string;
  udiseCode: string;
  blockName: string;
  monthName: string;
  totalWorkingDays: number;
  students: StudentClaimItem[];
}) {
  const { schoolName, udiseCode, blockName, monthName, totalWorkingDays, students } = params;

  const calcAmount = (days: number) => {
    if (days <= 0 || totalWorkingDays <= 0) return 0;
    const pct = (days / totalWorkingDays) * 100;
    if (pct >= 75) return 600;
    return Math.round((600 / totalWorkingDays) * days);
  };

  const headers = [
    'Sl.no',
    'Student name',
    'EMIS number',
    'Class & section',
    'Gender',
    'Community',
    'Religion',
    'Panchayat Name',
    'Habitation Name',
    'Total no of school working days',
    'No.of days Usage the facility by student',
    'Mode(Transport/Escort)',
    'Claim amount',
  ];

  let totalUsageDays = 0;
  let totalClaimAmount = 0;

  const rows = students.map((st, idx) => {
    const amt = calcAmount(st.daysAttended);
    totalUsageDays += st.daysAttended;
    totalClaimAmount += amt;

    return [
      idx + 1,
      `"${st.studentName.replace(/"/g, '""')}"`,
      `"${st.emisNumber}"`,
      `"${st.grade.replace(/"/g, '""')}"`,
      st.gender || (idx % 2 === 0 ? 'Male' : 'Female'),
      st.community || (idx % 3 === 0 ? 'BC' : idx % 3 === 1 ? 'MBC' : 'SC'),
      st.religion || 'Hindu',
      `"${(st.panchayatName || `${blockName} Panchayat`).replace(/"/g, '""')}"`,
      `"${(st.habitationName || 'Habitation').replace(/"/g, '""')}"`,
      totalWorkingDays,
      st.daysAttended,
      st.category,
      amt,
    ].join(',');
  });

  // Grand Total Row
  const totalRow = [
    'TOTAL',
    `"Grand Total (${students.filter(s => s.daysAttended > 0).length} Claimed / ${students.length} Beneficiaries)"`,
    '""',
    '""',
    '""',
    '""',
    '""',
    '""',
    '""',
    totalWorkingDays,
    totalUsageDays,
    '""',
    totalClaimAmount,
  ].join(',');

  const csvContent = '\uFEFF' + [
    `"SAMAGRA SHIKSHA, VELLORE DISTRICT"`,
    `"Transport and Escort facility - Claim for the month of ${monthName}"`,
    `"Block name : ${blockName} , School name : ${schoolName} (UDISE: ${udiseCode})"`,
    '',
    headers.join(','),
    ...rows,
    totalRow,
    '',
    `"Declaration of Headmaster / Headmistress: Certified that the student beneficiaries listed above have availed Transport / Escort facilities during ${monthName} as per physical registers. All claim amounts calculated strictly as per Samagra Shiksha norms."`,
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Claim_Format_${udiseCode}_${monthName.replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * School-wise Block Claim PDF Row Data Structure
 */
export interface SchoolWiseClaimPdfRow {
  slNo: number;
  schoolName: string;
  udiseCode: string;
  totalWorkingDays: number;
  transportClaim: {
    noOfStudents: number;
    amount: number;
  };
  escortClaim: {
    noOfStudents: number;
    amount: number;
  };
  totalClaimedAmount: number;
  approvedByBlock: {
    transport: number;
    escort: number;
    total: number;
  };
}

export interface SchoolWiseBlockClaimPdfParams {
  blockName: string;
  monthName: string;
  submissionDate: string;
  schools: SchoolWiseClaimPdfRow[];
}

/**
 * 1. Download School-Wise Claim Amount PDF (A4 Landscape, strict requested layout)
 * Heading: Samagra Shiksha, Vellore district
 * Subtitle: Transport/Escort claim for the month of (month name)
 * Left: Block Name : (block) | Right: Date : (date)
 * Table: Sl.no, Name of the School, Udise code, total no.of school working days,
 * Transportation claim by school (No.of students, Amount),
 * Escort claim by school (No.of students, Amount),
 * Total amount claimed by school (transport+escort),
 * Amount approved by block (transport, escort, total)
 * Grand total (block total)
 * Left: Signature of the Coordinator | Right: Signature of the Supervisor
 */
export function downloadSchoolWiseBlockClaimPdf(params: SchoolWiseBlockClaimPdfParams) {
  const { blockName, monthName, submissionDate, schools } = params;
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const marginX = 10;
  const usableWidth = pageWidth - marginX * 2; // 277mm
  let currentY = 14;

  // Heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('Samagra Shiksha, Vellore district', pageWidth / 2, currentY, { align: 'center' });
  currentY += 6;

  // Subtitle
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Transport/Escort claim for the month of ${monthName}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 8;

  // Sub-header: Block Name (Left) & Date (Right)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Block Name : ${blockName}`, marginX, currentY);
  doc.text(`Date : ${submissionDate}`, pageWidth - marginX, currentY, { align: 'right' });
  currentY += 5;

  // Table Column Definitions (Total Width = 277mm)
  // [Sl, SchoolName, Udise, Days, TransStudents, TransAmt, EscortStudents, EscortAmt, TotalClaimed, AppTrans, AppEscort, AppTotal]
  const widths = [10, 52, 23, 16, 17, 20, 17, 20, 27, 24, 24, 27];
  const colX: number[] = [];
  let cumulativeX = marginX;
  for (let i = 0; i < widths.length; i++) {
    colX.push(cumulativeX);
    cumulativeX += widths[i];
  }

  // Draw 2-tier table headers
  const headerHeight1 = 6;
  const headerHeight2 = 6;
  const totalHeaderHeight = headerHeight1 + headerHeight2;

  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, currentY, usableWidth, totalHeaderHeight, 'F');
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.3);
  doc.rect(marginX, currentY, usableWidth, totalHeaderHeight, 'S');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);

  // Top header row: vertical divider lines and text
  // 1. Sl.no
  doc.text('Sl.no', colX[0] + widths[0] / 2, currentY + 7, { align: 'center' });
  doc.line(colX[1], currentY, colX[1], currentY + totalHeaderHeight);

  // 2. Name of the School
  doc.text('Name of the School', colX[1] + widths[1] / 2, currentY + 7, { align: 'center' });
  doc.line(colX[2], currentY, colX[2], currentY + totalHeaderHeight);

  // 3. Udise code
  doc.text('Udise code', colX[2] + widths[2] / 2, currentY + 7, { align: 'center' });
  doc.line(colX[3], currentY, colX[3], currentY + totalHeaderHeight);

  // 4. total no.of school working days
  doc.text('Working', colX[3] + widths[3] / 2, currentY + 5, { align: 'center' });
  doc.text('Days', colX[3] + widths[3] / 2, currentY + 9, { align: 'center' });
  doc.line(colX[4], currentY, colX[4], currentY + totalHeaderHeight);

  // 5. transportation claim by school (ColSpan 2: widths[4] + widths[5])
  const transClaimWidth = widths[4] + widths[5];
  doc.text('Transportation claim by school', colX[4] + transClaimWidth / 2, currentY + 4, { align: 'center' });
  doc.line(colX[4], currentY + headerHeight1, colX[4] + transClaimWidth, currentY + headerHeight1);
  doc.line(colX[5], currentY + headerHeight1, colX[5], currentY + totalHeaderHeight);
  doc.line(colX[6], currentY, colX[6], currentY + totalHeaderHeight);

  // 6. Escort claim by school (ColSpan 2: widths[6] + widths[7])
  const escortClaimWidth = widths[6] + widths[7];
  doc.text('Escort claim by school', colX[6] + escortClaimWidth / 2, currentY + 4, { align: 'center' });
  doc.line(colX[6], currentY + headerHeight1, colX[6] + escortClaimWidth, currentY + headerHeight1);
  doc.line(colX[7], currentY + headerHeight1, colX[7], currentY + totalHeaderHeight);
  doc.line(colX[8], currentY, colX[8], currentY + totalHeaderHeight);

  // 7. Total amount claimed by school (transport+escort)
  doc.text('Total Claimed', colX[8] + widths[8] / 2, currentY + 5, { align: 'center' });
  doc.text('(Trans+Escort)', colX[8] + widths[8] / 2, currentY + 9, { align: 'center' });
  doc.line(colX[9], currentY, colX[9], currentY + totalHeaderHeight);

  // 8. Amount approved by block (ColSpan 3: widths[9] + widths[10] + widths[11])
  const approvedWidth = widths[9] + widths[10] + widths[11];
  doc.text('Amount approved by block', colX[9] + approvedWidth / 2, currentY + 4, { align: 'center' });
  doc.line(colX[9], currentY + headerHeight1, colX[9] + approvedWidth, currentY + headerHeight1);
  doc.line(colX[10], currentY + headerHeight1, colX[10], currentY + totalHeaderHeight);
  doc.line(colX[11], currentY + headerHeight1, colX[11], currentY + totalHeaderHeight);

  // Sub-headers in Row 2
  const subY = currentY + headerHeight1 + 4;
  doc.setFontSize(6.5);
  doc.text('No.of Students', colX[4] + widths[4] / 2, subY, { align: 'center' });
  doc.text('Amount (Rs)', colX[5] + widths[5] / 2, subY, { align: 'center' });
  doc.text('No.of Students', colX[6] + widths[6] / 2, subY, { align: 'center' });
  doc.text('Amount (Rs)', colX[7] + widths[7] / 2, subY, { align: 'center' });
  doc.text('Transport (Rs)', colX[9] + widths[9] / 2, subY, { align: 'center' });
  doc.text('Escort (Rs)', colX[10] + widths[10] / 2, subY, { align: 'center' });
  doc.text('Total (Rs)', colX[11] + widths[11] / 2, subY, { align: 'center' });

  currentY += totalHeaderHeight;

  // Totals accumulators
  let totTransStudents = 0;
  let totTransAmt = 0;
  let totEscortStudents = 0;
  let totEscortAmt = 0;
  let totClaimed = 0;
  let totAppTrans = 0;
  let totAppEscort = 0;
  let totAppTotal = 0;

  // Draw Data Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const rowHeight = 6.5;

  schools.forEach((row, idx) => {
    totTransStudents += row.transportClaim.noOfStudents;
    totTransAmt += row.transportClaim.amount;
    totEscortStudents += row.escortClaim.noOfStudents;
    totEscortAmt += row.escortClaim.amount;
    totClaimed += row.totalClaimedAmount;
    totAppTrans += row.approvedByBlock.transport;
    totAppEscort += row.approvedByBlock.escort;
    totAppTotal += row.approvedByBlock.total;

    // Background shading for alternate rows
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, currentY, usableWidth, rowHeight, 'F');
    }

    // Outer and vertical borders
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.15);
    doc.rect(marginX, currentY, usableWidth, rowHeight, 'S');
    for (let c = 1; c < colX.length; c++) {
      doc.line(colX[c], currentY, colX[c], currentY + rowHeight);
    }

    const textY = currentY + 4.5;
    doc.setTextColor(15, 23, 42);

    doc.text(String(row.slNo), colX[0] + widths[0] / 2, textY, { align: 'center' });
    doc.text(row.schoolName.substring(0, 32), colX[1] + 2, textY);
    doc.text(row.udiseCode, colX[2] + widths[2] / 2, textY, { align: 'center' });
    doc.text(String(row.totalWorkingDays), colX[3] + widths[3] / 2, textY, { align: 'center' });

    doc.text(String(row.transportClaim.noOfStudents), colX[4] + widths[4] / 2, textY, { align: 'center' });
    doc.text(row.transportClaim.amount.toLocaleString('en-IN'), colX[5] + widths[5] - 2, textY, { align: 'right' });

    doc.text(String(row.escortClaim.noOfStudents), colX[6] + widths[6] / 2, textY, { align: 'center' });
    doc.text(row.escortClaim.amount.toLocaleString('en-IN'), colX[7] + widths[7] - 2, textY, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text(row.totalClaimedAmount.toLocaleString('en-IN'), colX[8] + widths[8] - 2, textY, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.text(row.approvedByBlock.transport.toLocaleString('en-IN'), colX[9] + widths[9] - 2, textY, { align: 'right' });
    doc.text(row.approvedByBlock.escort.toLocaleString('en-IN'), colX[10] + widths[10] - 2, textY, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text(row.approvedByBlock.total.toLocaleString('en-IN'), colX[11] + widths[11] - 2, textY, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    currentY += rowHeight;
  });

  // Grand Total (Block Total) Row
  const totalRowHeight = 7.5;
  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, currentY, usableWidth, totalRowHeight, 'F');
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.rect(marginX, currentY, usableWidth, totalRowHeight, 'S');

  for (let c = 1; c < colX.length; c++) {
    doc.line(colX[c], currentY, colX[c], currentY + totalRowHeight);
  }

  const totY = currentY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);

  // Grand Total Label spanning columns 0 to 3
  doc.text('Grand Total (Block Total)', colX[0] + 3, totY);
  doc.text(String(totTransStudents), colX[4] + widths[4] / 2, totY, { align: 'center' });
  doc.text(totTransAmt.toLocaleString('en-IN'), colX[5] + widths[5] - 2, totY, { align: 'right' });
  doc.text(String(totEscortStudents), colX[6] + widths[6] / 2, totY, { align: 'center' });
  doc.text(totEscortAmt.toLocaleString('en-IN'), colX[7] + widths[7] - 2, totY, { align: 'right' });
  doc.text(totClaimed.toLocaleString('en-IN'), colX[8] + widths[8] - 2, totY, { align: 'right' });
  doc.text(totAppTrans.toLocaleString('en-IN'), colX[9] + widths[9] - 2, totY, { align: 'right' });
  doc.text(totAppEscort.toLocaleString('en-IN'), colX[10] + widths[10] - 2, totY, { align: 'right' });
  doc.setTextColor(4, 120, 87);
  doc.text(totAppTotal.toLocaleString('en-IN'), colX[11] + widths[11] - 2, totY, { align: 'right' });

  currentY += totalRowHeight + 25;

  // Stamp / Signatures below table:
  // Left side: Signature of the Coordinator | Right side: Signature of the Supervisor
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.25);
  doc.line(25, currentY, 85, currentY);
  doc.line(pageWidth - 85, currentY, pageWidth - 25, currentY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Signature of the Coordinator', 55, currentY + 5, { align: 'center' });
  doc.text('Signature of the Supervisor', pageWidth - 55, currentY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${blockName} Block Educational Office`, 55, currentY + 9, { align: 'center' });
  doc.text('Samagra Shiksha, Vellore District', pageWidth - 55, currentY + 9, { align: 'center' });

  const filename = `School_Wise_Claim_${blockName.replace(/\s+/g, '_')}_${monthName.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}

/**
 * Currency Number to Words converter (Indian numbering system: Crores, Lakhs, Thousands, Hundreds)
 */
export function numberToWordsINR(num: number): string {
  if (!num || isNaN(num) || num <= 0) return 'Zero';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
  }

  let words = '';
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = Math.floor(num / 100);
  num %= 100;

  if (crore > 0) words += inWords(crore) + ' Crore ';
  if (lakh > 0) words += inWords(lakh) + ' Lakh ';
  if (thousand > 0) words += inWords(thousand) + ' Thousand ';
  if (hundred > 0) words += inWords(hundred) + ' Hundred ';
  if (num > 0) {
    if (words !== '') words += 'and ';
    words += inWords(num) + ' ';
  }
  return words.trim();
}

export interface StudentWiseClaimReportStudentItem {
  slNo?: number;
  studentName: string;
  emisNumber: string;
  grade: string;
  panchayatName?: string;
  workingDays?: number;
  mode?: string;
  daysAvailed?: number;
  claimedAmount?: number;
  approvedAmount?: number;
}

export interface StudentWiseClaimReportSchoolGroup {
  schoolName: string;
  udiseCode: string;
  students: StudentWiseClaimReportStudentItem[];
}

export interface StudentWiseBlockClaimPdfParams {
  blockName: string;
  monthName: string;
  submissionDate: string;
  schools?: StudentWiseClaimReportSchoolGroup[];
  students?: (StudentClaimItem & { schoolName: string; udiseCode: string; approvedAmount?: number })[];
}

/**
 * 2. Download Consolidated Student-Wise Claim Amount PDF across all schools in Block
 * A4 Size, Landscape, Minimal Margins with Header Rows.
 * Columns:
 * Sl.no, Name of the School, Udise code, Name of the student, EMIS number,
 * class and section, Panchayat name, total number of school working days in previous month,
 * Name of the mode (which one mode is he availed),
 * number of days availed transport or escort facility (which one mode is he availed),
 * Amount claimed by school, Amount approved by block.
 * Includes Grand Total under every school, Block Grand Total below the last school,
 * Signature of the Coordinator (Left), Signature of the Supervisor (Right).
 */
export function downloadStudentWiseBlockClaimLandscapePdf(params: StudentWiseBlockClaimPdfParams) {
  const { blockName, monthName, submissionDate } = params;

  // Build uniform schoolGroups
  let schoolGroups: StudentWiseClaimReportSchoolGroup[] = [];

  if (params.schools && params.schools.length > 0) {
    schoolGroups = params.schools;
  } else if (params.students && params.students.length > 0) {
    const groupedMap: Record<string, StudentWiseClaimReportSchoolGroup> = {};
    params.students.forEach((st) => {
      if (!groupedMap[st.udiseCode]) {
        groupedMap[st.udiseCode] = {
          schoolName: st.schoolName,
          udiseCode: st.udiseCode,
          students: [],
        };
      }
      groupedMap[st.udiseCode].students.push({
        studentName: st.studentName,
        emisNumber: st.emisNumber,
        grade: st.grade,
        panchayatName: st.panchayatName,
        workingDays: st.workingDaysInMonth || 22,
        mode: st.category,
        daysAvailed: st.daysAttended,
        claimedAmount: st.totalClaimAmount,
        approvedAmount: st.approvedAmount !== undefined ? st.approvedAmount : st.totalClaimAmount,
      });
    });
    schoolGroups = Object.values(groupedMap);
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const marginX = 8; // Minimal margins
  const usableWidth = pageWidth - marginX * 2; // 281mm

  // 12 Column Widths (Sum = 281mm)
  // [Sl, School, Udise, Student, EMIS, Class, Panchayat, WorkingDays, Mode, DaysAvailed, Claimed, Approved]
  const widths = [9, 36, 21, 30, 23, 20, 27, 18, 18, 18, 29, 32];
  const colX: number[] = [];
  let curX = marginX;
  widths.forEach((w) => {
    colX.push(curX);
    curX += w;
  });

  // Helper to draw Header Banner and 12-Column Table Headers
  const drawHeader = (startY: number): number => {
    let y = startY;

    // Heading: Samagra Shiksha, Vellore district
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Samagra Shiksha, Vellore district', pageWidth / 2, y, { align: 'center' });
    y += 5.5;

    // Subtitle: Transport/Escort claim for the month of ( month name)
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Transport/Escort claim for the month of ${monthName}`, pageWidth / 2, y, { align: 'center' });
    y += 6.5;

    // Sub-header: Left: Block Name, Right: Date
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`Block Name : ${blockName}`, marginX, y);
    doc.text(`Date : ${submissionDate}`, pageWidth - marginX, y, { align: 'right' });
    y += 5;

    // Table Header Box
    const headerHeight = 10;
    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, y, usableWidth, headerHeight, 'F');
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.25);
    doc.rect(marginX, y, usableWidth, headerHeight, 'S');

    // Vertical column divider lines
    for (let c = 1; c < colX.length; c++) {
      doc.line(colX[c], y, colX[c], y + headerHeight);
    }

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);

    // 1. Sl.no
    doc.text('Sl.no', colX[0] + widths[0] / 2, y + 6, { align: 'center' });
    // 2. Name of the School
    doc.text('Name of the School', colX[1] + widths[1] / 2, y + 6, { align: 'center' });
    // 3. Udise code
    doc.text('Udise code', colX[2] + widths[2] / 2, y + 6, { align: 'center' });
    // 4. Name of the student
    doc.text('Name of the student', colX[3] + widths[3] / 2, y + 6, { align: 'center' });
    // 5. EMIS number
    doc.text('EMIS number', colX[4] + widths[4] / 2, y + 6, { align: 'center' });
    // 6. class and section
    doc.text('Class & section', colX[5] + widths[5] / 2, y + 6, { align: 'center' });
    // 7. Panchayat name
    doc.text('Panchayat name', colX[6] + widths[6] / 2, y + 6, { align: 'center' });
    // 8. total number of school working days in previous month
    doc.text('Working Days', colX[7] + widths[7] / 2, y + 4.2, { align: 'center' });
    doc.text('(Previous Month)', colX[7] + widths[7] / 2, y + 7.8, { align: 'center' });
    // 9. Name of the mode (which one mode is he availed)
    doc.text('Name of mode', colX[8] + widths[8] / 2, y + 4.2, { align: 'center' });
    doc.text('(Trans/Escort)', colX[8] + widths[8] / 2, y + 7.8, { align: 'center' });
    // 10. number of days availed transport or escort facility (which one mode is he availed)
    doc.text('Days Availed', colX[9] + widths[9] / 2, y + 4.2, { align: 'center' });
    doc.text('(Trans/Escort)', colX[9] + widths[9] / 2, y + 7.8, { align: 'center' });
    // 11. Amount claimed by school
    doc.text('Amount claimed', colX[10] + widths[10] / 2, y + 4.2, { align: 'center' });
    doc.text('by school (Rs)', colX[10] + widths[10] / 2, y + 7.8, { align: 'center' });
    // 12. Amount approved by block
    doc.text('Amount approved', colX[11] + widths[11] / 2, y + 4.2, { align: 'center' });
    doc.text('by block (Rs)', colX[11] + widths[11] / 2, y + 7.8, { align: 'center' });

    return y + headerHeight;
  };

  let currentY = drawHeader(12);
  let runningSlNo = 1;
  let grandBlockClaimed = 0;
  let grandBlockApproved = 0;
  let grandBlockDays = 0;

  schoolGroups.forEach((school) => {
    let schoolClaimedSum = 0;
    let schoolApprovedSum = 0;
    let schoolDaysSum = 0;
    let schoolWorkingDays = 22;

    school.students.forEach((st, idx) => {
      // Automatic page break if content reaches bottom margin
      if (currentY + 7 > pageHeight - 22) {
        doc.addPage('a4', 'landscape');
        currentY = drawHeader(12);
      }

      const rowSl = st.slNo || runningSlNo++;
      const sName = school.schoolName;
      const sUdise = school.udiseCode;
      const stuName = st.studentName;
      const emis = st.emisNumber;
      const grade = st.grade;
      const panchayat = st.panchayatName || `${blockName} Panchayat`;
      const wDays = st.workingDays || 22;
      schoolWorkingDays = wDays;
      const mode = st.mode || 'Transport';
      const dAvailed = st.daysAvailed !== undefined ? st.daysAvailed : 0;
      const claimedAmt = st.claimedAmount !== undefined ? st.claimedAmount : 0;
      const approvedAmt = st.approvedAmount !== undefined ? st.approvedAmount : claimedAmt;

      schoolClaimedSum += claimedAmt;
      schoolApprovedSum += approvedAmt;
      schoolDaysSum += dAvailed;

      grandBlockClaimed += claimedAmt;
      grandBlockApproved += approvedAmt;
      grandBlockDays += dAvailed;

      const rowHeight = 6;
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, currentY, usableWidth, rowHeight, 'F');
      }

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.15);
      doc.rect(marginX, currentY, usableWidth, rowHeight, 'S');

      for (let c = 1; c < colX.length; c++) {
        doc.line(colX[c], currentY, colX[c], currentY + rowHeight);
      }

      const textY = currentY + 4.2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(15, 23, 42);

      // Sl.no
      doc.text(String(rowSl), colX[0] + widths[0] / 2, textY, { align: 'center' });
      // Name of the School
      doc.text(sName.substring(0, 24), colX[1] + 1.5, textY);
      // Udise code
      doc.text(sUdise, colX[2] + widths[2] / 2, textY, { align: 'center' });
      // Name of the student
      doc.setFont('helvetica', 'bold');
      doc.text(stuName.substring(0, 20), colX[3] + 1.5, textY);
      doc.setFont('helvetica', 'normal');
      // EMIS number
      doc.text(emis, colX[4] + widths[4] / 2, textY, { align: 'center' });
      // Class and section
      doc.text(grade.substring(0, 14), colX[5] + widths[5] / 2, textY, { align: 'center' });
      // Panchayat name
      doc.text(panchayat.substring(0, 18), colX[6] + 1.5, textY);
      // Working days
      doc.text(String(wDays), colX[7] + widths[7] / 2, textY, { align: 'center' });
      // Name of mode
      doc.text(mode, colX[8] + widths[8] / 2, textY, { align: 'center' });
      // Days availed
      doc.text(String(dAvailed), colX[9] + widths[9] / 2, textY, { align: 'center' });
      // Amount claimed by school
      doc.text(claimedAmt.toLocaleString('en-IN'), colX[10] + widths[10] - 2, textY, { align: 'right' });
      // Amount approved by block
      doc.setFont('helvetica', 'bold');
      doc.text(approvedAmt.toLocaleString('en-IN'), colX[11] + widths[11] - 2, textY, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      currentY += rowHeight;
    });

    // GRAND TOTAL UNDER EVERY SCHOOL
    if (currentY + 7 > pageHeight - 22) {
      doc.addPage('a4', 'landscape');
      currentY = drawHeader(12);
    }

    const schoolTotalHeight = 6.5;
    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, currentY, usableWidth, schoolTotalHeight, 'F');
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.2);
    doc.rect(marginX, currentY, usableWidth, schoolTotalHeight, 'S');

    for (let c = 1; c < colX.length; c++) {
      doc.line(colX[c], currentY, colX[c], currentY + schoolTotalHeight);
    }

    const stTextY = currentY + 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);

    doc.text(`Grand Total - ${school.schoolName} (${school.students.length} Students)`, colX[0] + 2, stTextY);
    doc.text(String(schoolWorkingDays), colX[7] + widths[7] / 2, stTextY, { align: 'center' });
    doc.text('—', colX[8] + widths[8] / 2, stTextY, { align: 'center' });
    doc.text(String(schoolDaysSum), colX[9] + widths[9] / 2, stTextY, { align: 'center' });
    doc.text(`Rs. ${schoolClaimedSum.toLocaleString('en-IN')}`, colX[10] + widths[10] - 2, stTextY, { align: 'right' });
    doc.setTextColor(4, 120, 87);
    doc.text(`Rs. ${schoolApprovedSum.toLocaleString('en-IN')}`, colX[11] + widths[11] - 2, stTextY, { align: 'right' });
    doc.setTextColor(15, 23, 42);

    currentY += schoolTotalHeight;
  });

  // GRAND TOTAL (BLOCK TOTAL) IN BELOW OF LAST SCHOOL
  if (currentY + 8 > pageHeight - 24) {
    doc.addPage('a4', 'landscape');
    currentY = drawHeader(12);
  }

  const blockTotalHeight = 7.5;
  doc.setFillColor(226, 232, 240);
  doc.rect(marginX, currentY, usableWidth, blockTotalHeight, 'F');
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.35);
  doc.rect(marginX, currentY, usableWidth, blockTotalHeight, 'S');

  for (let c = 1; c < colX.length; c++) {
    doc.line(colX[c], currentY, colX[c], currentY + blockTotalHeight);
  }

  const btTextY = currentY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);

  const totalStudentsCount = schoolGroups.reduce((acc, s) => acc + s.students.length, 0);
  doc.text(`Grand Total (Block Total - ${blockName} Block) (${totalStudentsCount} Students)`, colX[0] + 2, btTextY);
  doc.text('—', colX[7] + widths[7] / 2, btTextY, { align: 'center' });
  doc.text('—', colX[8] + widths[8] / 2, btTextY, { align: 'center' });
  doc.text(String(grandBlockDays), colX[9] + widths[9] / 2, btTextY, { align: 'center' });
  doc.text(`Rs. ${grandBlockClaimed.toLocaleString('en-IN')}`, colX[10] + widths[10] - 2, btTextY, { align: 'right' });
  doc.setTextColor(4, 120, 87);
  doc.text(`Rs. ${grandBlockApproved.toLocaleString('en-IN')}`, colX[11] + widths[11] - 2, btTextY, { align: 'right' });

  currentY += blockTotalHeight + 16;

  // SIGNATURES: Left: Signature of the Coordinator | Right: Signature of the Supervisor
  if (currentY + 16 > pageHeight - 8) {
    doc.addPage('a4', 'landscape');
    currentY = 24;
  }

  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.25);
  doc.line(25, currentY, 85, currentY);
  doc.line(pageWidth - 85, currentY, pageWidth - 25, currentY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Signature of the Coordinator', 55, currentY + 5, { align: 'center' });
  doc.text('Signature of the Supervisor', pageWidth - 55, currentY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${blockName} Educational Block`, 55, currentY + 9, { align: 'center' });
  doc.text('Samagra Shiksha, Vellore District', pageWidth - 55, currentY + 9, { align: 'center' });

  const filename = `Student_Wise_Claim_${blockName.replace(/\s+/g, '_')}_${monthName.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}

/**
 * 3. Download Official BEO Covering Letter PDF to DPO Samagra Shiksha
 * Automatically fills submission date, block name, and downloads as A4 portrait minimal-margins PDF.
 * Checks Supabase database for any attached custom draft letter before falling back to statutory template.
 */
export async function downloadBlockCoveringLetterPdf(params: {
  blockName: string;
  monthName: string;
  submissionDate: string;
  totalSchools: number;
  totalStudents: number;
  totalAmount: number;
  bmoName: string;
}) {
  const { blockName, monthName, submissionDate, totalSchools, totalStudents, totalAmount, bmoName } = params;

  // 1. Check Supabase for any attached/stored draft letter
  let customDraftText: string | null = null;
  try {
    const { data: tData } = await supabase
      .from('letter_templates')
      .select('template_body, content')
      .eq('name', 'covering_letter')
      .limit(1);
    if (tData && tData.length > 0) {
      customDraftText = tData[0].template_body || tData[0].content || null;
    }
  } catch (e) {
    // proceed
  }

  if (!customDraftText) {
    try {
      const { data: cData } = await supabase
        .from('covering_letters')
        .select('content, body, draft_text')
        .limit(1);
      if (cData && cData.length > 0) {
        customDraftText = cData[0].content || cData[0].draft_text || cData[0].body || null;
      }
    } catch (e) {
      // proceed
    }
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const marginX = 12; // Minimal margins
  let currentY = 16;

  if (customDraftText) {
    // Automatically replace date, block name, and figures in user's draft letter
    const populated = customDraftText
      .replace(/{{DATE}}/gi, submissionDate)
      .replace(/\[DATE\]/gi, submissionDate)
      .replace(/Date\s*:\s*_+/gi, `Date : ${submissionDate}`)
      .replace(/{{BLOCK_NAME}}/gi, blockName)
      .replace(/\[BLOCK_NAME\]/gi, blockName)
      .replace(/\[BLOCK\]/gi, blockName)
      .replace(/{{MONTH}}/gi, monthName)
      .replace(/\[MONTH\]/gi, monthName)
      .replace(/{{TOTAL_SCHOOLS}}/gi, String(totalSchools))
      .replace(/\[TOTAL_SCHOOLS\]/gi, String(totalSchools))
      .replace(/{{TOTAL_STUDENTS}}/gi, String(totalStudents))
      .replace(/\[TOTAL_STUDENTS\]/gi, String(totalStudents))
      .replace(/{{TOTAL_AMOUNT}}/gi, `Rs. ${totalAmount.toLocaleString('en-IN')}`)
      .replace(/\[TOTAL_AMOUNT\]/gi, `Rs. ${totalAmount.toLocaleString('en-IN')}`)
      .replace(/{{BEO_NAME}}/gi, bmoName);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);

    const splitLines = doc.splitTextToSize(populated, pageWidth - marginX * 2);
    splitLines.forEach((line: string) => {
      if (currentY > 280) {
        doc.addPage('a4', 'portrait');
        currentY = 16;
      }
      doc.text(line, marginX, currentY);
      currentY += 5.5;
    });

    const filename = `Covering_Letter_${blockName.replace(/\s+/g, '_')}_${monthName.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
    return;
  }

  // Standard statutory Samagra Shiksha draft covering letter with auto-populated date & block name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('DEPARTMENT OF SCHOOL EDUCATION · TAMIL NADU', pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;

  doc.setFontSize(10.5);
  doc.text('SAMAGRA SHIKSHA · VELLORE DISTRICT', pageWidth / 2, currentY, { align: 'center' });
  currentY += 4.5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Office of the Block Educational Officer · ${blockName} Block`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 3;

  doc.setLineWidth(0.4);
  doc.setDrawColor(15, 23, 42);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 7;

  // Letter Reference & Date (automatically filled submission date)
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Roc. No. SS/TE/${blockName.toUpperCase().replace(/\s+/g, '_')}/${new Date().getFullYear()}`, marginX, currentY);
  doc.text(`Date : ${submissionDate}`, pageWidth - marginX, currentY, { align: 'right' });
  currentY += 8;

  // To Address
  doc.setFont('helvetica', 'normal');
  doc.text('To,', marginX, currentY);
  currentY += 4.2;
  doc.text('The District Project Coordinator / Chief Educational Officer,', marginX + 6, currentY);
  currentY += 4.2;
  doc.text('Samagra Shiksha, District Project Office,', marginX + 6, currentY);
  currentY += 4.2;
  doc.text('Vellore District - 632 009.', marginX + 6, currentY);
  currentY += 8;

  // Subject
  doc.setFont('helvetica', 'bold');
  doc.text('Sir / Madam,', marginX, currentY);
  currentY += 4.5;
  doc.text(
    `Sub : Samagra Shiksha - Transport and Escort Facility - Monthly Claim for ${monthName} - Consolidated Block proposal of ${blockName} Block submitted for administrative sanction and ECS release - reg.`,
    marginX + 6,
    currentY,
    { maxWidth: pageWidth - marginX * 2 - 6 }
  );
  currentY += 10;

  // Reference
  doc.setFont('helvetica', 'normal');
  doc.text('Ref : 1. State Project Director, Samagra Shiksha, Chennai Guidelines Circular.', marginX + 6, currentY);
  currentY += 4.2;
  doc.text(`      2. Verified School Claim Entries received from ${totalSchools} schools of ${blockName} Block.`, marginX + 6, currentY);
  currentY += 7;

  // Body text
  doc.setFontSize(8.5);
  doc.text(
    `With reference to the subjects and references cited above, I am submitting herewith the consolidated monthly Transport & Escort facility claims for the month of ${monthName} in respect of ${totalSchools} schools functioning in ${blockName} Block.`,
    marginX,
    currentY,
    { maxWidth: pageWidth - marginX * 2, align: 'justify' }
  );
  currentY += 11;

  doc.text(
    `All student-level beneficiary entries, attendance availed days, and journey vouchers have been physically validated and cross-verified with EMIS registers by the Block Educational Office. The claim particulars are consolidated as below:`,
    marginX,
    currentY,
    { maxWidth: pageWidth - marginX * 2, align: 'justify' }
  );
  currentY += 9;

  // Summary Table in Letter
  doc.setFillColor(248, 250, 252);
  doc.rect(marginX, currentY, pageWidth - marginX * 2, 28, 'F');
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.2);
  doc.rect(marginX, currentY, pageWidth - marginX * 2, 28, 'S');

  doc.setFont('helvetica', 'bold');
  doc.text('1. Educational Block Name:', marginX + 4, currentY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${blockName} Block`, marginX + 75, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.text('2. Claim Month & Academic Year:', marginX + 4, currentY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${monthName} (Academic Year 2026-27)`, marginX + 75, currentY + 10.5);

  doc.setFont('helvetica', 'bold');
  doc.text('3. Total Schools Covered:', marginX + 4, currentY + 15.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${totalSchools} Schools (100% Verified)`, marginX + 75, currentY + 15.5);

  doc.setFont('helvetica', 'bold');
  doc.text('4. Total Beneficiary Students:', marginX + 4, currentY + 20.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${totalStudents} Students`, marginX + 75, currentY + 20.5);

  doc.setFont('helvetica', 'bold');
  doc.text('5. Total Amount Claimed & Sanctioned:', marginX + 4, currentY + 25.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87);
  doc.text(`Rs. ${totalAmount.toLocaleString('en-IN')} (Rupees ${numberToWordsINR(totalAmount)} only)`, marginX + 75, currentY + 25.5);
  doc.setTextColor(15, 23, 42);

  currentY += 34;

  doc.setFont('helvetica', 'normal');
  doc.text(
    'Hence, I request that the consolidated sanction may kindly be accorded and funds released directly to the respective School Management Committee (SMC) bank accounts through ECS/DBT mode.',
    marginX,
    currentY,
    { maxWidth: pageWidth - marginX * 2, align: 'justify' }
  );
  currentY += 10;

  doc.text('Enclosures: 1. School-wise Claim Statement (Landscape Format)', marginX, currentY);
  currentY += 4.2;
  doc.text('             2. Student-wise Beneficiary Attendance Register with EMIS numbers', marginX, currentY);
  currentY += 4.2;
  doc.text('             3. SMC Bank Account Particulars with IFSC codes', marginX, currentY);
  currentY += 20;

  // Signatures
  doc.setFont('helvetica', 'bold');
  doc.text('Block Educational Officer (BEO)', pageWidth - marginX, currentY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(bmoName, pageWidth - marginX, currentY + 4.5, { align: 'right' });
  doc.text(`${blockName} Block, Vellore District`, pageWidth - marginX, currentY + 9, { align: 'right' });

  doc.text('Office Seal', marginX + 10, currentY + 4.5);

  const filename = `Covering_Letter_${blockName.replace(/\s+/g, '_')}_${monthName.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}

