import {
  validateScenarioData,
  calculateScenarioStats,
  generateScenarioId,
  countScenarioDocuments,
} from '../../components/Timetable/English/scenarioUtils';

describe('scenarioUtils', () => {
  describe('validateScenarioData', () => {
    it('null → invalid', () => {
      expect(validateScenarioData(null)).toEqual({ isValid: false, error: '시나리오 데이터가 없습니다.' });
    });

    it('id 없음 → invalid', () => {
      expect(validateScenarioData({})).toEqual({ isValid: false, error: '시나리오 ID가 없습니다.' });
    });

    it('createdAt 없음 → invalid', () => {
      expect(validateScenarioData({ id: '1' })).toEqual({
        isValid: false,
        error: '생성 날짜 정보가 없습니다.',
      });
    });

    it('version 2 - classes 필수', () => {
      const result = validateScenarioData({ id: '1', createdAt: '2026-01-01', version: 2 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('classes');
    });

    it('version 2 - classes 있으면 valid', () => {
      const result = validateScenarioData({
        id: '1',
        createdAt: '2026-01-01',
        version: 2,
        classes: {},
      });
      expect(result.isValid).toBe(true);
    });

    it('version 2 - enrollments 손상', () => {
      const result = validateScenarioData({
        id: '1',
        createdAt: '2026-01-01',
        version: 2,
        classes: {},
        enrollments: 'invalid',
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('enrollments');
    });

    it('version 1 - data 필수', () => {
      const result = validateScenarioData({ id: '1', createdAt: '2026-01-01' });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('시간표 데이터');
    });

    it('version 1 - data 있으면 valid', () => {
      const result = validateScenarioData({
        id: '1',
        createdAt: '2026-01-01',
        data: { doc1: {} },
      });
      expect(result.isValid).toBe(true);
    });

    it('version 1 - studentData 손상', () => {
      const result = validateScenarioData({
        id: '1',
        createdAt: '2026-01-01',
        data: {},
        studentData: 'invalid',
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('calculateScenarioStats', () => {
    it('빈 데이터', () => {
      expect(calculateScenarioStats({}, {})).toEqual({
        timetableDocCount: 0,
        classCount: 0,
        studentCount: 0,
      });
    });

    it('문서 수와 학생 수 계산', () => {
      const data = { teacher1: {}, teacher2: {} };
      const studentData = {
        class1: {
          students: [
            { name: '홍길동' },
            { name: '김영희', onHold: true },  // 제외
            { name: '이철수', withdrawn: true }, // 제외
          ],
        },
        class2: {
          students: [{ name: '박민수' }],
        },
      };

      const stats = calculateScenarioStats(data, studentData);
      expect(stats.timetableDocCount).toBe(2);
      expect(stats.classCount).toBe(2);
      expect(stats.studentCount).toBe(2); // onHold, withdrawn 제외
    });
  });

  describe('generateScenarioId', () => {
    it('scenario_ 접두사', () => {
      const id = generateScenarioId();
      expect(id).toMatch(/^scenario_\d+$/);
    });

    it('고유 ID 생성 (시간차)', async () => {
      const id1 = generateScenarioId();
      await new Promise(r => setTimeout(r, 2)); // Date.now() 차이 보장
      const id2 = generateScenarioId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('countScenarioDocuments', () => {
    it('data + studentData 문서 수 합산', () => {
      const scenario = {
        data: { a: {}, b: {} },
        studentData: { c: {}, d: {}, e: {} },
      } as any;
      expect(countScenarioDocuments(scenario)).toBe(5);
    });

    it('빈 데이터', () => {
      expect(countScenarioDocuments({} as any)).toBe(0);
    });
  });
});
