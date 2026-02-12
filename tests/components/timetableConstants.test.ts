import {
  convertLegacyPeriodId,
  convertToLegacyPeriodId,
  getPeriodTime,
  getPeriodLabel,
  getPeriodInfo,
  formatScheduleCompact,
  formatScheduleDetailed,
  MATH_PERIOD_INFO,
  ENGLISH_PERIOD_INFO,
  MATH_PERIOD_GROUPS,
  LEGACY_TO_UNIFIED_PERIOD_MAP,
  ALL_WEEKDAYS,
} from '../../components/Timetable/constants';

describe('Timetable constants', () => {
  describe('convertLegacyPeriodId', () => {
    it('레거시 ID 변환: 1-1 → 1, 2-2 → 4', () => {
      expect(convertLegacyPeriodId('1-1')).toBe('1');
      expect(convertLegacyPeriodId('1-2')).toBe('2');
      expect(convertLegacyPeriodId('2-1')).toBe('3');
      expect(convertLegacyPeriodId('2-2')).toBe('4');
      expect(convertLegacyPeriodId('4-2')).toBe('8');
    });

    it('이미 통일된 ID는 그대로', () => {
      expect(convertLegacyPeriodId('1')).toBe('1');
      expect(convertLegacyPeriodId('5')).toBe('5');
    });

    it('알 수 없는 ID는 그대로 반환', () => {
      expect(convertLegacyPeriodId('unknown')).toBe('unknown');
    });
  });

  describe('convertToLegacyPeriodId', () => {
    it('통일 → 레거시: 1 → 1-1, 4 → 2-2', () => {
      expect(convertToLegacyPeriodId('1')).toBe('1-1');
      expect(convertToLegacyPeriodId('4')).toBe('2-2');
      expect(convertToLegacyPeriodId('8')).toBe('4-2');
    });

    it('알 수 없는 ID는 그대로', () => {
      expect(convertToLegacyPeriodId('10')).toBe('10');
    });
  });

  describe('getPeriodTime', () => {
    it('수학 기본', () => {
      expect(getPeriodTime('1')).toBe('14:30~15:25');
      expect(getPeriodTime('8')).toBe('21:05~22:00');
    });

    it('영어 과목 지정', () => {
      expect(getPeriodTime('1', 'english')).toBe('14:20~15:00');
      expect(getPeriodTime('10', 'english')).toBe('21:05~22:00');
    });

    it('없는 교시 → 빈 문자열', () => {
      expect(getPeriodTime('99')).toBe('');
    });
  });

  describe('getPeriodLabel', () => {
    it('교시 라벨 반환', () => {
      expect(getPeriodLabel('1')).toBe('1교시');
      expect(getPeriodLabel('4')).toBe('4교시');
    });

    it('없는 교시 → fallback', () => {
      expect(getPeriodLabel('99')).toBe('99교시');
    });
  });

  describe('getPeriodInfo', () => {
    it('과목별 교시 정보 반환', () => {
      const mathInfo = getPeriodInfo('1', 'math');
      expect(mathInfo?.time).toBe('14:30~15:25');

      const engInfo = getPeriodInfo('1', 'english');
      expect(engInfo?.time).toBe('14:20~15:00');
    });

    it('없는 교시 → undefined', () => {
      expect(getPeriodInfo('99')).toBeUndefined();
    });
  });

  describe('formatScheduleCompact', () => {
    it('빈 스케줄 → 시간 미정', () => {
      expect(formatScheduleCompact([])).toBe('시간 미정');
    });

    it('수학: 완전한 교시 단위 (7+8 = 4교시)', () => {
      const result = formatScheduleCompact(['월 7', '월 8']);
      expect(result).toBe('월 4교시');
    });

    it('수학: 여러 요일 같은 패턴 합침', () => {
      const result = formatScheduleCompact(['월 7', '월 8', '목 7', '목 8']);
      expect(result).toBe('월목 4교시');
    });

    it('영어: 연속 교시 범위 표시', () => {
      const result = formatScheduleCompact(['월 1', '월 2', '월 3'], 'english');
      expect(result).toBe('월 1~3교시');
    });

    it('영어: 단일 교시', () => {
      const result = formatScheduleCompact(['월 5'], 'english');
      expect(result).toBe('월 5교시');
    });
  });

  describe('formatScheduleDetailed', () => {
    it('빈 스케줄 → 시간 미정', () => {
      expect(formatScheduleDetailed([])).toBe('시간 미정');
    });

    it('수학 상세 시간 포맷', () => {
      const result = formatScheduleDetailed(['월 7', '월 8']);
      expect(result).toContain('20:10~21:05');
      expect(result).toContain('21:05~22:00');
    });
  });

  describe('MATH_PERIOD_GROUPS', () => {
    it('8교시 → 4그룹 매핑', () => {
      expect(MATH_PERIOD_GROUPS['1']).toEqual({ group: 1, position: 'first' });
      expect(MATH_PERIOD_GROUPS['2']).toEqual({ group: 1, position: 'second' });
      expect(MATH_PERIOD_GROUPS['7']).toEqual({ group: 4, position: 'first' });
    });
  });

  describe('ALL_WEEKDAYS', () => {
    it('7일', () => {
      expect(ALL_WEEKDAYS).toHaveLength(7);
      expect(ALL_WEEKDAYS[0]).toBe('월');
      expect(ALL_WEEKDAYS[6]).toBe('일');
    });
  });
});
