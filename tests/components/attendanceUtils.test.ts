import {
  formatCurrency,
  getSchoolLevelSalarySetting,
  getDaysInMonth,
  formatDateKey,
  COLORS,
} from '../../components/Attendance/utils';

describe('Attendance utils', () => {
  describe('COLORS', () => {
    it('3가지 기본 색상 정의', () => {
      expect(COLORS.NAVY).toBe('#081429');
      expect(COLORS.YELLOW).toBe('#fdb813');
      expect(COLORS.GRAY).toBe('#373d41');
    });
  });

  describe('formatCurrency', () => {
    it('한국 원화 포맷', () => {
      const result = formatCurrency(300000);
      // ₩300,000 형태
      expect(result).toContain('300,000');
    });

    it('0원', () => {
      const result = formatCurrency(0);
      expect(result).toContain('0');
    });
  });

  describe('getSchoolLevelSalarySetting', () => {
    const salaryItems = [
      { id: '1', name: '초등', amount: 100000 },
      { id: '2', name: '중등', amount: 150000 },
      { id: '3', name: '고등', amount: 200000 },
    ] as any;

    it('초등학교 → 초등 설정', () => {
      expect(getSchoolLevelSalarySetting('OO초등학교', salaryItems)?.name).toBe('초등');
      expect(getSchoolLevelSalarySetting('초6', salaryItems)?.name).toBe('초등');
    });

    it('중학교 → 중등 설정', () => {
      expect(getSchoolLevelSalarySetting('OO중학교', salaryItems)?.name).toBe('중등');
    });

    it('고등학교 → 고등 설정', () => {
      expect(getSchoolLevelSalarySetting('OO고등학교', salaryItems)?.name).toBe('고등');
    });

    it('미정 → undefined', () => {
      expect(getSchoolLevelSalarySetting(undefined, salaryItems)).toBeUndefined();
      expect(getSchoolLevelSalarySetting('대학교', salaryItems)).toBeUndefined();
    });
  });

  describe('getDaysInMonth', () => {
    it('2026년 1월 = 31일', () => {
      const days = getDaysInMonth(new Date(2026, 0, 1));
      expect(days).toHaveLength(31);
    });

    it('2026년 2월 = 28일', () => {
      const days = getDaysInMonth(new Date(2026, 1, 1));
      expect(days).toHaveLength(28);
    });

    it('각 날짜 객체는 Date 인스턴스', () => {
      const days = getDaysInMonth(new Date(2026, 0, 1));
      expect(days[0]).toBeInstanceOf(Date);
      expect(days[0].getDate()).toBe(1);
      expect(days[30].getDate()).toBe(31);
    });
  });

  describe('formatDateKey', () => {
    it('YYYY-MM-DD 형식', () => {
      const result = formatDateKey(new Date(2026, 0, 15)); // 2026-01-15
      expect(result).toBe('2026-01-15');
    });

    it('월과 일이 한 자리일 때 0 패딩', () => {
      const result = formatDateKey(new Date(2026, 0, 5));
      expect(result).toBe('2026-01-05');
    });
  });
});
