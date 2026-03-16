import { formatReportContent } from '../../utils/formatReportContent';

describe('formatReportContent', () => {
  describe('배열 입력 (구버전 Firestore 데이터)', () => {
    it('배열 아이템을 줄바꿈으로 연결해야 함', () => {
      const input = ['항목1', '항목2', '항목3'];
      expect(formatReportContent(input)).toBe('- 항목1\n- 항목2\n- 항목3');
    });

    it('이미 -로 시작하는 아이템은 중복 접두사를 붙이지 않아야 함', () => {
      const input = ['- 이미 불릿', '추가 항목'];
      expect(formatReportContent(input)).toBe('- 이미 불릿\n- 추가 항목');
    });

    it('빈 항목을 필터링해야 함', () => {
      const input = ['항목1', '', '  ', '항목2'];
      expect(formatReportContent(input)).toBe('- 항목1\n- 항목2');
    });

    it('빈 배열은 빈 문자열을 반환해야 함', () => {
      expect(formatReportContent([])).toBe('');
    });
  });

  describe('줄바꿈이 있는 문자열 (새 녹음)', () => {
    it('줄바꿈이 있으면 트림 후 그대로 반환해야 함', () => {
      const input = '  - 항목1\n- 항목2\n- 항목3  ';
      expect(formatReportContent(input)).toBe('- 항목1\n- 항목2\n- 항목3');
    });
  });

  describe('쉼표 구분 불릿 (기존 데이터)', () => {
    it('",- " 패턴으로 분리해야 함', () => {
      const input = '- 항목1,- 항목2,- 항목3';
      expect(formatReportContent(input)).toBe('- 항목1\n- 항목2\n- 항목3');
    });

    it('쉼표와 공백이 있는 패턴도 처리해야 함', () => {
      const input = '- 항목1, - 항목2, - 항목3';
      expect(formatReportContent(input)).toBe('- 항목1\n- 항목2\n- 항목3');
    });
  });

  describe('비정상 입력', () => {
    it('null 입력은 빈 문자열을 반환해야 함', () => {
      expect(formatReportContent(null)).toBe('');
    });

    it('undefined 입력은 빈 문자열을 반환해야 함', () => {
      expect(formatReportContent(undefined)).toBe('');
    });

    it('숫자 입력은 문자열로 변환해야 함', () => {
      expect(formatReportContent(42)).toBe('42');
    });

    it('불릿 없는 단순 문자열은 그대로 반환해야 함', () => {
      expect(formatReportContent('단순 텍스트')).toBe('단순 텍스트');
    });
  });
});
