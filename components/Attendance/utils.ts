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
  if (dateKey < student.startDate) return false;
  if (student.endDate && dateKey > student.endDate) return false;
  return true;
};

// Helper to determine student status based on Date Range (Badge Logic)
export const getStudentStatus = (student: Student, currentMonth: Date) => {
  const currentMonthStr = currentMonth.toISOString().slice(0, 7); // "YYYY-MM"
  const startMonthStr = student.startDate.slice(0, 7);
  const endMonthStr = student.endDate ? student.endDate.slice(0, 7) : null;
  
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
  visibleStudents.forEach(student => {
    // Attendance Stats
    const monthlyAttendance = Object.entries(student.attendance).filter(([dateKey]) => 
      dateKey.startsWith(monthStr) && isDateValidForStudent(dateKey, student)
    );

    let studentClassUnits = 0;

    monthlyAttendance.forEach(([_, value]) => {
      if (value > 0) {
        studentClassUnits += value;
        totalPresent++; 
      } else if (value === 0) {
        totalAbsent++;
      }
    });

    // Salary Stats
    const settingItem = salaryConfig.items.find(item => item.id === student.salarySettingId);
    const rate = calculateClassRate(settingItem, salaryConfig.academyFee);
    totalSalary += studentClassUnits * rate;

    // New Student Count (Check Month part)
    if (student.startDate.startsWith(monthStr)) {
        newStudents.push(student);
    }
  });

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