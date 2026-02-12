import { normalizeMonth } from '../../hooks/useBilling';

describe('useBilling 헬퍼', () => {
  describe('normalizeMonth', () => {
    it('6자리 숫자를 YYYY-MM 형식으로 변환', () => {
      expect(normalizeMonth('202601')).toBe('2026-01');
      expect(normalizeMonth('202512')).toBe('2025-12');
    });

    it('이미 YYYY-MM 형식이면 그대로 반환', () => {
      expect(normalizeMonth('2026-01')).toBe('2026-01');
      expect(normalizeMonth('2025-12')).toBe('2025-12');
    });

    it('숫자 입력도 처리', () => {
      expect(normalizeMonth(202601)).toBe('2026-01');
    });

    it('기타 형식은 그대로 반환', () => {
      expect(normalizeMonth('2026')).toBe('2026');
      expect(normalizeMonth('20260101')).toBe('20260101');
    });
  });
});
