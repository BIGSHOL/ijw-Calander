import { getSubjectTheme } from '../../components/Timetable/Math/utils/gridUtils';

// gridUtils의 나머지 함수들은 TimetableClass 타입과 constants에 의존하므로
// getSubjectTheme만 단독 테스트합니다.

describe('gridUtils', () => {
  describe('getSubjectTheme', () => {
    it('수학 → 파랑 계열', () => {
      const theme = getSubjectTheme('수학');
      expect(theme.bg).toContain('blue');
      expect(theme.header).toContain('blue');
    });

    it('영어 → 분홍 계열', () => {
      const theme = getSubjectTheme('영어');
      expect(theme.bg).toContain('rose');
    });

    it('국어 → 초록 계열', () => {
      const theme = getSubjectTheme('국어');
      expect(theme.bg).toContain('green');
    });

    it('과학 → 보라 계열', () => {
      const theme = getSubjectTheme('과학');
      expect(theme.bg).toContain('purple');
    });

    it('기타 → 회색 계열', () => {
      const theme = getSubjectTheme('기타');
      expect(theme.bg).toContain('gray');
    });
  });
});
