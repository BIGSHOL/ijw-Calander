// Firebase 및 일반 에러 메시지 한글 변환

const FIREBASE_AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
  'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
  'auth/user-not-found': '등록되지 않은 이메일입니다.',
  'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
  'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
  'auth/invalid-email': '유효하지 않은 이메일 형식입니다.',
  'auth/too-many-requests': '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
  'auth/user-disabled': '비활성화된 계정입니다. 관리자에게 문의하세요.',
  'auth/operation-not-allowed': '이 로그인 방법은 허용되지 않습니다.',
  'auth/network-request-failed': '네트워크 연결을 확인해주세요.',
  'auth/popup-closed-by-user': '로그인 창이 닫혔습니다. 다시 시도해주세요.',
  'auth/requires-recent-login': '보안을 위해 다시 로그인해주세요.',
  'auth/credential-already-in-use': '이미 다른 계정에 연결된 인증 정보입니다.',
  'auth/account-exists-with-different-credential': '같은 이메일로 다른 방식으로 가입된 계정이 있습니다.',
  'auth/expired-action-code': '인증 코드가 만료되었습니다. 다시 요청해주세요.',
  'auth/invalid-action-code': '유효하지 않은 인증 코드입니다.',
};

const FIRESTORE_ERRORS: Record<string, string> = {
  'permission-denied': '권한이 없습니다. 관리자에게 문의하세요.',
  'unavailable': '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
  'not-found': '요청한 데이터를 찾을 수 없습니다.',
  'already-exists': '이미 존재하는 데이터입니다.',
  'resource-exhausted': '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
  'cancelled': '요청이 취소되었습니다.',
  'deadline-exceeded': '요청 시간이 초과되었습니다. 다시 시도해주세요.',
  'unauthenticated': '로그인이 필요합니다.',
};

const STORAGE_ERRORS: Record<string, string> = {
  'storage/unauthorized': '파일 접근 권한이 없습니다.',
  'storage/canceled': '파일 업로드가 취소되었습니다.',
  'storage/unknown': '파일 처리 중 알 수 없는 오류가 발생했습니다.',
  'storage/object-not-found': '파일을 찾을 수 없습니다.',
  'storage/quota-exceeded': '저장 공간이 부족합니다.',
  'storage/retry-limit-exceeded': '파일 업로드 재시도 횟수를 초과했습니다.',
};

/**
 * 에러 객체에서 한글 메시지를 추출합니다.
 * Firebase Auth, Firestore, Storage 에러 코드를 자동 변환합니다.
 * @param error 에러 객체
 * @param fallback 기본 메시지 (옵션)
 */
export function getKoreanErrorMessage(error: unknown, fallback = '오류가 발생했습니다. 다시 시도해주세요.'): string {
  if (!error) return fallback;

  // Firebase Auth 에러 (code: "auth/...")
  const firebaseError = error as { code?: string; message?: string };
  if (firebaseError.code) {
    // Auth 에러
    if (FIREBASE_AUTH_ERRORS[firebaseError.code]) {
      return FIREBASE_AUTH_ERRORS[firebaseError.code];
    }
    // Firestore 에러
    if (FIRESTORE_ERRORS[firebaseError.code]) {
      return FIRESTORE_ERRORS[firebaseError.code];
    }
    // Storage 에러
    if (STORAGE_ERRORS[firebaseError.code]) {
      return STORAGE_ERRORS[firebaseError.code];
    }
  }

  // 일반 Error 객체 - message에 코드가 포함된 경우
  const msg = firebaseError.message || String(error);
  for (const [code, korean] of Object.entries({ ...FIREBASE_AUTH_ERRORS, ...FIRESTORE_ERRORS, ...STORAGE_ERRORS })) {
    if (msg.includes(code)) return korean;
  }

  return fallback;
}
