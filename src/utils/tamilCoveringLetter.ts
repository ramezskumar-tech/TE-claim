/**
 * Utility functions for generating official Tamil Nadu Government
 * Transport & Escort Facility Covering Letters (முன்னனுப்பு கடிதம்).
 */

import jsPDF from 'jspdf';
import { printHtmlDocument } from './printHelper';

// Number to Tamil Words in Indian Rupee format
export function numberToTamilWordsINR(amount: number): string {
  if (!amount || isNaN(amount) || amount <= 0) return 'பூஜ்ஜியம் ரூபாய் மட்டும்';

  const units: { [key: number]: string } = {
    0: '',
    1: 'ஒன்று',
    2: 'இரண்டு',
    3: 'மூன்று',
    4: 'நான்கு',
    5: 'ஐந்து',
    6: 'ஆறு',
    7: 'ஏழு',
    8: 'எட்டு',
    9: 'ஒன்பது',
    10: 'பத்து',
    11: 'பதினொன்று',
    12: 'பன்னிரண்டு',
    13: 'பதின்மூன்று',
    14: 'பதினான்கு',
    15: 'பதினைந்து',
    16: 'பதினாறு',
    17: 'பதினேழு',
    18: 'பதினெட்டு',
    19: 'பத்தொன்பது',
  };

  const tens: { [key: number]: string } = {
    2: 'இருபது',
    3: 'முப்பது',
    4: 'நாற்பது',
    5: 'ஐம்பது',
    6: 'அறுபது',
    7: 'எழுபது',
    8: 'எண்பது',
    9: 'தொண்ணூறு',
  };

  const tensPrefix: { [key: number]: string } = {
    2: 'இருபத்து ',
    3: 'முப்பத்து ',
    4: 'நாற்பத்து ',
    5: 'ஐம்பத்து ',
    6: 'அறுபத்து ',
    7: 'எழுபத்து ',
    8: 'எண்பத்து ',
    9: 'தொண்ணூற்று ',
  };

  function convertTwoDigits(n: number): string {
    if (n < 20) return units[n] || '';
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return tens[t] || '';
    return (tensPrefix[t] || '') + (units[u] || '');
  }

  function convertThreeDigits(n: number): string {
    let str = '';
    const h = Math.floor(n / 100);
    const rem = n % 100;

    if (h > 0) {
      if (h === 1) str += rem === 0 ? 'நூறு' : 'நூற்று ';
      else if (h === 2) str += rem === 0 ? 'இருநூறு' : 'இருநூற்று ';
      else if (h === 3) str += rem === 0 ? 'முந்நூறு' : 'முந்நூற்று ';
      else if (h === 4) str += rem === 0 ? 'நானூறு' : 'நானூற்று ';
      else if (h === 5) str += rem === 0 ? 'ஐந்நூறு' : 'ஐந்நூற்று ';
      else if (h === 6) str += rem === 0 ? 'அறுநூறு' : 'அறுநூற்று ';
      else if (h === 7) str += rem === 0 ? 'எழுநூறு' : 'எழுநூற்று ';
      else if (h === 8) str += rem === 0 ? 'எண்ணூறு' : 'எண்ணூற்று ';
      else if (h === 9) str += rem === 0 ? 'தொள்ளாயிரம்' : 'தொள்ளாயிரத்து ';
    }

    if (rem > 0) {
      str += convertTwoDigits(rem);
    }
    return str;
  }

  let num = Math.floor(amount);
  let words = '';

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const remaining = num;

  if (crore > 0) {
    words += (crore === 1 ? 'ஒரு கோடி ' : convertThreeDigits(crore) + ' கோடி ');
  }

  if (lakh > 0) {
    if (lakh === 1) words += 'ஒரு இலட்சத்து ';
    else words += convertThreeDigits(lakh) + ' இலட்சத்து ';
  }

  if (thousand > 0) {
    if (thousand === 1) words += 'ஆயிரத்து ';
    else words += convertThreeDigits(thousand) + ' ஆயிரத்து ';
  }

  if (remaining > 0) {
    words += convertThreeDigits(remaining);
  }

  words = words.trim();
  if (!words) words = 'பூஜ்ஜியம்';

  return `ரூபாய் ${words} மட்டும்`;
}

export interface SchoolTamilCoveringLetterData {
  schoolName: string;
  udiseCode: string;
  blockName: string;
  headmasterName: string;
  monthName: string;
  calculationPeriod: string;
  totalWorkingDays: number;
  totalStudents: number;
  transportStudentsCount: number;
  escortStudentsCount: number;
  transportAmount: number;
  escortAmount: number;
  totalClaimAmount: number;
  submissionDateTime: string;
  accountHolderName?: string;
  accountNumber?: string;
  bankName?: string;
  branch?: string;
  ifscCode?: string;
}

export interface BlockTamilCoveringLetterData {
  blockName: string;
  bmoName: string;
  monthName: string;
  calculationPeriod: string;
  totalSchools: number;
  totalStudents: number;
  transportStudentsCount: number;
  escortStudentsCount: number;
  totalTransportAmount: number;
  totalEscortAmount: number;
  totalAmount: number;
  submissionDate: string;
}

/**
 * Generate official Tamil Covering Letter HTML for School Login
 */
export function generateSchoolTamilCoveringLetterHtml(data: SchoolTamilCoveringLetterData): string {
  const tamilAmountWords = numberToTamilWordsINR(data.totalClaimAmount);
  const currentYear = new Date().getFullYear();
  const refNo = `ந.க.எண். SS/TE/${data.udiseCode || 'SCH'}/${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
  const dateFormatted = data.submissionDateTime || new Date().toLocaleDateString('en-IN');

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; line-height: 1.5; color: #0f172a; max-width: 800px; margin: 0 auto; padding: 24px 28px; background: #ffffff;">
      <!-- Letterhead Banner -->
      <div style="text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px;">
        <div style="font-size: 15px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.5px; margin-bottom: 2px;">
          தமிழ்நாடு அரசு · பள்ளிக் கல்வித் துறை
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #047857; margin-bottom: 3px;">
          ஒருங்கிணைந்த பள்ளிக் கல்வி (SAMAGRA SHIKSHA) · வேலூர் மாவட்டம்
        </div>
        <div style="font-size: 12px; font-weight: 600; color: #475569;">
          ${data.schoolName} (UDISE: ${data.udiseCode}), ${data.blockName} ஒன்றியம்
        </div>
        <div style="margin-top: 6px; display: inline-block; padding: 3px 14px; background: #e0e7ff; color: #3730a3; font-size: 11px; font-weight: 800; border-radius: 9999px; border: 1px solid #c7d2fe;">
          முன்னனுப்பு கடிதம் (COVERING LETTER)
        </div>
      </div>

      <!-- Ref & Date -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; font-size: 11px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;">
        <div><strong>${refNo}</strong></div>
        <div><strong>நாள் / சமர்ப்பிப்புத் தேதி:</strong> ${dateFormatted}</div>
      </div>

      <!-- From & To Table -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 14px; font-size: 11.5px;">
        <div style="background: #f8fafc; padding: 10px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div style="font-weight: 800; color: #334155; margin-bottom: 4px; text-decoration: underline;">அனுப்புநர்:</div>
          <div>தலைமை ஆசிரியர் / பள்ளிப் பொறுப்பாளர்,</div>
          <div style="font-weight: 700;">${data.schoolName},</div>
          <div>UDISE குறியீட்டு எண்: <span style="font-family: monospace; font-weight: bold;">${data.udiseCode}</span>,</div>
          <div>${data.blockName} ஒன்றியம், வேலூர் மாவட்டம்.</div>
        </div>

        <div style="background: #f8fafc; padding: 10px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div style="font-weight: 800; color: #334155; margin-bottom: 4px; text-decoration: underline;">பெறுநர்:</div>
          <div>வட்டாரக் கல்வி அலுவலர் (BEO) அவர்கள்,</div>
          <div>வட்டார வள மையம் (BRC),</div>
          <div style="font-weight: 700;">${data.blockName} ஒன்றியம்,</div>
          <div>வேலூர் மாவட்டம்.</div>
        </div>
      </div>

      <!-- Salutation -->
      <div style="font-size: 11.5px; font-weight: 700; margin-bottom: 8px;">
        மதிப்பிற்குரிய ஐயா / அம்மையீர்,
      </div>

      <!-- Subject & Reference -->
      <div style="margin-bottom: 14px; font-size: 11px; line-height: 1.5; background: #f1f5f9; padding: 10px 12px; border-left: 4px solid #1e3a8a; border-radius: 4px;">
        <div style="margin-bottom: 6px;">
          <strong style="color: #1e3a8a;">பொருள்:</strong> ஒருங்கிணைந்த பள்ளிக் கல்வி – 2026-2027 ஆம் கல்வி ஆண்டு – <strong>${data.monthName}</strong> மாதத்திற்கான மாற்றுத்திறனாளி / தகுதியுள்ள சிறப்புப் பிரிவைச் சேர்ந்த மாணவ / மாணவியருக்கான போக்குவரத்து மற்றும் பாதுகாவலர் படி (Transport & Escort Facility Claim) – செலவின விவரப் படிவங்கள் மற்றும் மாணவர் வருகைப் பதிவேடு சரிபார்க்கப்பட்டு முன்னனுப்புதல் – நிதி விடுவிக்க ஒப்புதல் கோருதல் – சார்பு.
        </div>
        <div>
          <strong style="color: #1e3a8a;">பார்வை:</strong> 
          1. மாநிலத் திட்ட இயக்குநர், ஒருங்கிணைந்த பள்ளிக் கல்வி, சென்னை அவர்களின் வழிகாட்டு நெறிமுறைகள்.<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          2. பள்ளியின் பள்ளி மேலாண்மைக் குழு (SMC) அதிகாரப்பூர்வத் தீர்மானம்.<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          3. ${data.monthName} மாத பள்ளி மாணவர் தினசரி வருகைப் பதிவேடு மற்றும் செலவின வவுச்சர்கள்.
        </div>
      </div>

      <!-- Body Content -->
      <div style="font-size: 11px; text-align: justify; margin-bottom: 14px; line-height: 1.6;">
        &nbsp;&nbsp;&nbsp;&nbsp;பார்வையில் குறிப்பிட்ட அரசு வழிகாட்டு நெறிமுறைகளின்படி, வேலூர் மாவட்டம், <strong>${data.blockName}</strong> ஒன்றியம், <strong>${data.schoolName}</strong> (UDISE: ${data.udiseCode}) பள்ளியில் பயிலும் மாற்றுத்திறனாளி / சிறப்பு கவனம் தேவைப்படும் மாணவ / மாணவியர்களுக்கு <strong>${data.monthName}</strong> மாதத்தில் வழங்கப்பட்ட போக்குவரத்து (Transport) மற்றும் பாதுகாவலர் (Escort) வசதிக்கான மாதாந்திரக் கோரிக்கைப் படிவம் மாணவர்களின் உண்மை வருகை மற்றும் பள்ளி ஆவணங்களின் அடிப்படையில் முழுமையாக சரிபார்க்கப்பட்டு இத்துடன் பரிந்துரைத்து சமர்ப்பிக்கப்படுகிறது.
      </div>

      <!-- Claim Summary Table -->
      <div style="margin-bottom: 14px;">
        <div style="font-size: 11.5px; font-weight: 800; color: #1e3a8a; margin-bottom: 6px;">
          ★ மாதாந்திர செலவினத் தொகுப்பு விவரக் குறிப்பு:
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; border: 1px solid #cbd5e1;">
          <tbody>
            <tr style="background: #f8fafc;">
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700; width: 45%;">பள்ளியின் பெயர் & UDISE</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a;">${data.schoolName} (${data.udiseCode})</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700;">கல்வி ஒன்றியம் & மாவட்டம்</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">${data.blockName} ஒன்றியம், வேலூர் மாவட்டம்</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700;">கோரிக்கை மாதம் & கணக்கீட்டுக் காலம்</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #1e3a8a;">${data.monthName} (${data.calculationPeriod || 'முழு மாதம்'})</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700;">பள்ளியின் மொத்த வேலை நாட்கள்</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold;">${data.totalWorkingDays} நாட்கள்</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700;">பயனடைந்த மொத்த மாணவர்கள்</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold;">${data.totalStudents} மாணவர்கள் (போக்குவரத்து: ${data.transportStudentsCount || 0}, பாதுகாவலர்: ${data.escortStudentsCount || 0})</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700;">போக்குவரத்து உதவித்தொகை (Transport Amount)</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 700; color: #047857;">₹${(data.transportAmount || 0).toLocaleString('en-IN')}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700;">பாதுகாவலர் உதவித்தொகை (Escort Amount)</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 700; color: #1d4ed8;">₹${(data.escortAmount || 0).toLocaleString('en-IN')}</td>
            </tr>
            <tr style="background: #eef2ff;">
              <td style="padding: 7px 10px; border: 1px solid #cbd5e1; font-weight: 800; color: #1e3a8a; font-size: 11px;">மொத்தக் கோரிக்கை தொகை (Total Claim Amount)</td>
              <td style="padding: 7px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 900; color: #047857; font-size: 12px;">₹${(data.totalClaimAmount || 0).toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700;">தொகை எழுத்து வடிவில் (In Words)</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #047857;">${tamilAmountWords}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700;">SMC வங்கிக் கணக்கு விபரம் (Bank Details)</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-size: 10px;">
                கணக்கு எண்: <strong style="font-family: monospace;">${data.accountNumber || 'வங்கி கணக்கு பதிவு செய்யப்பட்டுள்ளது'}</strong><br />
                வங்கி / கிளை: ${data.bankName || 'வங்கி'} - ${data.branch || 'கிளை'} (IFSC: <span style="font-family: monospace;">${data.ifscCode || 'IFSC'}</span>)
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700;">இணையவழி சமர்ப்பிக்கப்பட்ட தேதி & நேரம்</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: monospace;">${data.submissionDateTime || dateFormatted}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Statutory Declaration Statement -->
      <div style="font-size: 10.5px; line-height: 1.6; text-align: justify; margin-bottom: 14px; background: #faf5ff; padding: 8px 12px; border-radius: 6px; border: 1px solid #e9d5ff;">
        <strong>உறுதிமொழி:</strong> மேற்குறிப்பிட்ட விவரங்கள் அனைத்தும் உண்மை எனவும், மாணவர் தினசரி வருகைப் பதிவேடு, EMIS பதிவுகள் மற்றும் வாகன / பாதுகாவலர் சான்றுகளுடன் முழுமையாக ஒப்பிட்டு சரிபார்க்கப்பட்டது எனவும் உறுதி கூறுகிறேன். இச்செலவினத் தொகையினை எமது பள்ளி மேலாண்மைக் குழு (SMC) வங்கிக் கணக்கிற்கு ECS / DBT வழியாக விடுவித்து ஆணை வழங்குமாறு பணிவுடன் வேண்டுகிறேன்.
      </div>

      <!-- Enclosures -->
      <div style="font-size: 10.5px; margin-bottom: 24px;">
        <div style="font-weight: 700; color: #334155; margin-bottom: 3px;">இணைப்புகள்:</div>
        <div>1. மாணவர் வாரியான சரிபார்க்கப்பட்ட செலவினப் பட்டியல் (Student-wise Claim Statement).</div>
        <div>2. பள்ளி மேலாண்மைக் குழு (SMC) முறையான தீர்மான நகல்.</div>
        <div>3. பள்ளி மேலாண்மைக் குழு (SMC) வங்கிக் கணக்குப் புத்தக முதல் பக்க நகல்.</div>
      </div>

      <!-- Signatures Row -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; padding-top: 10px; font-size: 11px;">
        <div style="text-align: center; border: 1px dashed #94a3b8; padding: 16px 20px; border-radius: 8px; width: 140px; color: #64748b;">
          பள்ளி அலுவலக முத்திரை<br />(School Seal)
        </div>

        <div style="text-align: right;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 3px;">தங்கள் உண்மையுள்ள,</div>
          <div style="height: 35px;"></div>
          <div style="font-weight: 700; color: #0f172a;">${data.headmasterName || 'தலைமை ஆசிரியர்'}</div>
          <div>தலைமை ஆசிரியர் / பள்ளிப் பொறுப்பாளர்</div>
          <div style="font-size: 10px; color: #475569;">${data.schoolName}</div>
          <div style="font-size: 10px; color: #64748b;">நாள்: ${dateFormatted}</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate official Tamil Covering Letter HTML for Block Login
 */
export function generateBlockTamilCoveringLetterHtml(data: BlockTamilCoveringLetterData): string {
  const tamilAmountWords = numberToTamilWordsINR(data.totalAmount);
  const currentYear = new Date().getFullYear();
  const refNo = `ந.க.எண். SS/TE/BEO/${data.blockName.toUpperCase().replace(/\s+/g, '_')}/${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
  const dateFormatted = data.submissionDate || new Date().toLocaleDateString('en-IN');

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; line-height: 1.5; color: #0f172a; max-width: 800px; margin: 0 auto; padding: 24px 28px; background: #ffffff;">
      <!-- Letterhead Banner -->
      <div style="text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px;">
        <div style="font-size: 15px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.5px; margin-bottom: 2px;">
          தமிழ்நாடு அரசு · பள்ளிக் கல்வித் துறை
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #047857; margin-bottom: 3px;">
          ஒருங்கிணைந்த பள்ளிக் கல்வி (SAMAGRA SHIKSHA)
        </div>
        <div style="font-size: 12px; font-weight: 600; color: #475569;">
          வட்டாரக் கல்வி அலுவலர் அலுவலகம் · ${data.blockName} ஒன்றியம், வேலூர் மாவட்டம்
        </div>
        <div style="margin-top: 6px; display: inline-block; padding: 3px 14px; background: #e0e7ff; color: #3730a3; font-size: 11px; font-weight: 800; border-radius: 9999px; border: 1px solid #c7d2fe;">
          ஒன்றிய முன்னனுப்பு கடிதம் (BLOCK COVERING LETTER)
        </div>
      </div>

      <!-- Ref & Date -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; font-size: 11px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;">
        <div><strong>${refNo}</strong></div>
        <div><strong>நாள்:</strong> ${dateFormatted}</div>
      </div>

      <!-- From & To Table -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 14px; font-size: 11.5px;">
        <div style="background: #f8fafc; padding: 10px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div style="font-weight: 800; color: #334155; margin-bottom: 4px; text-decoration: underline;">அனுப்புநர்:</div>
          <div>வட்டாரக் கல்வி அலுவலர் (BEO) அவர்கள்,</div>
          <div>வட்டார வள மையம் (BRC),</div>
          <div style="font-weight: 700;">${data.blockName} ஒன்றியம்,</div>
          <div>வேலூர் மாவட்டம்.</div>
        </div>

        <div style="background: #f8fafc; padding: 10px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div style="font-weight: 800; color: #334155; margin-bottom: 4px; text-decoration: underline;">பெறுநர்:</div>
          <div>மாவட்டத் திட்ட ஒருங்கிணைப்பாளர் / முதன்மைக் கல்வி அலுவலர்,</div>
          <div>ஒருங்கிணைந்த பள்ளிக் கல்வி,</div>
          <div style="font-weight: 700;">மாவட்ட திட்ட அலுவலகம்,</div>
          <div>வேலூர் மாவட்டம் - 632 009.</div>
        </div>
      </div>

      <!-- Salutation -->
      <div style="font-size: 11.5px; font-weight: 700; margin-bottom: 8px;">
        மதிப்பிற்குரிய ஐயா / அம்மையீர்,
      </div>

      <!-- Subject & Reference -->
      <div style="margin-bottom: 14px; font-size: 11px; line-height: 1.5; background: #f1f5f9; padding: 10px 12px; border-left: 4px solid #1e3a8a; border-radius: 4px;">
        <div style="margin-bottom: 6px;">
          <strong style="color: #1e3a8a;">பொருள்:</strong> ஒருங்கிணைந்த பள்ளிக் கல்வி – 2026-2027 ஆம் கல்வி ஆண்டு – <strong>${data.monthName}</strong> மாதத்திற்கான மாற்றுத்திறனாளி மாணவ / மாணவியருக்கான போக்குவரத்து மற்றும் பாதுகாவலர் உதவித்தொகை (Transport & Escort Allowance) – <strong>${data.blockName}</strong> ஒன்றியத்திற்குட்பட்ட ${data.totalSchools} பள்ளிகளுக்கான ஒருங்கிணைந்த கோரிக்கை பரிந்துரைத்து சமர்ப்பித்தல் – நிதி ஒப்பளிப்பு வழங்கி விடுவிக்கக் கோருதல் – சார்பு.
        </div>
        <div>
          <strong style="color: #1e3a8a;">பார்வை:</strong> 
          1. மாநிலத் திட்ட இயக்குநர், ஒருங்கிணைந்த பள்ளிக் கல்வி, சென்னை அவர்களின் சுற்றறிக்கை.<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          2. ${data.blockName} ஒன்றியத்திற்குட்பட்ட ${data.totalSchools} பள்ளிகளிடமிருந்து பெறப்பட்டு வட்டார அளவில் 100% சரிபார்க்கப்பட்ட மாதாந்திரக் கோரிக்கைப் படிவங்கள்.
        </div>
      </div>

      <!-- Body Content -->
      <div style="font-size: 11px; text-align: justify; margin-bottom: 14px; line-height: 1.6;">
        &nbsp;&nbsp;&nbsp;&nbsp;பார்வையில் குறிப்பிட்ட அரசாணை மற்றும் வழிகாட்டு நெறிமுறைகளின்படி, வேலூர் மாவட்டம், <strong>${data.blockName}</strong> ஒன்றியத்திற்குட்பட்ட தொடக்க மற்றும் நடுநிலைப் பள்ளிகளில் பயிலும் சிறப்பு கவனம் தேவைப்படும் மாணவ / மாணவியருக்கு <strong>${data.monthName}</strong> மாதத்தில் வழங்கப்பட்ட போக்குவரத்து (Transport) மற்றும் பாதுகாவலர் (Escort) உதவித்தொகைக் கோரிக்கைப் படிவங்கள் வட்டாரக் கல்வி அலுவலகத்தால் EMIS தரவுகள் மற்றும் வருகைப் பதிவேடுகளுடன் முழுமையாக சரிபார்க்கப்பட்டு, ஒன்றிய அளவிலான தொகுப்பு அறிக்கை இத்துடன் இணைத்து சமர்ப்பிக்கப்படுகிறது.
      </div>

      <!-- Block Claim Summary Table -->
      <div style="margin-bottom: 14px;">
        <div style="font-size: 11.5px; font-weight: 800; color: #1e3a8a; margin-bottom: 6px;">
          ★ ஒன்றிய அளவிலான மாதாந்திரத் தொகுப்பு விவரங்கள்:
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; border: 1px solid #cbd5e1;">
          <tbody>
            <tr style="background: #f8fafc;">
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700; width: 45%;">கல்வி ஒன்றியத்தின் பெயர்</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a;">${data.blockName} ஒன்றியம், வேலூர் மாவட்டம்</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700;">கோரிக்கை மாதம் & கல்வி ஆண்டு</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #1e3a8a;">${data.monthName} (கல்வி ஆண்டு 2026-2027)</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700;">சரிபார்க்கப்பட்ட மொத்தப் பள்ளிகள்</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #1e3a8a;">${data.totalSchools} பள்ளிகள் (100% BEO சரிபார்ப்பு நிறைவு)</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700;">பயனடைந்த மொத்த மாற்றுத்திறனாளி மாணவர்கள்</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold;">${data.totalStudents} மாணவர்கள் (போக்குவரத்து: ${data.transportStudentsCount || 0}, பாதுகாவலர்: ${data.escortStudentsCount || 0})</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700;">போக்குவரத்து உதவித்தொகை (Transport Allowance)</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 700; color: #047857;">₹${(data.totalTransportAmount || 0).toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700;">பாதுகாவலர் உதவித்தொகை (Escort Allowance)</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 700; color: #1d4ed8;">₹${(data.totalEscortAmount || 0).toLocaleString('en-IN')}</td>
            </tr>
            <tr style="background: #eef2ff;">
              <td style="padding: 7px 10px; border: 1px solid #cbd5e1; font-weight: 800; color: #1e3a8a; font-size: 11px;">ஒன்றிய மொத்தக் கோரிக்கை தொகை (Consolidated Block Claim)</td>
              <td style="padding: 7px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 900; color: #047857; font-size: 12px;">₹${(data.totalAmount || 0).toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700;">தொகை எழுத்து வடிவில் (In Words)</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #047857;">${tamilAmountWords}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700;">ஒன்றிய அளவிலான சமர்ப்பிப்புத் தேதி</td>
              <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: monospace;">${data.submissionDate || dateFormatted}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Statutory Request Statement -->
      <div style="font-size: 10.5px; line-height: 1.6; text-align: justify; margin-bottom: 14px; background: #faf5ff; padding: 8px 12px; border-radius: 6px; border: 1px solid #e9d5ff;">
        <strong>கோரிக்கை:</strong> மேற்குறிப்பிட்ட ${data.blockName} ஒன்றியத்திற்கான மொத்த ஒப்பளிப்புத் தொகையினை சம்மந்தப்பட்ட பள்ளி மேலாண்மைக் குழுக்களின் (SMC) அதிகாரப்பூர்வ வங்கிக் கணக்குகளுக்கு நேரடியாக ECS / DBT மூலமாக விடுவித்து ஆணை வழங்குமாறு பணிவுடன் கேட்டுக்கொள்கிறேன்.
      </div>

      <!-- Enclosures -->
      <div style="font-size: 10.5px; margin-bottom: 24px;">
        <div style="font-weight: 700; color: #334155; margin-bottom: 3px;">இணைப்புகள்:</div>
        <div>1. பள்ளி வாரியான ஒருங்கிணைந்த கோரிக்கை அறிக்கை (School-wise Consolidated Claim Statement).</div>
        <div>2. மாணவர் வாரியான வருகை மற்றும் EMIS சரிபார்ப்பு விவரங்கள் (Student Beneficiary Verified List).</div>
        <div>3. பள்ளிகளின் SMC வங்கிக் கணக்கு மற்றும் IFSC விவரப் பட்டியல் (SMC Bank IFSC Statements).</div>
      </div>

      <!-- Signatures Row -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; padding-top: 10px; font-size: 11px;">
        <div style="text-align: center; border: 1px dashed #94a3b8; padding: 16px 20px; border-radius: 8px; width: 140px; color: #64748b;">
          வட்டார அலுவலக முத்திரை<br />(Block Office Seal)
        </div>

        <div style="text-align: right;">
          <div style="font-weight: 800; color: #0f172a; margin-bottom: 3px;">தங்கள் உண்மையுள்ள,</div>
          <div style="height: 35px;"></div>
          <div style="font-weight: 700; color: #0f172a;">${data.bmoName || 'வட்டாரக் கல்வி அலுவலர்'}</div>
          <div>வட்டாரக் கல்வி அலுவலர் (BEO)</div>
          <div style="font-size: 10px; color: #475569;">${data.blockName} ஒன்றியம், வேலூர் மாவட்டம்</div>
          <div style="font-size: 10px; color: #64748b;">நாள்: ${dateFormatted}</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Print Tamil Covering Letter directly
 */
export async function printTamilCoveringLetter(title: string, htmlContent: string): Promise<boolean> {
  return printHtmlDocument(title, htmlContent);
}

/**
 * Download Tamil Covering Letter as print-ready PDF/HTML
 */
export async function downloadTamilCoveringLetterPdf(title: string, htmlContent: string, filename: string): Promise<void> {
  // We can open the print window with print dialog or generate A4 PDF
  const fullHtml = `
    <!DOCTYPE html>
    <html lang="ta">
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm 12mm;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: #ffffff;
          color: #0f172a;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `;

  // Trigger print document or save file
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
