import { Student, SalaryConfig, SalarySettingItem } from './types';

// Color Palette Constants
export const COLORS = {
  NAVY: '#081429',
  YELLOW: '#fdb813',
  GRAY: '#373d41',
};

// Format currency to KRW
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount);
};

// Extract school level (초등/중등/고등) from school name and find matching salary setting
export const getSchoolLevelSalarySetting = (
  school: string | undefined,
  salaryItems: SalarySettingItem[]
): SalarySettingItem | undefined => {
  if (!school) return undefined;

  // Check if school name contains 초, 중, 고 (elementary, middle, high)
  if (school.includes('초등') || school.includes('초')) {
    return salaryItems.find(item => item.name === '초등' || item.name.includes('초등'));
  }
  if (school.includes('중학') || school.includes('중')) {
    return salaryItems.find(item => item.name === '중등' || item.name.includes('중등'));
  }
  if (school.includes('고등') || school.includes('고')) {
    return salaryItems.find(item => item.name === '고등' || item.name.includes('고등'));
  }

  return undefined;
};

// Get all days in a specific month
export const getDaysInMonth = (date: Date): Date[] => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const dateObj = new Date(year, month, 1);
  const days: Date[] = [];

  while (dateObj.getMonth() === month) {
    days.push(new Date(dateObj));
    dateObj.setDate(dateObj.getDate() + 1);
  }
  return days;
};

// Format date to YYYY-MM-DD for storage keys
export const formatDateKey = (date: Date): string => {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - offset * 60 * 1000);
  return adjustedDate.toISOString().split('T')[0];
};

// Format date for display (e.g., "12/01 (Mon)")
export const formatDateDisplay = (date: Date): { date: string; day: string; isWeekend: boolean } => {
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const dayOfWeek = date.getDay();

  return {
    date: `${month}/${day}`,
    day: dayNames[dayOfWeek],
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
  };
};

// Calculate the effective pay per class for a given setting item
export const calculateClassRate = (item: SalarySettingItem | undefined, academyFee: number): number => {
  if (!item) return 0;

  if (item.type === 'fixed') {
    return item.fixedRate;
  } else {
    // Formula: BaseTuition * (1 - AcademyFee/100) * (Ratio/100)
    const netTuition = item.baseTuition * (1 - academyFee / 100);
    return Math.round(netTuition * (item.ratio / 100));
  }
};

// Check if a specific date key (YYYY-MM-DD) is valid within student's start/end range
export const isDateValidForStudent = (dateKey: string, student: Student): boolean => {
  // startDate가 문자열이 아니면 항상 유효한 것으로 간주
  if (typeof student.startDate === 'string' && dateKey < student.startDate) return false;
  if (student.endDate && typeof student.endDate === 'string' && dateKey > student.endDate) return false;
  return true;
};

// Helper to determine student status based on Date Range (Badge Logic)
export const getStudentStatus = (student: Student, currentMonth: Date) => {
  const currentMonthStr = currentMonth.toISOString().slice(0, 7); // "YYYY-MM"

  // startDate가 문자열이 아니면 기본값 사용
  const startMonthStr = typeof student.startDate === 'string'
    ? student.startDate.slice(0, 7)
    : '1970-01';

  const endMonthStr = student.endDate && typeof student.endDate === 'string'
    ? student.endDate.slice(0, 7)
    : null;

  // Logic: Joined THIS month
  const isNew = startMonthStr === currentMonthStr;
  // Logic: Leaving THIS month
  const isLeaving = endMonthStr === currentMonthStr;

  return { isNew, isLeaving };
};

export const calculateStats = (
  allStudents: Student[], // Need ALL students to calculate dropped count correctly
  visibleStudents: Student[], // Only visible students for salary/attendance
  salaryConfig: SalaryConfig,
  currentMonth: Date
) => {
  let totalSalary = 0;
  let totalPresent = 0;
  let totalAbsent = 0;

  const newStudents: Student[] = [];

  const monthStr = currentMonth.toISOString().slice(0, 7); // "YYYY-MM"

  // Previous Month for Dropped Calculation
  const prevMonthDate = new Date(currentMonth);
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonthStr = prevMonthDate.toISOString().slice(0, 7);

  // 1. Calculate Statistics for VISIBLE (Active) Students
  const daysInMonth = getDaysInMonth(currentMonth);
  const todayKey = formatDateKey(new Date());

  visibleStudents.forEach(student => {
    // Check if student is NEW this month (startDate is in current month)
    const { isNew } = getStudentStatus(student, currentMonth);
    if (isNew) {
      newStudents.push(student);
    }

    // Salary Stats (Existing Logic)
    // We still need to iterate attendance records for salary calculation (based on units)
    const monthlyAttendance = Object.entries(student.attendance).filter(([dateKey]) =>
      dateKey.startsWith(monthStr) && isDateValidForStudent(dateKey, student)
    );

    let studentClassUnits = 0;
    // Calculate Salary & Actual Present Count
    monthlyAttendance.forEach(([_, value]) => {
      if (value > 0) {
        studentClassUnits += value;
        totalPresent++;
      }
      // Note: We don't count explicit '0' as absent for the *Rate* anymore, 
      // because we are comparing against the *Schedule*.
    });

    // Auto-match salary setting: First try explicit ID, then match from school name
    const settingItem = student.salarySettingId
      ? salaryConfig.items.find(item => item.id === student.salarySettingId)
      : getSchoolLevelSalarySetting(student.school, salaryConfig.items);
    const rate = calculateClassRate(settingItem, salaryConfig.academyFee);
    totalSalary += studentClassUnits * rate;

    // Attendance Rate Stats (New Logic: Based on Scheduled Days UP TO TODAY)
    // Count how many "Blue Dots" (Scheduled Days) this student has in this valid month range
    // BUT only count days that have already passed or are today.
    let studentScheduledCount = 0;

    daysInMonth.forEach(day => {
      const dateKey = formatDateKey(day);

      // 0. Exclude future dates (Tomorrow onwards)
      if (dateKey > todayKey) return;

      // 1. Must be valid date for student
      if (!isDateValidForStudent(dateKey, student)) return;

      // 2. Must be a scheduled day of week
      const { day: dayName } = formatDateDisplay(day);
      if (student.days && student.days.includes(dayName)) {
        studentScheduledCount++;
      }
    });

    // Add to total "Absent" bucket effectively to make the denominator correct
    // Denominator (Present + Absent) should equal Total Scheduled.
    // So, Current Absent = Total Scheduled - Total Present.
    // If a student attended more than scheduled (makeup classes), Absent contribution is 0 (or negative? No, let's clamp at 0).
    // Actually, if we want Rate = Present / Scheduled, and UI computes Present / (Present + Absent),
    // Then Absent must be (Scheduled - Present).
    // What if Present > Scheduled? Rate > 100%. 
    // Then Absent = Scheduled - Present would be negative. 
    // If UI sums them: Present + (Sched - Present) = Sched. Correct.
    // So simply add to a running total of Scheduled.
    // Wait, the UI uses `totalPresent + totalAbsent`.
    // Let's repurpose `totalAbsent` to be `totalScheduled - totalPresent`.
    // But since `totalPresent` is global sum, we should sum `studentScheduledCount` first.

    // Let's add a new property to stats? No, to avoid breaking UI changes in `AttendanceManager`,
    // I will adjust `totalAbsent` so that `totalPresent + totalAbsent` equals `totalScheduled`.
    // Exception: If `totalPresent` > `totalScheduled` globally, `totalAbsent` would be negative?
    // Let's just track `totalScheduled` and return it as `totalAbsent` is a bit hacking.

    // Better Approach: Calculate `totalScheduled`.
    // Then set `totalAbsent = Math.max(0, totalScheduled - totalPresent)`.
    // This caps Rate at 100% implicitly if used as P/(P+A) = P/S (if P<S).
    // If P > S, then A=0, Rate = P/P = 100%. (Loss of >100% info).
    // User wants "Rate against Scheduled".

    // To support >100% or true rate, I should change the UI computation in `AttendanceManager` too?
    // User asked "Change logic". 
    // Let's assume `totalAbsent` acts as "Remaining Scheduled" or "Missed".
    // I will accumulate `totalScheduled` and then derive `totalAbsent`.

    totalAbsent += studentScheduledCount;
  });

  // Correction: AttendanceManager calc is: totalPresent / (totalPresent + totalAbsent)
  // We want: totalPresent / totalScheduled
  // So we need (totalPresent + totalAbsent) == totalScheduled
  // => totalAbsent = totalScheduled - totalPresent
  // Let's apply this transformation.
  // Note: totalAbsent currently holds 'totalScheduled' from the loop above.
  const totalScheduled = totalAbsent; // Rename for clarity
  totalAbsent = Math.max(0, totalScheduled - totalPresent);

  // Now:
  // Denom = P + A = P + (S - P) = S. (If P <= S)
  // If P > S, A = 0. Denom = P. Rate = 100%.
  // This seems safe for a quick fix without changing UI component types.

  // 2. Calculate Dropped Students
  // Definition: endDate month was LAST MONTH.
  const droppedStudents = allStudents.filter(s => s.endDate && s.endDate.startsWith(prevMonthStr));

  // 3. Calculate Rates
  const newStudentsCount = newStudents.length;
  const droppedStudentsCount = droppedStudents.length;

  // Estimated Total Last Month = Current Total - New + Dropped
  const currentTotal = visibleStudents.length;
  const estimatedPrevTotal = currentTotal - newStudentsCount + droppedStudentsCount;

  let newStudentRate = 0;
  let droppedStudentRate = 0;

  if (estimatedPrevTotal > 0) {
    newStudentRate = Math.round((newStudentsCount / estimatedPrevTotal) * 100);
    droppedStudentRate = Math.round((droppedStudentsCount / estimatedPrevTotal) * 100);
  } else if (newStudentsCount > 0) {
    newStudentRate = 100; // If starting from 0
  }

  return {
    totalSalary,
    totalPresent,
    totalAbsent,
    newStudentsCount,
    droppedStudentsCount,
    newStudentRate,
    droppedStudentRate,
    newStudents, // Returned Array
    droppedStudents // Returned Array
  };
};

// Legacy color mapping for migration
const COLOR_MAP: Record<string, string> = {
  yellow: '#EAB308', // yellow-500
  orange: '#F97316', // orange-500
  pink: '#EC4899',   // pink-500
  purple: '#A855F7', // purple-500
  blue: '#3B82F6',   // blue-500
  teal: '#14B8A6',   // teal-500
  green: '#22C55E',  // green-500
};

export const resolveColor = (color: string) => {
  if (color.startsWith('#')) return color;
  return COLOR_MAP[color] || '#000000';
};

export const getBadgeStyle = (color: string) => {
  const hex = resolveColor(color);
  let bg = hex;
  let border = hex;

  if (hex.startsWith('#') && hex.length === 7) {
    bg = `${hex}1A`; // 10%
    border = `${hex}4D`; // 30%
  }

  return {
    color: hex,
    backgroundColor: bg,
    borderColor: border,
  };
};