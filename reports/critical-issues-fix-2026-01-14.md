# Critical Issues 수정 보고서

**날짜**: 2026-01-14
**작업자**: Claude Code Assistant
**작업 범위**: 종합 코드 감사에서 발견된 Critical 이슈 수정

---

## 📋 수정된 Critical Issues

### ✅ Issue #1: dateUtils.ts Null 참조 에러

**심각도**: 🔴 Critical
**위치**: `utils/dateUtils.ts`
**문제**: `e.startDate`, `e.endDate`가 undefined일 경우 `parseISO()` 실패

**수정 내용**:
```typescript
// Before
export const getEventsForCell = (events: any[], date: Date, deptId: string) => {
  return events.filter(e => {
    if (e.departmentId !== deptId) return false;
    const start = parseISO(e.startDate);  // ❌ Null 체크 없음
    const end = parseISO(e.endDate);
    return isWithinInterval(date, { start, end });
  });
};

// After ✅
export const getEventsForCell = (events: any[], date: Date, deptId: string) => {
  return events.filter(e => {
    if (e.departmentId !== deptId) return false;

    // Null/undefined 체크
    if (!e.startDate || !e.endDate) return false;

    try {
      const start = parseISO(e.startDate);
      const end = parseISO(e.endDate);

      // Invalid Date 체크
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.warn('Invalid date format in event:', e);
        return false;
      }

      return isWithinInterval(date, { start, end });
    } catch (error) {
      console.warn('Error parsing event dates:', e, error);
      return false;
    }
  });
};
```

**추가 수정**: `getEventPositionInWeek()` 함수도 동일하게 방어 코드 추가

**예상 효과**:
- 캘린더 렌더링 크래시 방지
- Invalid Date 에러 방지
- 사용자 경험 향상

---

### ✅ Issue #2: Student ID 중복 가능성

**심각도**: 🔴 Critical
**위치**: `components/StudentManagement/AddStudentModal.tsx`
**문제**: 동명이인 + 같은 학교 + 같은 학년 = ID 충돌로 데이터 덮어쓰기

**수정 내용**:
```typescript
// Before
const studentId = `${formData.name}_${formData.school}_${formData.grade}`;
await setDoc(doc(db, 'students', studentId), { ... });  // ❌ 덮어쓰기 위험

// After ✅
const baseId = `${formData.name}_${formData.school}_${formData.grade}`;
let studentId = baseId;
let counter = 1;

// 중복 체크 및 순번 추가
while ((await getDoc(doc(db, 'students', studentId))).exists()) {
  counter++;
  studentId = `${baseId}_${counter}`;

  // 무한 루프 방지
  if (counter > 100) {
    throw new Error('동일한 학생 정보가 너무 많습니다.');
  }
}

await setDoc(doc(db, 'students', studentId), { ... });

// 중복 알림
if (counter > 1) {
  console.info(`순번 ${counter}가 추가되었습니다: ${studentId}`);
}
```

**예시**:
- 1번째 학생: `홍길동_칠성초_초1`
- 2번째 동명이인: `홍길동_칠성초_초1_2`
- 3번째 동명이인: `홍길동_칠성초_초1_3`

**예상 효과**:
- 데이터 손실 방지
- 동명이인 처리 가능
- 무한 루프 방지 (최대 100명)

---

### ✅ Issue #3: EventModal Hooks 의존성 배열 누락

**심각도**: 🔴 Critical
**위치**: `components/Calendar/EventModal.tsx:279-280`
**문제**: `currentUser`, `initialTitle`, `initialDepartmentIds`, `templateEvent` 누락

**수정 내용**:
```typescript
// Before
useEffect(() => {
  // ... 복잡한 초기화 로직
}, [isOpen, existingEvent, initialDate, initialEndDate,
    initialDepartmentId, initialStartTime, initialEndTime, departments]);
    // ❌ currentUser, initialTitle, initialDepartmentIds, templateEvent 누락

// After ✅
useEffect(() => {
  // ... 초기화 로직
}, [
  isOpen,
  existingEvent,
  templateEvent,        // 추가
  currentUser,          // 추가
  initialDate,
  initialEndDate,
  initialDepartmentId,
  initialDepartmentIds, // 추가
  initialStartTime,
  initialEndTime,
  initialTitle,         // 추가
  departments
]);
```

**예상 효과**:
- 모달 상태 불일치 해결
- Props 변경 시 올바른 업데이트
- React hooks 경고 제거

---

### ✅ Issue #4: useStudents Promise.all 에러 처리 누락

**심각도**: 🔴 Critical
**위치**: `hooks/useStudents.ts:49-52`
**문제**: 병렬 쿼리 중 하나라도 실패하면 전체 실패

**수정 내용**:
```typescript
// Before
const [activeSnap, withdrawnSnap] = await Promise.all([
  getDocs(activeQuery),
  getDocs(withdrawnQuery)
]);
// ❌ 하나라도 실패하면 전체 실패

// After ✅
const [activeSnap, withdrawnSnap] = await Promise.all([
  getDocs(activeQuery).catch(err => {
    console.error('Active students query failed:', err);
    return { docs: [] } as any;  // 부분 실패 허용
  }),
  getDocs(withdrawnQuery).catch(err => {
    console.error('Withdrawn students query failed:', err);
    return { docs: [] } as any;
  })
]);
```

**예상 효과**:
- 부분 실패 시에도 나머지 데이터 표시
- 학생 목록 로딩 안정성 향상
- 네트워크 오류 대응

---

### ✅ Issue #5: 개인정보 암호화 유틸리티 구현

**심각도**: 🔴 Critical
**위치**: `utils/encryption.ts` (신규), `components/StudentManagement/AddStudentModal.tsx`
**문제**: 학생 전화번호가 평문으로 Firestore에 저장됨

**구현 내용**:

#### 1. 암호화 유틸리티 (`utils/encryption.ts`)
```typescript
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY;

// 기본 암호화/복호화
export function encryptData(plaintext: string): string {
  const encrypted = CryptoJS.AES.encrypt(plaintext, ENCRYPTION_KEY);
  return encrypted.toString();
}

export function decryptData(ciphertext: string): string {
  const decrypted = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
  return decrypted.toString(CryptoJS.enc.Utf8);
}

// 전화번호 특화 함수
export function encryptPhone(phone: string): string | null {
  if (!phone || !phone.trim()) return null;
  const cleaned = phone.replace(/-/g, '').trim();
  return encryptData(cleaned);
}

export function decryptPhone(encryptedPhone: string | null): string {
  if (!encryptedPhone) return '';
  const decrypted = decryptData(encryptedPhone);

  // 포맷팅 (010-1234-5678)
  if (decrypted.length === 11) {
    return `${decrypted.slice(0, 3)}-${decrypted.slice(3, 7)}-${decrypted.slice(7)}`;
  }
  return decrypted;
}

// 암호화 여부 확인
export function isEncrypted(data: string): boolean {
  return data.startsWith('U2FsdGVkX1');  // CryptoJS AES 특징
}
```

#### 2. AddStudentModal 적용
```typescript
import { encryptPhone } from '../../utils/encryption';

await setDoc(doc(db, 'students', studentId), {
  name: formData.name.trim(),
  phone: encryptPhone(formData.phone),        // ✅ 암호화
  parentPhone: encryptPhone(formData.parentPhone),  // ✅ 암호화
  // ...
});
```

#### 3. 환경변수 설정 가이드 (`.env.local.example`)
```bash
# Encryption Key for Personal Data (REQUIRED)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
VITE_ENCRYPTION_KEY=your_256bit_encryption_key_here_min_32_chars
```

**설치된 패키지**:
- `crypto-js`: AES 암호화 라이브러리
- `@types/crypto-js`: TypeScript 타입 정의

**사용 방법**:
1. `.env.local` 파일에 `VITE_ENCRYPTION_KEY` 설정
2. 암호화 키 생성:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. 신규 학생 등록 시 자동으로 전화번호 암호화
4. 기존 데이터는 마이그레이션 스크립트 필요 (별도 작업)

**예상 효과**:
- 개인정보보호법 준수
- Firestore Console에서 전화번호 확인 불가
- 데이터 유출 시에도 전화번호 보호

**제한사항**:
- 클라이언트 측 암호화는 차선책 (이상적으로는 Firebase Functions 사용)
- 암호화 키 유출 시 복호화 가능
- 검색 기능 제한 (암호화된 필드는 검색 불가)

---

## ⚠️ 사용자 직접 조치 필요

### Issue #0: API 키 Git 노출

**심각도**: 🔴 Critical
**문제**: `.env.local` 파일이 Git에 커밋되어 API 키 노출

**즉시 조치 사항** (사용자가 직접 수행):

```bash
# 1. Git 히스토리에서 .env.local 완전 제거
git filter-repo --invert-paths --path .env.local

# 또는 BFG Repo-Cleaner 사용
bfg --delete-files .env.local
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 2. Force push (주의: 팀원에게 사전 공지 필요)
git push origin --force --all

# 3. Firebase Console에서 API 키 재발급
# - ijw-calander 프로젝트
# - injaewon-project-8ea38 프로젝트 (레거시)

# 4. 새 API 키를 .env.local에 저장 (절대 커밋 안 함)
# .gitignore에 이미 설정되어 있으므로 안전
```

**참고 파일**: `.env.local.example` (신규 생성)

---

## 📊 수정 요약

| Issue | 파일 | 상태 | 라인 수 변경 |
|-------|------|------|--------------|
| dateUtils Null 체크 | `utils/dateUtils.ts` | ✅ 완료 | +40 |
| Student ID 중복 | `AddStudentModal.tsx` | ✅ 완료 | +20 |
| EventModal hooks | `EventModal.tsx` | ✅ 완료 | +7 |
| useStudents 에러 처리 | `hooks/useStudents.ts` | ✅ 완료 | +8 |
| 개인정보 암호화 | `utils/encryption.ts` | ✅ 완료 | +170 (신규) |
| 환경변수 가이드 | `.env.local.example` | ✅ 완료 | +45 (신규) |

**총 변경 라인 수**: +290줄

---

## 🧪 테스트 권장사항

### 단위 테스트
```typescript
// dateUtils.test.ts
describe('getEventsForCell', () => {
  it('should handle null startDate', () => {
    const events = [{ startDate: null, endDate: '2026-01-14' }];
    const result = getEventsForCell(events, new Date(), 'dept1');
    expect(result).toEqual([]);
  });
});

// encryption.test.ts
describe('encryptPhone', () => {
  it('should encrypt phone number', () => {
    const phone = '010-1234-5678';
    const encrypted = encryptPhone(phone);
    expect(encrypted).not.toBe(phone);
    expect(decryptPhone(encrypted)).toBe(phone);
  });
});
```

### 통합 테스트
- 학생 등록 플로우 (동명이인 처리 포함)
- 캘린더 이벤트 렌더링 (Invalid Date 처리)
- 전화번호 암호화/복호화 전체 플로우

---

## 📝 다음 단계

### 즉시 (오늘)
- [ ] `.env.local`에 `VITE_ENCRYPTION_KEY` 설정
- [ ] 암호화 키 생성 및 저장
- [ ] Git 히스토리에서 `.env.local` 제거
- [ ] Firebase API 키 재발급

### 단기 (이번 주)
- [ ] 기존 학생 데이터 암호화 마이그레이션 스크립트 작성
- [ ] 학생 정보 조회 시 복호화 로직 추가 (StudentList 등)
- [ ] 암호화 관련 단위 테스트 작성
- [ ] 보안 감사 재실행

### 중기 (2주 내)
- [ ] Firebase Functions으로 암호화 로직 이전 (권장)
- [ ] 나머지 High/Medium 이슈 수정
- [ ] 전체 테스트 커버리지 30% 달성

---

## 🔗 관련 문서

- [Comprehensive Code Audit](comprehensive-code-audit-2026-01-14.md)
- [Final Chunk Strategy Fix](final-chunk-strategy-fix-2026-01-14.md)
- [Firebase 보안 모범 사례](https://firebase.google.com/docs/rules/best-practices)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

**작성일**: 2026-01-14
**작성자**: Claude Code Assistant
**검토 필요**: Phase 1 완료 후 (약 1주 후)
**다음 작업**: High Priority 이슈 수정

---

## 부록: 빠른 시작 가이드

### 1. 암호화 키 설정
```bash
# 1. 암호화 키 생성
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. .env.local 파일 생성 (또는 수정)
cp .env.local.example .env.local

# 3. VITE_ENCRYPTION_KEY에 생성된 키 붙여넣기
nano .env.local
```

### 2. 의존성 확인
```bash
# crypto-js가 설치되었는지 확인
npm list crypto-js

# 없다면 설치
npm install crypto-js @types/crypto-js
```

### 3. 빌드 및 테스트
```bash
# 빌드 확인
npm run build

# 개발 서버 실행
npm run dev

# 테스트 (있는 경우)
npm run test
```

---

**수고하셨습니다! Critical 이슈 수정이 완료되었습니다.** 🎉
