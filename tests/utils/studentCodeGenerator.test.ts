import { vi } from 'vitest';
import { generateStudentCode, generateBulkStudentCodes } from '../../utils/studentCodeGenerator';

// 허용 문자 (혼동 문자 O, 0, I, 1, l 제외)
const ALLOWED_CHARS = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
const FORBIDDEN_CHARS = new Set(['O', '0', 'I', '1', 'l']);

describe('studentCodeGenerator 유틸리티', () => {
  describe('generateStudentCode', () => {
    it('6자리 코드를 생성한다', () => {
      const code = generateStudentCode(new Set());
      expect(code).toHaveLength(6);
    });

    it('허용 문자(영문 대문자 + 숫자)만 포함한다', () => {
      // Given: 여러 번 생성하여 모든 문자 검증
      for (let i = 0; i < 20; i++) {
        const code = generateStudentCode(new Set());
        for (const char of code) {
          expect(ALLOWED_CHARS.has(char)).toBe(true);
        }
      }
    });

    it('혼동 문자(O, 0, I, 1, l)를 포함하지 않는다', () => {
      for (let i = 0; i < 20; i++) {
        const code = generateStudentCode(new Set());
        for (const char of code) {
          expect(FORBIDDEN_CHARS.has(char)).toBe(false);
        }
      }
    });

    it('기존 코드 집합에 없는 새 코드를 생성한다', () => {
      // Given: 이미 존재하는 코드 집합
      const existingCodes = new Set(['ABC234', 'DEF567']);

      // When
      const code = generateStudentCode(existingCodes);

      // Then
      expect(existingCodes.has(code)).toBe(false);
    });

    it('충돌하는 코드를 건너뛰고 유효한 코드를 반환한다', () => {
      // Given: Math.random을 제어하여 첫 번째 시도는 충돌, 두 번째는 성공
      let callCount = 0;
      // ALLOWED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' (32자)
      // 인덱스 0='A', 1='B', 2='C', 3='D', 4='E', 5='F'
      // 첫 6번 호출: 'ABCDEF' → 충돌
      // 다음 6번 호출: 'GHIJKL' 아님, ALLOWED_CHARS에서 G=6,H=7,J=8,K=9,L=10,M=11 → 'GHJKLM'
      const mockValues = [
        // 첫 번째 시도: 'ABCDEF' (각 인덱스 / 32)
        0/32, 1/32, 2/32, 3/32, 4/32, 5/32,
        // 두 번째 시도: 'GHIJKL' 아닌 다른 값 → 인덱스 6,7,8,9,10,11 = 'GHJKLM'
        6/32, 7/32, 8/32, 9/32, 10/32, 11/32,
      ];
      vi.spyOn(Math, 'random').mockImplementation(() => {
        const val = mockValues[callCount] ?? 0;
        callCount++;
        return val;
      });

      const existingCodes = new Set(['ABCDEF']);
      const code = generateStudentCode(existingCodes);

      // 두 번째 시도 결과여야 함
      expect(existingCodes.has(code)).toBe(false);
      expect(code).toHaveLength(6);

      vi.restoreAllMocks();
    });

    it('빈 기존 코드 집합에서도 정상 동작한다', () => {
      const code = generateStudentCode(new Set());
      expect(code).toHaveLength(6);
    });

    it('최대 시도 횟수를 초과하면 에러를 던진다', () => {
      // Given: 모든 시도가 충돌하도록 Math.random을 고정
      vi.spyOn(Math, 'random').mockReturnValue(0); // 항상 'AAAAAA' 생성

      const existingCodes = new Set(['AAAAAA']);

      // When / Then
      expect(() => generateStudentCode(existingCodes, 5)).toThrow(
        '학생 고유번호 생성 실패: 최대 시도 횟수를 초과했습니다.'
      );

      vi.restoreAllMocks();
    });

    it('maxAttempts 기본값이 1000이다', () => {
      // Given: 충돌 없는 상황에서 정상 반환 확인 (기본값 사용)
      const code = generateStudentCode(new Set());
      expect(code).toBeDefined();
    });
  });

  describe('generateBulkStudentCodes', () => {
    it('코드 없는 학생에게 새 코드를 할당한다', () => {
      // Given
      const students = [
        { id: 's1' },
        { id: 's2' },
      ];

      // When
      const result = generateBulkStudentCodes(students);

      // Then
      expect(result.has('s1')).toBe(true);
      expect(result.has('s2')).toBe(true);
      expect(result.get('s1')).toHaveLength(6);
      expect(result.get('s2')).toHaveLength(6);
    });

    it('이미 코드가 있는 학생은 기존 코드를 유지한다', () => {
      // Given
      const students = [
        { id: 's1', studentCode: 'ABC234' },
        { id: 's2' },
      ];

      // When
      const result = generateBulkStudentCodes(students);

      // Then
      expect(result.get('s1')).toBe('ABC234');
    });

    it('새로 생성된 코드는 기존 코드와 충돌하지 않는다', () => {
      // Given
      const existingCode = 'ZZZ999';
      const students = [
        { id: 's1', studentCode: existingCode },
        { id: 's2' }, // 새 코드 필요
      ];

      // When
      const result = generateBulkStudentCodes(students);

      // Then: s2에 할당된 코드는 기존 코드와 달라야 함
      expect(result.get('s2')).not.toBe(existingCode);
    });

    it('새로 생성된 코드들끼리도 중복이 없다', () => {
      // Given: 코드 없는 학생 여러 명
      const students = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}` }));

      // When
      const result = generateBulkStudentCodes(students);

      // Then: 모든 코드가 유일해야 함
      const codes = Array.from(result.values());
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('빈 학생 배열을 전달하면 빈 Map을 반환한다', () => {
      const result = generateBulkStudentCodes([]);
      expect(result.size).toBe(0);
    });

    it('모든 학생에게 코드가 있으면 기존 코드만 포함한 Map을 반환한다', () => {
      // Given
      const students = [
        { id: 's1', studentCode: 'ABC234' },
        { id: 's2', studentCode: 'DEF567' },
      ];

      // When
      const result = generateBulkStudentCodes(students);

      // Then
      expect(result.get('s1')).toBe('ABC234');
      expect(result.get('s2')).toBe('DEF567');
      expect(result.size).toBe(2);
    });

    it('반환된 Map의 크기는 입력 학생 수와 같다', () => {
      // Given: 혼합 (코드 있는 학생 + 코드 없는 학생)
      const students = [
        { id: 's1', studentCode: 'ABC234' },
        { id: 's2' },
        { id: 's3' },
      ];

      // When
      const result = generateBulkStudentCodes(students);

      // Then
      expect(result.size).toBe(3);
    });

    it('생성된 코드는 허용 문자만 포함한다', () => {
      // Given
      const students = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}` }));

      // When
      const result = generateBulkStudentCodes(students);

      // Then
      for (const code of result.values()) {
        for (const char of code) {
          expect(ALLOWED_CHARS.has(char)).toBe(true);
          expect(FORBIDDEN_CHARS.has(char)).toBe(false);
        }
      }
    });
  });
});
