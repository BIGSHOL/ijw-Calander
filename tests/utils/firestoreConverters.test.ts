import { convertTimestampToDate } from '../../utils/firestoreConverters';

describe('firestoreConverters', () => {
  describe('convertTimestampToDate', () => {
    it('returns undefined for null/undefined', () => {
      expect(convertTimestampToDate(null)).toBeUndefined();
      expect(convertTimestampToDate(undefined)).toBeUndefined();
      expect(convertTimestampToDate('')).toBeUndefined();
    });

    it('returns string as-is', () => {
      expect(convertTimestampToDate('2026-02-26')).toBe('2026-02-26');
      expect(convertTimestampToDate('2025-12-31')).toBe('2025-12-31');
    });

    it('converts Firestore Timestamp-like object to YYYY-MM-DD', () => {
      const mockTimestamp = {
        toDate: () => new Date(2026, 1, 26), // 2026-02-26
      };
      expect(convertTimestampToDate(mockTimestamp)).toBe('2026-02-26');
    });

    it('uses local timezone (not UTC) for Timestamp conversion', () => {
      // 자정 직후 KST → UTC 기준 전날이지만 로컬 기준 오늘이어야 함
      const mockTimestamp = {
        toDate: () => new Date(2026, 0, 15, 0, 30, 0), // 2026-01-15 00:30 로컬
      };
      expect(convertTimestampToDate(mockTimestamp)).toBe('2026-01-15');
    });

    it('returns undefined for non-timestamp objects', () => {
      expect(convertTimestampToDate(42)).toBeUndefined();
      expect(convertTimestampToDate({ foo: 'bar' })).toBeUndefined();
      expect(convertTimestampToDate([])).toBeUndefined();
    });

    it('handles single-digit month/day with zero padding', () => {
      const mockTimestamp = {
        toDate: () => new Date(2026, 0, 5), // 2026-01-05
      };
      expect(convertTimestampToDate(mockTimestamp)).toBe('2026-01-05');
    });
  });
});
