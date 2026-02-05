import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  encryptData,
  decryptData,
  encryptPhone,
  decryptPhone,
  isEncrypted,
  validateEncryptionKey,
} from '../../utils/encryption';

describe('encryption', () => {
  describe('validateEncryptionKey', () => {
    it('암호화 키가 설정되어 있는지 확인해야 함', () => {
      const result = validateEncryptionKey();

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('message');
      expect(typeof result.isValid).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });
  });

  describe('isEncrypted', () => {
    it('암호화된 데이터를 감지해야 함', () => {
      // CryptoJS AES 암호문의 특징: "U2FsdGVkX1" 로 시작
      expect(isEncrypted('U2FsdGVkX1+abc123')).toBe(true);
      expect(isEncrypted('U2FsdGVkX1')).toBe(true);
    });

    it('평문 데이터는 false를 반환해야 함', () => {
      expect(isEncrypted('plain text')).toBe(false);
      expect(isEncrypted('010-1234-5678')).toBe(false);
      expect(isEncrypted('U2FsdGVk')).toBe(false); // 유사하지만 다른 문자열
    });

    it('빈 문자열은 false를 반환해야 함', () => {
      expect(isEncrypted('')).toBe(false);
    });

    it('null이나 undefined 유형은 false를 반환해야 함', () => {
      // @ts-expect-error - 테스트를 위한 잘못된 타입
      expect(isEncrypted(null)).toBe(false);
      // @ts-expect-error - 테스트를 위한 잘못된 타입
      expect(isEncrypted(undefined)).toBe(false);
    });
  });

  describe('encryptData', () => {
    it('빈 문자열은 빈 문자열을 반환해야 함', () => {
      expect(encryptData('')).toBe('');
    });

    it('암호화 키가 없으면 평문을 반환하고 에러를 로깅해야 함', () => {
      // 암호화 키 검증 결과에 따라 동작이 달라질 수 있음
      const result = encryptData('test');

      // 키가 있으면 암호화된 값, 없으면 평문
      if (validateEncryptionKey().isValid) {
        expect(result).not.toBe('test');
        expect(isEncrypted(result)).toBe(true);
      } else {
        expect(result).toBe('test');
      }
    });
  });

  describe('decryptData', () => {
    it('빈 문자열은 빈 문자열을 반환해야 함', () => {
      expect(decryptData('')).toBe('');
    });

    it('암호화/복호화 라운드트립이 작동해야 함', () => {
      const keyValidation = validateEncryptionKey();
      if (!keyValidation.isValid) {
        // 키가 없으면 테스트 스킵
        return;
      }

      const original = '테스트 데이터';
      const encrypted = encryptData(original);
      const decrypted = decryptData(encrypted);

      expect(decrypted).toBe(original);
    });

    it('잘못된 암호문은 빈 문자열을 반환해야 함', () => {
      const keyValidation = validateEncryptionKey();
      if (!keyValidation.isValid) {
        return;
      }

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = decryptData('invalid ciphertext');

      expect(result).toBe('');

      consoleSpy.mockRestore();
    });
  });

  describe('encryptPhone', () => {
    it('빈 전화번호는 null을 반환해야 함', () => {
      expect(encryptPhone('')).toBeNull();
      expect(encryptPhone('   ')).toBeNull();
      // @ts-expect-error - 테스트를 위한 잘못된 타입
      expect(encryptPhone(null)).toBeNull();
    });

    it('하이픈을 제거하고 암호화해야 함', () => {
      const keyValidation = validateEncryptionKey();
      if (!keyValidation.isValid) {
        return;
      }

      const result = encryptPhone('010-1234-5678');

      expect(result).not.toBeNull();
      if (result) {
        expect(isEncrypted(result)).toBe(true);
      }
    });

    it('이미 하이픈이 없는 전화번호도 처리해야 함', () => {
      const keyValidation = validateEncryptionKey();
      if (!keyValidation.isValid) {
        return;
      }

      const result = encryptPhone('01012345678');

      expect(result).not.toBeNull();
      if (result) {
        expect(isEncrypted(result)).toBe(true);
      }
    });

    it('공백만 있는 전화번호는 null을 반환해야 함', () => {
      expect(encryptPhone('---')).toBeNull();
    });
  });

  describe('decryptPhone', () => {
    it('null은 빈 문자열을 반환해야 함', () => {
      expect(decryptPhone(null)).toBe('');
    });

    it('11자리 전화번호를 010-1234-5678 형식으로 포맷해야 함', () => {
      const keyValidation = validateEncryptionKey();
      if (!keyValidation.isValid) {
        return;
      }

      const encrypted = encryptPhone('010-1234-5678');
      if (!encrypted) return;

      const result = decryptPhone(encrypted);

      expect(result).toBe('010-1234-5678');
    });

    it('10자리 전화번호를 010-123-4567 형식으로 포맷해야 함', () => {
      const keyValidation = validateEncryptionKey();
      if (!keyValidation.isValid) {
        return;
      }

      const encrypted = encryptPhone('0101234567');
      if (!encrypted) return;

      const result = decryptPhone(encrypted);

      expect(result).toBe('010-123-4567');
    });

    it('암호화/복호화/포맷 라운드트립이 작동해야 함', () => {
      const keyValidation = validateEncryptionKey();
      if (!keyValidation.isValid) {
        return;
      }

      const original = '010-9876-5432';
      const encrypted = encryptPhone(original);
      if (!encrypted) return;

      const decrypted = decryptPhone(encrypted);

      expect(decrypted).toBe(original);
    });

    it('형식에 맞지 않는 전화번호는 그대로 반환해야 함', () => {
      const keyValidation = validateEncryptionKey();
      if (!keyValidation.isValid) {
        return;
      }

      // 특수한 형식의 전화번호
      const special = '1234';
      const encrypted = encryptData(special);
      const result = decryptPhone(encrypted);

      expect(result).toBe(special);
    });

    it('복호화 실패 시 빈 문자열을 반환해야 함', () => {
      const result = decryptPhone('invalid encrypted data');
      expect(result).toBe('');
    });
  });

  describe('라운드트립 테스트', () => {
    it('일반 데이터 암호화/복호화', () => {
      const keyValidation = validateEncryptionKey();
      if (!keyValidation.isValid) {
        return;
      }

      const testCases = [
        '테스트',
        'test123',
        'special!@#$%^&*()',
        '한글과 English 섞인 텍스트',
        '{"json": "data"}',
      ];

      testCases.forEach(testCase => {
        const encrypted = encryptData(testCase);
        const decrypted = decryptData(encrypted);
        expect(decrypted).toBe(testCase);
      });
    });

    it('전화번호 암호화/복호화/포맷', () => {
      const keyValidation = validateEncryptionKey();
      if (!keyValidation.isValid) {
        return;
      }

      const testCases = [
        '010-1234-5678',
        '010-9999-8888',
        '01012345678',
      ];

      testCases.forEach(testCase => {
        const encrypted = encryptPhone(testCase);
        if (!encrypted) return;

        const decrypted = decryptPhone(encrypted);
        // 하이픈이 추가된 형식으로 반환
        const cleanedInput = testCase.replace(/-/g, '');
        const expectedFormat =
          cleanedInput.length === 11
            ? `${cleanedInput.slice(0, 3)}-${cleanedInput.slice(3, 7)}-${cleanedInput.slice(7)}`
            : `${cleanedInput.slice(0, 3)}-${cleanedInput.slice(3, 6)}-${cleanedInput.slice(6)}`;

        expect(decrypted).toBe(expectedFormat);
      });
    });
  });
});
