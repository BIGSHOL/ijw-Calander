import { vi } from 'vitest';
import { maskStudentId, maskStudentName, secureLog, secureWarn, secureError } from '../../utils/secureLog';

describe('secureLog', () => {
  describe('maskStudentId', () => {
    it('프로덕션에서 ID 앞 3자리만 표시', () => {
      const result = maskStudentId('student123');
      expect(result).toBe('stu***');
    });

    it('빈 문자열은 *** 반환', () => {
      expect(maskStudentId('')).toBe('***');
    });

    it('3자리 미만은 *** 반환', () => {
      expect(maskStudentId('ab')).toBe('***');
    });

    it('정확히 3자리는 마스킹', () => {
      expect(maskStudentId('abc')).toBe('abc***');
    });
  });

  describe('maskStudentName', () => {
    it('프로덕션에서 첫 글자만 표시', () => {
      expect(maskStudentName('김철수')).toBe('김*');
    });

    it('빈 이름은 *** 반환', () => {
      expect(maskStudentName('')).toBe('***');
    });

    it('한 글자 이름도 마스킹', () => {
      expect(maskStudentName('김')).toBe('김*');
    });
  });

  describe('secureLog 함수', () => {
    it('data 없으면 메시지만 출력', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      secureLog('test message');
      expect(spy).toHaveBeenCalledWith('test message');
      spy.mockRestore();
    });

    it('studentId를 마스킹하여 출력', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      secureLog('test', { studentId: 'student123', other: 'data' });
      expect(spy).toHaveBeenCalledWith('test', expect.objectContaining({
        studentId: 'stu***',
        other: 'data',
      }));
      spy.mockRestore();
    });

    it('studentName을 마스킹하여 출력', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      secureLog('test', { studentName: '김철수' });
      expect(spy).toHaveBeenCalledWith('test', expect.objectContaining({
        studentName: '김*',
      }));
      spy.mockRestore();
    });
  });

  describe('secureWarn 함수', () => {
    it('data 없으면 메시지만 출력', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      secureWarn('warning');
      expect(spy).toHaveBeenCalledWith('warning');
      spy.mockRestore();
    });

    it('민감 정보 마스킹', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      secureWarn('warn', { studentId: 'abc123', studentName: '이영희' });
      expect(spy).toHaveBeenCalledWith('warn', expect.objectContaining({
        studentId: 'abc***',
        studentName: '이*',
      }));
      spy.mockRestore();
    });
  });

  describe('secureError 함수', () => {
    it('data 없으면 메시지와 에러만 출력', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const err = new Error('test');
      secureError('error', err);
      expect(spy).toHaveBeenCalledWith('error', err);
      spy.mockRestore();
    });

    it('민감 정보 마스킹', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const err = new Error('fail');
      secureError('error', err, { studentId: 'xyz999', studentName: '박지민' });
      expect(spy).toHaveBeenCalledWith('error', err, expect.objectContaining({
        studentId: 'xyz***',
        studentName: '박*',
      }));
      spy.mockRestore();
    });
  });
});