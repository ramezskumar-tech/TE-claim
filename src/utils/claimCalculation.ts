/**
 * Policy-Compliant Claim Calculation Utilities
 * 
 * Rules:
 * 1. Attendance percentage is calculated from:
 *    (facility availed days / total number of working days) * 100
 * 2. If student attendance is >= 75%:
 *    Claim amount is flat 600 rupees per student.
 * 3. If student attendance is below 75%:
 *    Claim amount is calculated as:
 *    (600 / total number of working days) * number of availed days in the current month by the specific student
 *    This amount is rounded to whole number: Math.round((600 / totalWorkingDays) * daysAttended)
 * 4. If availed days <= 0 or total working days <= 0:
 *    Claim amount is 0 rupees.
 */

export function calculateStudentClaimAmount(daysAttended: number, totalWorkingDays: number): number {
  if (daysAttended <= 0 || totalWorkingDays <= 0) {
    return 0;
  }
  const percentage = (daysAttended / totalWorkingDays) * 100;
  if (percentage >= 75) {
    return 600;
  }
  return Math.round((600 / totalWorkingDays) * daysAttended);
}

export function calculateAttendancePercentage(daysAttended: number, totalWorkingDays: number): number {
  if (daysAttended <= 0 || totalWorkingDays <= 0) {
    return 0;
  }
  const val = (daysAttended / totalWorkingDays) * 100;
  return Math.min(100, Math.round(val * 10) / 10);
}
