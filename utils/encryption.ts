/**
 * 클라이언트 측 데이터 암호화/복호화 유틸리티
 *
 * 주의사항:
 * 1. 환경변수 VITE_ENCRYPTION_KEY는 반드시 .env.local에 설정해야 합니다
 * 2. 암호화 키는 32바이트 (256비트) 길이여야 합니다
 * 3. 프로덕션 환경에서는 Firebase Functions 사용을 권장합니다
 */

import CryptoJS from 'crypto-js';

// 암호화 키 (환경변수에서 로드)
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY;

// 암호화 키 누락 경고는 개발 환경에서만 (validateEncryptionKey에서 처리)

/**
 * 데이터 암호화
 * @param plaintext 암호화할 평문
 * @returns 암호화된 문자열 (Base64)
 */
export function encryptData(plaintext: string): string {
  if (!plaintext) return '';

  if (!ENCRYPTION_KEY) {
    console.error('암호화 키가 설정되지 않아 평문으로 저장됩니다!');
    return plaintext;
  }

  try {
    const encrypted = CryptoJS.AES.encrypt(plaintext, ENCRYPTION_KEY);
    return encrypted.toString();
  } catch (error) {
    console.error('암호화 실패:', error);
    throw new Error('데이터 암호화에 실패했습니다');
  }
}

/**
 * 데이터 복호화
 * @param ciphertext 복호화할 암호문
 * @returns 복호화된 평문
 */
export function decryptData(ciphertext: string): string {
  if (!ciphertext) return '';

  if (!ENCRYPTION_KEY) {
    console.error('암호화 키가 설정되지 않았습니다!');
    return ciphertext; // 평문으로 저장된 경우 그대로 반환
  }

  try {
    const decrypted = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);

    // 복호화 실패 시 (잘못된 암호문 또는 키)
    if (!plaintext) {
      console.warn('복호화 실패: 잘못된 데이터 또는 키');
      return '';
    }

    return plaintext;
  } catch (error) {
    console.error('복호화 실패:', error);
    return '';
  }
}

/**
 * 전화번호 암호화 (특화 함수)
 * - 하이픈 제거 후 암호화
 * - 빈 문자열 처리
 */
export function encryptPhone(phone: string): string | null {
  if (!phone || !phone.trim()) return null;

  // 하이픈 제거
  const cleaned = phone.replace(/-/g, '').trim();
  if (!cleaned) return null;

  return encryptData(cleaned);
}

/**
 * 전화번호 복호화 (특화 함수)
 * - 복호화 후 포맷팅 (010-1234-5678)
 */
export function decryptPhone(encryptedPhone: string | null): string {
  if (!encryptedPhone) return '';

  const decrypted = decryptData(encryptedPhone);
  if (!decrypted) return '';

  // 전화번호 포맷팅 (010-1234-5678)
  if (decrypted.length === 11 && decrypted.startsWith('01')) {
    return `${decrypted.slice(0, 3)}-${decrypted.slice(3, 7)}-${decrypted.slice(7)}`;
  } else if (decrypted.length === 10) {
    return `${decrypted.slice(0, 3)}-${decrypted.slice(3, 6)}-${decrypted.slice(6)}`;
  }

  return decrypted;
}

/**
 * 데이터가 암호화되어 있는지 확인
 * - CryptoJS AES 암호문은 Base64로 인코딩되어 있으며 "U2FsdGVkX1" 접두사를 가짐
 */
export function isEncrypted(data: string): boolean {
  if (!data) return false;

  // CryptoJS AES 암호문의 특징
  // - Base64 인코딩
  // - "U2FsdGVkX1" 로 시작 (Salted__ 의 Base64)
  return data.startsWith('U2FsdGVkX1');
}

/**
 * 암호화 키 검증
 * - 환경변수가 설정되어 있는지 확인
 * - 키 길이 검증 (최소 16자 권장)
 */
export function validateEncryptionKey(): {
  isValid: boolean;
  message: string;
} {
  if (!ENCRYPTION_KEY) {
    return {
      isValid: false,
      message: 'VITE_ENCRYPTION_KEY가 설정되지 않았습니다. .env.local 파일을 확인하세요.'
    };
  }

  if (ENCRYPTION_KEY.length < 16) {
    return {
      isValid: false,
      message: '암호화 키가 너무 짧습니다. 최소 16자 이상을 권장합니다.'
    };
  }

  return {
    isValid: true,
    message: '암호화 키가 올바르게 설정되었습니다.'
  };
}

// 암호화 키 검증은 validateEncryptionKey() 함수를 명시적으로 호출하여 확인
