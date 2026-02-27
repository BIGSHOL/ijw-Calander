import { convertTimestampToDate } from '../../utils/firestoreConverters';

describe('firestoreConverters 유틸리티', () => {
  describe('convertTimestampToDate', () => {
    it('null을 전달하면 undefined를 반환한다', () => {
      expect(convertTimestampToDate(null)).toBeUndefined();
    });

    it('undefined를 전달하면 undefined를 반환한다', () => {
      expect(convertTimestampToDate(undefined)).toBeUndefined();
    });

    it('빈 문자열을 전달하면 undefined를 반환한다', () => {
      // 빈 문자열은 falsy이므로 undefined 반환
      expect(convertTimestampToDate('')).toBeUndefined();
    });

    it('YYYY-MM-DD 형식의 문자열은 그대로 반환한다', () => {
      // Given: 이미 날짜 문자열 형식
      const dateStr = '2026-01-15';

      // When
      const result = convertTimestampToDate(dateStr);

      // Then
      expect(result).toBe('2026-01-15');
    });

    it('임의의 문자열은 그대로 반환한다', () => {
      // Given: 날짜 형식이 아닌 문자열도 string이면 그대로 반환
      const str = '2026/01/15';

      // When
      const result = convertTimestampToDate(str);

      // Then
      expect(result).toBe('2026/01/15');
    });

    it('toDate() 메서드를 가진 Firestore Timestamp 객체를 YYYY-MM-DD로 변환한다', () => {
      // Given: Firestore Timestamp mock (toDate()가 로컬 Date를 반환)
      const mockTimestamp = {
        toDate: () => new Date(2026, 0, 15), // 2026-01-15 (로컬 시간)
      };

      // When
      const result = convertTimestampToDate(mockTimestamp);

      // Then
      expect(result).toBe('2026-01-15');
    });

    it('Firestore Timestamp가 연도/월/일을 올바르게 포맷한다', () => {
      // Given: 월과 일이 한 자리인 경우 (zero-padding 확인)
      const mockTimestamp = {
        toDate: () => new Date(2026, 2, 5), // 2026-03-05 (로컬 시간)
      };

      // When
      const result = convertTimestampToDate(mockTimestamp);

      // Then
      expect(result).toBe('2026-03-05');
    });

    it('Firestore Timestamp가 12월 31일을 올바르게 포맷한다', () => {
      // Given: 연말 날짜
      const mockTimestamp = {
        toDate: () => new Date(2026, 11, 31), // 2026-12-31
      };

      // When
      const result = convertTimestampToDate(mockTimestamp);

      // Then
      expect(result).toBe('2026-12-31');
    });

    it('toDate() 메서드가 없는 객체는 undefined를 반환한다', () => {
      // Given: Timestamp 형태가 아닌 객체
      const nonTimestamp = { seconds: 1700000000, nanoseconds: 0 };

      // When
      const result = convertTimestampToDate(nonTimestamp);

      // Then
      expect(result).toBeUndefined();
    });

    it('숫자 0은 falsy이므로 undefined를 반환한다', () => {
      expect(convertTimestampToDate(0)).toBeUndefined();
    });

    it('false는 falsy이므로 undefined를 반환한다', () => {
      expect(convertTimestampToDate(false)).toBeUndefined();
    });

    it('반환값은 항상 YYYY-MM-DD 형식이다', () => {
      // Given: 여러 날짜를 검증
      const testCases = [
        { date: new Date(2026, 0, 1), expected: '2026-01-01' },
        { date: new Date(2026, 5, 15), expected: '2026-06-15' },
        { date: new Date(2025, 11, 31), expected: '2025-12-31' },
      ];

      testCases.forEach(({ date, expected }) => {
        const mockTimestamp = { toDate: () => date };
        const result = convertTimestampToDate(mockTimestamp);
        expect(result).toBe(expected);
        // YYYY-MM-DD 정규식 패턴 검증
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });
});
