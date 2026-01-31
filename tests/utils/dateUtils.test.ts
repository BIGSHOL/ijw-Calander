import {
  getTodayKST,
  getNowKST,
  formatDateKST,
  getMonthRangeKST,
  getWeekRangeKST,
  getMonthWeeks,
  formatDateKey,
  getEventsForCell,
  getEventPositionInWeek,
  getWeekdayFromDate,
  isDateInRange,
} from '../../utils/dateUtils';

describe('dateUtils', () => {
  describe('formatDateKey', () => {
    it('should format date as YYYY-MM-DD', () => {
      expect(formatDateKey(new Date(2026, 0, 15))).toBe('2026-01-15');
      expect(formatDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
    });
  });

  describe('getTodayKST', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return KST date string in YYYY-MM-DD format', () => {
      // Set system time to 2026-01-15 00:00:00 UTC
      vi.setSystemTime(new Date('2026-01-15T00:00:00Z'));
      const result = getTodayKST();
      // At UTC midnight, KST is 09:00 → still Jan 15 in KST
      expect(result).toBe('2026-01-15');
    });

    it('should handle date boundary (UTC late night → KST next day)', () => {
      // 2026-01-15 23:00 UTC → 2026-01-16 08:00 KST
      vi.setSystemTime(new Date('2026-01-15T23:00:00Z'));
      const result = getTodayKST();
      expect(result).toBe('2026-01-16');
    });
  });

  describe('getNowKST', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return a Date object in KST', () => {
      vi.setSystemTime(new Date('2026-01-15T00:00:00Z'));
      const result = getNowKST();
      expect(result).toBeInstanceOf(Date);
      // KST is UTC+9, so hours should be 9
      expect(result.getHours()).toBe(9);
    });
  });

  describe('formatDateKST', () => {
    it('should convert UTC date to KST formatted string', () => {
      const utcDate = new Date('2026-01-15T00:00:00Z');
      const result = formatDateKST(utcDate);
      expect(result).toBe('2026-01-15');
    });

    it('should handle date boundary correctly', () => {
      const utcDate = new Date('2026-01-15T20:00:00Z');
      const result = formatDateKST(utcDate);
      // 20:00 UTC + 9 = 05:00 next day KST
      expect(result).toBe('2026-01-16');
    });
  });

  describe('getMonthRangeKST', () => {
    it('should return month start and end', () => {
      const date = new Date(2026, 0, 15); // Jan 15, 2026
      const result = getMonthRangeKST(date);
      expect(result.start).toBe('2026-01-01');
      expect(result.end).toBe('2026-01-31');
    });

    it('should handle February', () => {
      const date = new Date(2026, 1, 10); // Feb 10, 2026
      const result = getMonthRangeKST(date);
      expect(result.start).toBe('2026-02-01');
      expect(result.end).toBe('2026-02-28');
    });
  });

  describe('getWeekRangeKST', () => {
    it('should return Sunday-based week range', () => {
      // 2026-01-15 is Thursday
      const date = new Date(2026, 0, 15);
      const result = getWeekRangeKST(date);
      expect(result.start).toBe('2026-01-11'); // Sunday
      expect(result.end).toBe('2026-01-17');   // Saturday
    });

    it('should handle Sunday itself', () => {
      // 2026-01-11 is Sunday
      const date = new Date(2026, 0, 11);
      const result = getWeekRangeKST(date);
      expect(result.start).toBe('2026-01-11');
      expect(result.end).toBe('2026-01-17');
    });
  });

  describe('getMonthWeeks', () => {
    it('should return weeks for a month', () => {
      const date = new Date(2026, 0, 1); // January 2026
      const weeks = getMonthWeeks(date);

      // Each week should have 7 days
      weeks.forEach(week => {
        expect(week.length).toBe(7);
      });

      // First day of first week should be Sunday
      expect(weeks[0][0].getDay()).toBe(0);

      // Should contain Jan 1
      const allDates = weeks.flat();
      const hasJan1 = allDates.some(d => d.getMonth() === 0 && d.getDate() === 1);
      expect(hasJan1).toBe(true);
    });

    it('should cover entire month', () => {
      const date = new Date(2026, 0, 1);
      const weeks = getMonthWeeks(date);
      const allDates = weeks.flat();

      // Should contain Jan 31
      const hasJan31 = allDates.some(d => d.getMonth() === 0 && d.getDate() === 31);
      expect(hasJan31).toBe(true);
    });
  });

  describe('getEventsForCell', () => {
    const events = [
      {
        id: '1',
        departmentId: 'dept1',
        startDate: '2026-01-10',
        endDate: '2026-01-15',
      },
      {
        id: '2',
        departmentId: 'dept1',
        startDate: '2026-01-20',
        endDate: '2026-01-25',
      },
      {
        id: '3',
        departmentId: 'dept2',
        startDate: '2026-01-10',
        endDate: '2026-01-15',
      },
    ];

    it('should return events matching department and date', () => {
      const date = new Date(2026, 0, 12); // Jan 12
      const result = getEventsForCell(events, date, 'dept1');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
    });

    it('should exclude events from other departments', () => {
      const date = new Date(2026, 0, 12);
      const result = getEventsForCell(events, date, 'dept2');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('3');
    });

    it('should return empty for no matching events', () => {
      const date = new Date(2026, 0, 18);
      const result = getEventsForCell(events, date, 'dept1');
      expect(result.length).toBe(0);
    });

    it('should handle events with missing dates', () => {
      const badEvents = [{ id: '1', departmentId: 'dept1', startDate: null, endDate: null }];
      const result = getEventsForCell(badEvents, new Date(2026, 0, 12), 'dept1');
      expect(result.length).toBe(0);
    });
  });

  describe('getEventPositionInWeek', () => {
    it('should calculate position for single-day event', () => {
      const event = { startDate: '2026-01-15', endDate: '2026-01-15' };
      const weekStart = new Date(2026, 0, 11); // Sunday
      const weekEnd = new Date(2026, 0, 17);   // Saturday

      const result = getEventPositionInWeek(event, weekStart, weekEnd);
      // Thursday = day index 4, +2 = col 6
      expect(result.colStart).toBe(6);
      expect(result.colSpan).toBe(1);
      expect(result.isStart).toBe(true);
      expect(result.isEnd).toBe(true);
    });

    it('should handle missing dates gracefully', () => {
      const event = { startDate: null, endDate: null };
      const weekStart = new Date(2026, 0, 11);
      const weekEnd = new Date(2026, 0, 17);

      const result = getEventPositionInWeek(event, weekStart, weekEnd);
      expect(result.colStart).toBe(2);
      expect(result.colSpan).toBe(1);
    });
  });

  describe('getWeekdayFromDate', () => {
    it('should return Korean weekday', () => {
      // 2026-01-19 is Monday
      const result = getWeekdayFromDate('2026-01-19');
      expect(result).toContain('월');
    });

    it('should return Sunday for 2026-01-18', () => {
      const result = getWeekdayFromDate('2026-01-18');
      expect(result).toContain('일');
    });
  });

  describe('isDateInRange', () => {
    it('should return true for date within range', () => {
      expect(isDateInRange('2026-01-15', '2026-01-01', '2026-01-31')).toBe(true);
    });

    it('should return true for date at boundaries', () => {
      expect(isDateInRange('2026-01-01', '2026-01-01', '2026-01-31')).toBe(true);
      expect(isDateInRange('2026-01-31', '2026-01-01', '2026-01-31')).toBe(true);
    });

    it('should return false for date outside range', () => {
      expect(isDateInRange('2026-02-01', '2026-01-01', '2026-01-31')).toBe(false);
      expect(isDateInRange('2025-12-31', '2026-01-01', '2026-01-31')).toBe(false);
    });

    it('should handle no start date', () => {
      expect(isDateInRange('2026-01-15', undefined, '2026-01-31')).toBe(true);
    });

    it('should handle no end date', () => {
      expect(isDateInRange('2026-01-15', '2026-01-01', undefined)).toBe(true);
    });

    it('should handle no boundaries', () => {
      expect(isDateInRange('2026-01-15', undefined, undefined)).toBe(true);
    });
  });
});
