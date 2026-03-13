import {
  KOREAN_HOLIDAYS,
  buildHolidaySet,
  isHolidayDate,
  getHolidaysInRange,
  getHolidayName,
} from '../../utils/tuitionHolidays';

describe('tuitionHolidays', () => {
  describe('KOREAN_HOLIDAYS', () => {
    it('2024~2030년 데이터가 포함되어 있다', () => {
      expect(KOREAN_HOLIDAYS[2024]).toBeDefined();
      expect(KOREAN_HOLIDAYS[2025]).toBeDefined();
      expect(KOREAN_HOLIDAYS[2026]).toBeDefined();
      expect(KOREAN_HOLIDAYS[2030]).toBeDefined();
    });

    it('각 연도의 1월 1일(신정)이 포함되어 있다', () => {
      [2024, 2025, 2026, 2027, 2028, 2029, 2030].forEach(year => {
        expect(KOREAN_HOLIDAYS[year]).toContain(`${year}-01-01`);
      });
    });

    it('각 연도의 12월 25일(성탄절)이 포함되어 있다', () => {
      [2024, 2025, 2026, 2027, 2028, 2029, 2030].forEach(year => {
        expect(KOREAN_HOLIDAYS[year]).toContain(`${year}-12-25`);
      });
    });

    it('각 연도의 삼일절(03-01)이 포함되어 있다', () => {
      [2024, 2025, 2026, 2027, 2028, 2029, 2030].forEach(year => {
        expect(KOREAN_HOLIDAYS[year]).toContain(`${year}-03-01`);
      });
    });
  });

  describe('buildHolidaySet', () => {
    it('Firebase 공휴일 데이터가 있으면 해당 Set을 반환한다', () => {
      // Given: Firebase에서 공휴일 데이터를 제공받으면
      const firebaseHolidays = ['2026-01-01', '2026-03-01', '2026-12-25'];

      // When: buildHolidaySet을 호출하면
      const result = buildHolidaySet(firebaseHolidays);

      // Then: Firebase 데이터 기반 Set이 반환된다
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(3);
      expect(result.has('2026-01-01')).toBe(true);
      expect(result.has('2026-03-01')).toBe(true);
    });

    it('Firebase 데이터가 없으면 하드코딩 fallback을 사용한다', () => {
      // Given: Firebase 데이터가 없을 때
      const result = buildHolidaySet();

      // Then: 하드코딩된 전체 공휴일 Set이 반환된다
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBeGreaterThan(0);
      expect(result.has('2026-01-01')).toBe(true);
      expect(result.has('2025-12-25')).toBe(true);
    });

    it('빈 배열이 전달되면 fallback을 사용한다', () => {
      // Given: 빈 배열이 전달되면
      const result = buildHolidaySet([]);

      // Then: fallback 데이터를 사용한다
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('isHolidayDate', () => {
    const holidaySet = new Set(['2026-03-01', '2026-05-05', '2026-08-15']);

    it('공휴일인 날짜는 true를 반환한다', () => {
      // Given: 삼일절 날짜를 입력하면
      const date = new Date(2026, 2, 1); // 2026-03-01

      // Then: true를 반환한다
      expect(isHolidayDate(date, holidaySet)).toBe(true);
    });

    it('공휴일이 아닌 날짜는 false를 반환한다', () => {
      // Given: 평일 날짜를 입력하면
      const date = new Date(2026, 2, 2); // 2026-03-02

      // Then: false를 반환한다
      expect(isHolidayDate(date, holidaySet)).toBe(false);
    });

    it('빈 Set에서는 모든 날짜가 false를 반환한다', () => {
      expect(isHolidayDate(new Date(2026, 0, 1), new Set())).toBe(false);
    });
  });

  describe('getHolidaysInRange', () => {
    const holidaySet = buildHolidaySet();

    it('범위 내 공휴일 목록을 반환한다', () => {
      // Given: 2026년 3월 범위를 조회하면
      const result = getHolidaysInRange('2026-03-01', '2026-03-31', holidaySet);

      // Then: 삼일절(03-01)과 대체공휴일(03-02)이 포함된다
      expect(result).toContain('2026-03-01');
      expect(result).toContain('2026-03-02');
    });

    it('범위 내 공휴일이 없으면 빈 배열을 반환한다', () => {
      // Given: 공휴일이 없는 날짜 범위를 조회하면
      const emptySet = new Set<string>();
      const result = getHolidaysInRange('2026-04-01', '2026-04-30', emptySet);

      // Then: 빈 배열이 반환된다
      expect(result).toEqual([]);
    });

    it('단일 날짜 범위에서 해당 날짜가 공휴일이면 반환한다', () => {
      // Given: 신정 하루만 조회하면
      const result = getHolidaysInRange('2026-01-01', '2026-01-01', holidaySet);

      // Then: 신정이 반환된다
      expect(result).toEqual(['2026-01-01']);
    });

    it('시작일이 종료일보다 늦으면 빈 배열을 반환한다', () => {
      // Given: 시작일 > 종료일이면
      const result = getHolidaysInRange('2026-12-31', '2026-01-01', holidaySet);

      // Then: 빈 배열이 반환된다
      expect(result).toEqual([]);
    });

    it('반환된 날짜들이 모두 범위 내에 있다', () => {
      // Given: 2026년 5월 범위를 조회하면
      const result = getHolidaysInRange('2026-05-01', '2026-05-31', holidaySet);

      // Then: 모든 날짜가 범위 내에 있다
      result.forEach(dateStr => {
        expect(dateStr >= '2026-05-01').toBe(true);
        expect(dateStr <= '2026-05-31').toBe(true);
      });
    });
  });

  describe('getHolidayName', () => {
    it('신정(01-01)의 이름을 반환한다', () => {
      expect(getHolidayName('2026-01-01')).toBe('신정');
    });

    it('삼일절(03-01)의 이름을 반환한다', () => {
      expect(getHolidayName('2026-03-01')).toBe('삼일절');
    });

    it('어린이날(05-05)의 이름을 반환한다', () => {
      expect(getHolidayName('2026-05-05')).toBe('어린이날');
    });

    it('현충일(06-06)의 이름을 반환한다', () => {
      expect(getHolidayName('2026-06-06')).toBe('현충일');
    });

    it('광복절(08-15)의 이름을 반환한다', () => {
      expect(getHolidayName('2026-08-15')).toBe('광복절');
    });

    it('개천절(10-03)의 이름을 반환한다', () => {
      expect(getHolidayName('2026-10-03')).toBe('개천절');
    });

    it('한글날(10-09)의 이름을 반환한다', () => {
      expect(getHolidayName('2026-10-09')).toBe('한글날');
    });

    it('성탄절(12-25)의 이름을 반환한다', () => {
      expect(getHolidayName('2026-12-25')).toBe('성탄절');
    });

    it('등록되지 않은 날짜는 "공휴일"을 반환한다', () => {
      // Given: 설날 같은 변동 공휴일은 이름 맵에 없으므로
      expect(getHolidayName('2026-02-16')).toBe('공휴일');
    });
  });
});
