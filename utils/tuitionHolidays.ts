// 수강료 계산기용 공휴일 유틸리티

// 한국 공휴일 데이터 (2024-2028 fallback)
export const KOREAN_HOLIDAYS: { [year: number]: string[] } = {
  2024: [
    '2024-01-01', '2024-02-09', '2024-02-10', '2024-02-11', '2024-02-12',
    '2024-03-01', '2024-04-10', '2024-05-05', '2024-05-06', '2024-05-15',
    '2024-06-06', '2024-08-15', '2024-09-16', '2024-09-17', '2024-09-18',
    '2024-10-03', '2024-10-09', '2024-12-25',
  ],
  2025: [
    '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30',
    '2025-03-01', '2025-03-03', '2025-05-05', '2025-05-06',
    '2025-06-06', '2025-08-15', '2025-10-03', '2025-10-05',
    '2025-10-06', '2025-10-07', '2025-10-08', '2025-10-09', '2025-12-25',
  ],
  2026: [
    '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18',
    '2026-03-01', '2026-03-02', '2026-05-05', '2026-05-24', '2026-05-25',
    '2026-06-06', '2026-08-15', '2026-08-17', '2026-09-24', '2026-09-25',
    '2026-09-26', '2026-10-03', '2026-10-05', '2026-10-09', '2026-12-25',
  ],
  2027: [
    '2027-01-01', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09',
    '2027-03-01', '2027-05-05', '2027-05-13', '2027-06-06', '2027-06-07',
    '2027-08-15', '2027-08-16', '2027-09-14', '2027-09-15', '2027-09-16',
    '2027-10-03', '2027-10-04', '2027-10-09', '2027-12-25',
  ],
  2028: [
    '2028-01-01', '2028-01-25', '2028-01-26', '2028-01-27',
    '2028-03-01', '2028-05-02', '2028-05-05', '2028-06-06',
    '2028-08-15', '2028-10-02', '2028-10-03', '2028-10-04',
    '2028-10-09', '2028-12-25',
  ],
  2029: [
    '2029-01-01', '2029-02-12', '2029-02-13', '2029-02-14',
    '2029-03-01', '2029-05-05', '2029-05-20', '2029-05-21',
    '2029-06-06', '2029-08-15', '2029-09-21', '2029-09-22',
    '2029-09-23', '2029-09-24', '2029-10-03', '2029-10-09', '2029-12-25',
  ],
  2030: [
    '2030-01-01', '2030-02-02', '2030-02-03', '2030-02-04',
    '2030-03-01', '2030-05-05', '2030-05-06', '2030-05-09',
    '2030-06-06', '2030-08-15', '2030-09-11', '2030-09-12',
    '2030-09-13', '2030-10-03', '2030-10-09', '2030-12-25',
  ],
};

// Set 기반 공휴일 확인
export const buildHolidaySet = (firebaseHolidays?: string[]): Set<string> => {
  if (firebaseHolidays && firebaseHolidays.length > 0) {
    return new Set(firebaseHolidays);
  }
  // Firebase 데이터 없으면 하드코딩 fallback
  const all: string[] = [];
  for (const dates of Object.values(KOREAN_HOLIDAYS)) {
    all.push(...dates);
  }
  return new Set(all);
};

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isHolidayDate = (date: Date, holidaySet: Set<string>): boolean => {
  return holidaySet.has(formatLocalDate(date));
};

const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const getHolidaysInRange = (
  startDate: string,
  endDate: string,
  holidaySet: Set<string>,
): string[] => {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const holidays: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    const ds = formatLocalDate(current);
    if (holidaySet.has(ds)) holidays.push(ds);
    current.setDate(current.getDate() + 1);
  }
  return holidays;
};

export const getHolidayName = (dateStr: string): string => {
  const names: Record<string, string> = {
    '01-01': '신정', '03-01': '삼일절', '05-05': '어린이날',
    '06-06': '현충일', '08-15': '광복절', '10-03': '개천절',
    '10-09': '한글날', '12-25': '성탄절',
  };
  return names[dateStr.slice(5)] || '공휴일';
};
