/**
 * Date & Monthly Cycle Utilities
 * Generates dynamic claim periods, month names, calculation periods,
 * and deadlines strictly from the active date without hardcoding.
 */

export interface DynamicCycleInfo {
  // The current active session/calendar date
  currentDate: Date;
  // The month for which claims are submitted (Previous Month)
  claimMonthIndex: number; // 0-11
  claimYear: number;
  claimMonthKey: string; // "YYYY-MM"
  claimMonthName: string; // e.g. "September 2026"
  claimMonthOnlyName: string; // e.g. "September"
  
  // The month in which schools and blocks submit (Current Month)
  submissionMonthIndex: number;
  submissionYear: number;
  submissionMonthName: string; // e.g. "October 2026"
  
  // Calculation period range
  calculationStartDate: Date;
  calculationEndDate: Date;
  calculationPeriodString: string; // e.g. "September 01, 2026 to September 30, 2026"
  
  // Standard working days in claim month (approx excluding Sundays)
  totalDaysInClaimMonth: number;
  approxWorkingDays: number;
  
  // Submission deadline (e.g. 10th of submission month for school, 15th for block)
  schoolDeadlineDateString: string;
  blockDeadlineDateString: string;
  districtDeadlineDateString: string;
  cycleClosingDateString: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Calculates all cycle parameters based on a given base date (defaults to now).
 * Can accept an offset in months for simulation / testing.
 */
export function calculateCycleInfo(baseDate: Date = new Date(), monthOffset: number = 0): DynamicCycleInfo {
  const adjustedCurrentDate = new Date(baseDate);
  if (monthOffset !== 0) {
    adjustedCurrentDate.setMonth(adjustedCurrentDate.getMonth() + monthOffset);
  }

  const currentYear = adjustedCurrentDate.getFullYear();
  const currentMonth = adjustedCurrentDate.getMonth(); // 0 to 11

  // Claim month is the immediate previous month
  const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const claimYear = prevMonthDate.getFullYear();
  const claimMonthIndex = prevMonthDate.getMonth();
  const claimMonthOnlyName = MONTH_NAMES[claimMonthIndex];
  const claimMonthName = `${claimMonthOnlyName} ${claimYear}`;
  const claimMonthKey = `${claimYear}-${String(claimMonthIndex + 1).padStart(2, '0')}`;

  const submissionMonthName = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

  // Calculation period is 1st of claim month to last day of claim month
  const calculationStartDate = new Date(claimYear, claimMonthIndex, 1);
  const calculationEndDate = new Date(claimYear, claimMonthIndex + 1, 0); // Last day of month
  const totalDays = calculationEndDate.getDate();

  // Approximate working days (Mon-Sat, approx 22-25 days)
  let workingDays = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dayOfWeek = new Date(claimYear, claimMonthIndex, d).getDay();
    if (dayOfWeek !== 0) { // Not Sunday
      workingDays++;
    }
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const formatFullDate = (d: Date) => 
    `${MONTH_NAMES[d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()}`;

  const calculationPeriodString = `${formatFullDate(calculationStartDate)} to ${formatFullDate(calculationEndDate)}`;

  // Deadlines in submission month
  const schoolDeadline = new Date(currentYear, currentMonth, 10);
  const blockDeadline = new Date(currentYear, currentMonth, 18);
  const districtDeadline = new Date(currentYear, currentMonth, 25);
  const closingDeadline = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

  return {
    currentDate: adjustedCurrentDate,
    claimMonthIndex,
    claimYear,
    claimMonthKey,
    claimMonthName,
    claimMonthOnlyName,
    submissionMonthIndex: currentMonth,
    submissionYear: currentYear,
    submissionMonthName,
    calculationStartDate,
    calculationEndDate,
    calculationPeriodString,
    totalDaysInClaimMonth: totalDays,
    approxWorkingDays: workingDays,
    schoolDeadlineDateString: formatFullDate(schoolDeadline),
    blockDeadlineDateString: formatFullDate(blockDeadline),
    districtDeadlineDateString: formatFullDate(districtDeadline),
    cycleClosingDateString: formatFullDate(closingDeadline),
  };
}

/**
 * Returns a list of past N months available for archival viewing
 */
export function getAvailablePastMonths(count: number = 6): Array<{ key: string; name: string; period: string }> {
  const result: Array<{ key: string; name: string; period: string }> = [];
  const now = new Date();
  
  for (let i = 1; i <= count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr = d.getFullYear();
    const mo = d.getMonth();
    const lastDay = new Date(yr, mo + 1, 0).getDate();
    result.push({
      key: `${yr}-${String(mo + 1).padStart(2, '0')}`,
      name: `${MONTH_NAMES[mo]} ${yr}`,
      period: `01/${String(mo + 1).padStart(2, '0')}/${yr} to ${lastDay}/${String(mo + 1).padStart(2, '0')}/${yr}`,
    });
  }
  return result;
}

export function formatCurrencyINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
