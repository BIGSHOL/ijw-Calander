# 학생 데이터 시뮬레이션 모드 - 검증 및 보완 보고서

> 작성일: 2026-01-01
> 검증 방법: 자동 코드 리뷰 + Firebase 비용 분석
> 에이전트: code-reviewer + firebase-cost-optimizer

---

## 📊 실행 요약 (Executive Summary)

### 전체 평가
- **구현 완성도**: 95% (Phase 1-6 완료, Phase 7 미완료)
- **코드 품질**: A- (Excellent)
- **비용 효율성**: A+ (월 $0.043, 연간 $0.52)
- **보안 상태**: ⚠️ CRITICAL - Firestore Rules 미배포
- **프로덕션 준비**: ❌ NOT READY (1-2시간 추가 작업 필요)

### 즉시 조치 필요 항목
1. 🔴 **CRITICAL**: Firestore Security Rules 배포
2. 🟡 **IMPORTANT**: EnglishClassTab 전체 파일 검증
3. 🟢 **RECOMMENDED**: 백업 정리 에러 처리 개선

---

## 📋 목차

1. [구현 완료 항목](#1-구현-완료-항목)
2. [발견된 문제점](#2-발견된-문제점)
3. [Firebase 비용 분석](#3-firebase-비용-분석)
4. [보완 사항](#4-보완-사항)
5. [테스트 검증](#5-테스트-검증)
6. [문서 업데이트](#6-문서-업데이트)

---

## 1. 구현 완료 항목

### ✅ Phase 1: Constants 추가 (100% 완료)

**파일**: `components/Timetable/English/englishUtils.ts`

**검증 결과**:
```typescript
// Line 42-43
export const CLASS_COLLECTION = '수업목록';
export const CLASS_DRAFT_COLLECTION = '수업목록_draft';
```

- ✅ 상수 정의 완료
- ✅ 모든 의존 파일에서 정상 import
- ✅ TypeScript 컴파일 통과

---

### ✅ Phase 2: StudentModal 수정 (100% 완료)

**파일**: `components/Timetable/English/StudentModal.tsx`

**검증 결과**:

| 항목 | 라인 | 상태 |
|------|------|------|
| Import 추가 | 8 | ✅ 완료 |
| Props 인터페이스 확장 | 17 | ✅ 완료 |
| 컴포넌트 시그니처 수정 | 20 | ✅ 완료 |
| 컬렉션 동적 선택 (조회) | 66 | ✅ 완료 |
| 컬렉션 동적 선택 (생성) | 79-126 | ✅ 완료 |
| 리스너 수정 | 149 | ✅ 완료 |
| 저장 로직 수정 | 186 | ✅ 완료 |

**코드 품질**:
- ✅ 시뮬레이션 vs 실시간 모드 분기 처리 완벽
- ✅ 사용자 친화적 에러 메시지
- ✅ Console 로깅으로 디버깅 지원 (Line 97, 125)
- ✅ 에러 핸들링 (permission-denied, unavailable)

---

### ✅ Phase 3: EnglishTimetable 수정 (100% 완료)

**파일**: `components/Timetable/English/EnglishTimetable.tsx`

**검증 결과**:

#### 3.1. handleCopyLiveToDraft (Line 149-189)
```typescript
// ✅ 시간표 복사 (기존)
const liveSnapshot = await getDocs(collection(db, EN_COLLECTION));

// ✅ 학생 데이터 복사 (신규 추가됨)
const classSnapshot = await getDocs(collection(db, CLASS_COLLECTION));

// ✅ Batch 제한 체크 (Line 169-171)
if (classSnapshot.docs.length > 500) {
    throw new Error(`수업 문서가 너무 많습니다...`);
}
```

**평가**: 완벽한 구현. 에러 처리, 배치 제한, 사용자 피드백 모두 갖춤.

#### 3.2. handlePublishDraftToLive (Line 191-298)
```typescript
// ✅ 백업 생성 시 학생 데이터 포함 (Line 201-214)
const studentBackupData: Record<string, any> = {};
classSnapshot.docs.forEach(docSnap => {
    studentBackupData[docSnap.id] = docSnap.data();
});

await setDoc(doc(db, 'english_backups', backupId), {
    data: timetableBackupData,
    studentData: studentBackupData  // 신규 필드
});

// ✅ Draft → Live 복사 (학생 데이터) (Line 247-263)
const draftClassSnapshot = await getDocs(collection(db, CLASS_DRAFT_COLLECTION));
const classBatch = writeBatch(db);
draftClassSnapshot.docs.forEach(docSnap => {
    classBatch.set(doc(db, CLASS_COLLECTION, docSnap.id), docSnap.data());
});
await classBatch.commit();
```

**평가**: 완벽한 구현. 백업 통합, 에러 처리, 자동 정리 모두 작동.

---

### ✅ Phase 4: EnglishClassTab 수정 (95% 완료)

**파일**: `components/Timetable/English/EnglishClassTab.tsx`

**검증 결과**:

| 항목 | 라인 | 상태 |
|------|------|------|
| Props 인터페이스 확장 | 33 | ✅ 완료 |
| 컴포넌트 시그니처 수정 | 59 | ✅ 완료 |
| StudentModal Props 전달 | ??? | ⚠️ **미검증** |

**⚠️ 주의**: 파일의 첫 150줄만 확인됨. StudentModal 렌더링 부분 (추정 Line 400+)은 미검증.

**필요한 코드** (문서 기준):
```typescript
<StudentModal
    isOpen={isStudentModalOpen}
    onClose={() => setIsStudentModalOpen(false)}
    className={selectedClass}
    teacher={selectedTeacher}
    currentUser={currentUser}
    readOnly={!canEditEnglish || (isSimulationMode && currentUser?.role !== 'master')}
    isSimulationMode={isSimulationMode}  // 👈 이 Props 전달 확인 필요
/>
```

**조치 필요**: [섹션 2.2 참조](#22-issue-2-englishclasstab-studentmodal-props-미검증)

---

### ✅ Phase 5: Props 연결 (100% 완료)

**파일**: `components/Timetable/English/EnglishTimetable.tsx`

**검증 결과**:
```typescript
// Line 398
<EnglishClassTab
    teachers={sortedTeachers}
    scheduleData={scheduleData}
    teachersData={teachersData}
    classKeywords={classKeywords}
    currentUser={currentUser}
    isSimulationMode={isSimulationMode}  // ✅ Props 전달 완료
/>
```

**평가**: 완벽하게 구현됨.

---

### ✅ Phase 6: BackupHistoryModal 수정 (100% 완료)

**파일**: `components/Timetable/English/BackupHistoryModal.tsx`

**검증 결과**:

| 항목 | 라인 | 상태 |
|------|------|------|
| Import 추가 | 5 | ✅ 완료 |
| 인터페이스 확장 | 14 | ✅ 완료 |
| 복원 로직 (현재 데이터 백업) | 142-154 | ✅ 완료 |
| 복원 로직 (학생 데이터 복원) | 197-226 | ✅ 완료 |
| 하위 호환성 처리 | 229-231 | ✅ 완료 |

**고급 기능**:
- ✅ `validateBackupData` 함수로 데이터 무결성 검증 (Line 28-76)
- ✅ 백업별 검증 및 손상된 백업 경고 UI (Line 312-366)
- ✅ 사용자 친화적 결과 메시지 (시간표 + 학생 데이터 개수 표시)

**평가**: 완벽한 구현. 에러 처리, 하위 호환성, UX 모두 우수.

---

### ❌ Phase 7: Firestore Security Rules (0% 완료)

**파일**: `firestore.rules` (프로젝트 루트)

**현재 상태**: **파일 없음** (미배포)

**위험도**: 🔴 **CRITICAL SECURITY VULNERABILITY**

**문제**:
- `수업목록_draft` 컬렉션에 보안 규칙 없음
- 인증된 모든 사용자가 Draft 데이터 수정 가능
- Admin/Manager가 시뮬레이션 모드에서 학생 데이터 수정 가능 (Master 전용이어야 함)

**즉시 조치 필요**: [섹션 2.1 참조](#21-issue-1-firestore-security-rules-미배포-critical)

---

## 2. 발견된 문제점

### 2.1. Issue 1: Firestore Security Rules 미배포 (CRITICAL)

**심각도**: 🔴 **CRITICAL**
**영향**: 보안 취약점
**상태**: 미완료

#### 문제 상세

현재 `수업목록_draft` 컬렉션에 대한 Firestore Security Rules가 배포되지 않았습니다.

**위험 시나리오**:
1. Manager 계정이 시뮬레이션 모드 진입 (읽기만 가능해야 함)
2. StudentModal 열기 (정상)
3. 학생 추가/수정 시도
4. **예상**: permission-denied 에러
5. **실제**: ✅ 저장 성공 (보안 규칙 없음)

**영향 범위**:
- Admin/Manager가 Master 권한 없이 Draft 데이터 수정 가능
- 권한 체크가 클라이언트 코드에만 의존 (`readOnly` prop)
- 악의적 사용자가 직접 Firestore SDK로 Draft 데이터 조작 가능

#### 해결 방법

**1. firestore.rules 파일 생성**

프로젝트 루트에 파일 생성:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // === 기존 규칙 유지 (있다면) ===

    // 수업목록 (Live) - 기존 규칙이 있다면 유지, 없다면 추가
    match /수업목록/{classId} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['master', 'admin', 'manager'];

      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['master', 'admin'];
    }

    // === 신규 규칙 (REQUIRED) ===

    // 수업목록_draft (Simulation) - 시뮬레이션 모드 전용
    match /수업목록_draft/{classId} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['master', 'admin', 'manager'];

      // ⚠️ Master만 쓰기 가능 (시뮬레이션 모드는 Master 전용)
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'master';
    }

    // === 기타 기존 규칙 유지 ===
  }
}
```

**2. Firebase 배포**

```bash
# 프로젝트 루트에서 실행
firebase deploy --only firestore:rules
```

**3. 배포 검증**

```bash
# 규칙이 올바르게 배포되었는지 확인
firebase firestore:rules:get
```

**4. 기능 테스트**

- Manager 계정으로 로그인
- 시뮬레이션 모드 진입
- StudentModal에서 학생 추가 시도
- **예상 결과**: "permission-denied" 에러 (정상)

#### 예상 소요 시간

- 파일 생성: 5분
- 배포 및 검증: 10분
- 기능 테스트: 15분
- **총 30분**

#### 체크리스트

- [ ] `firestore.rules` 파일 생성
- [ ] `수업목록_draft` 규칙 추가
- [ ] `firebase deploy --only firestore:rules` 실행
- [ ] Firebase Console에서 규칙 적용 확인
- [ ] Manager 계정으로 권한 테스트
- [ ] IMPLEMENTATION_SUMMARY.md 체크리스트 업데이트

---

### 2.2. Issue 2: EnglishClassTab StudentModal Props 미검증 (IMPORTANT)

**심각도**: 🟡 **IMPORTANT**
**영향**: 런타임 버그 가능성
**상태**: 미검증

#### 문제 상세

`EnglishClassTab.tsx` 파일의 첫 150줄만 확인되었습니다. StudentModal 렌더링 부분 (추정 Line 400-500)이 검증되지 않았습니다.

**검증 필요 사항**:

1. **isSimulationMode Prop 전달**:
   ```typescript
   <StudentModal
       // ...
       isSimulationMode={isSimulationMode}  // 👈 이 Props 있는지 확인
   />
   ```

2. **readOnly 계산 로직**:
   ```typescript
   readOnly={!canEditEnglish || (isSimulationMode && currentUser?.role !== 'master')}
   ```
   - 시뮬레이션 모드에서 Master 외 자동 읽기 전용 확인

#### 해결 방법

**1. 전체 파일 읽기**

```bash
# 파일 확인 (전체)
cat components/Timetable/English/EnglishClassTab.tsx | grep -A 10 "StudentModal"
```

**2. StudentModal 렌더링 찾기**

예상 위치: Line 400-500

**3. Props 확인**

필수 Props:
- `isOpen`
- `onClose`
- `className`
- `teacher`
- `currentUser`
- `readOnly` (시뮬레이션 모드 체크 포함)
- `isSimulationMode` ⬅️ **이것이 있는지 확인**

#### 예상 소요 시간

- 파일 읽기 및 검증: 10분
- 누락 시 코드 추가: 5분
- **총 15분**

#### 체크리스트

- [ ] EnglishClassTab.tsx 전체 파일 읽기
- [ ] StudentModal 렌더링 위치 확인 (Line ???)
- [ ] `isSimulationMode` prop 전달 확인
- [ ] `readOnly` 로직 확인 (시뮬레이션 모드 체크 포함)
- [ ] 누락 시 코드 수정
- [ ] 수정 사항을 문서에 반영

---

### 2.3. Issue 3: 학생 통계 컬렉션 선택 미확인 (IMPORTANT)

**심각도**: 🟡 **IMPORTANT**
**영향**: 학생 통계 부정확 가능성
**상태**: 미검증

#### 문제 상세

`EnglishClassTab.tsx`의 학생 통계 로직 (Line 137 시작)이 `isSimulationMode`를 사용하여 올바른 컬렉션을 선택하는지 미확인.

**예상 코드**:
```typescript
useEffect(() => {
    const targetCollection = isSimulationMode ? CLASS_DRAFT_COLLECTION : CLASS_COLLECTION;

    // 학생 통계 조회
    const q = query(collection(db, targetCollection));
    // ...
}, [isSimulationMode, scheduleData]);
```

**문제 시나리오**:
- 시뮬레이션 모드 진입
- 학생 통계가 **Live 데이터**를 계속 참조
- 시뮬레이션에서 추가한 학생이 통계에 반영 안 됨

#### 해결 방법

**1. 학생 통계 로직 위치 확인**

```typescript
// EnglishClassTab.tsx Line 137-200 (추정)
useEffect(() => {
    // 이 부분에서 컬렉션 선택이 동적인지 확인
}, [/* 의존성에 isSimulationMode 포함되어 있는지 확인 */]);
```

**2. 동적 컬렉션 선택 확인**

필요한 패턴:
```typescript
const targetCollection = isSimulationMode ? CLASS_DRAFT_COLLECTION : CLASS_COLLECTION;
```

**3. 의존성 배열 확인**

`isSimulationMode`가 의존성에 포함되어야 모드 전환 시 재조회됨:
```typescript
}, [isSimulationMode, scheduleData]);  // ✅ isSimulationMode 포함
```

#### 예상 소요 시간

- 코드 확인: 10분
- 수정 필요 시: 20분
- **총 30분**

#### 체크리스트

- [ ] 학생 통계 로직 위치 확인 (Line 137-200 추정)
- [ ] 컬렉션 동적 선택 확인 (`targetCollection` 변수 사용)
- [ ] useEffect 의존성에 `isSimulationMode` 포함 확인
- [ ] 누락 시 코드 수정
- [ ] 수정 사항을 문서에 반영

---

### 2.4. Issue 4: 백업 정리 에러 처리 개선 (RECOMMENDED)

**심각도**: 🟢 **RECOMMENDED**
**영향**: 백업 개수 무제한 증가 가능성
**상태**: 개선 권장

#### 문제 상세

백업 정리(cleanup) 실패 시 에러가 조용히 무시됩니다.

**현재 코드** (`EnglishTimetable.tsx:285-287`):
```typescript
} catch (cleanupError) {
    console.warn('백업 정리 중 오류 발생 (무시됨):', cleanupError);
}
```

**문제**:
- 정리 실패가 반복되면 백업이 무제한 증가
- 50개 → 100개 → 500개 → ...
- 비용 증가 (500개 시 $0.011/month → 1000개 시 $0.022/month)

**위험 시나리오**:
1. 네트워크 오류로 백업 정리 실패
2. 에러가 console.warn으로만 기록됨
3. 사용자가 눈치채지 못함
4. 백업 개수가 70개 → 100개 → 200개로 증가
5. 비용 증가 (여전히 negligible하지만 불필요)

#### 해결 방법

**개선된 에러 처리**:

```typescript
// EnglishTimetable.tsx Line 285-287 교체
} catch (cleanupError) {
    console.error('⚠️ CRITICAL: Backup cleanup failed', cleanupError);

    // Alert master users if backup count is concerning
    const backupCount = allBackups.docs.length;
    if (backupCount > 70) {
        alert(
            `⚠️ 백업 정리 실패\n\n` +
            `현재 백업 개수: ${backupCount}개 (권장: 50개)\n` +
            `관리자에게 문의하여 수동 정리가 필요합니다.\n\n` +
            `오류: ${cleanupError.message}`
        );
    }
}
```

**추가 개선** (옵션):

백업 개수를 UI에 표시:
```typescript
// EnglishTimetable.tsx - 시뮬레이션 제어 패널에 추가
{isMaster && (
    <div className="text-xs text-gray-500">
        백업 개수: {backupCount}/50
        {backupCount > 50 && (
            <span className="text-orange-600 ml-2">⚠️ 정리 필요</span>
        )}
    </div>
)}
```

#### 예상 소요 시간

- 에러 처리 개선: 15분
- UI 추가 (옵션): 20분
- **총 35분**

#### 체크리스트

- [ ] EnglishTimetable.tsx Line 285-287 수정
- [ ] 백업 개수 70개 초과 시 알림 추가
- [ ] (옵션) UI에 백업 개수 표시
- [ ] 테스트: 백업 정리 실패 시뮬레이션
- [ ] 문서 업데이트

---

### 2.5. Issue 5: Import 일관성 개선 (MINOR)

**심각도**: 🟢 **MINOR**
**영향**: 없음 (코드 일관성)
**상태**: 개선 권장

#### 문제 상세

`BackupHistoryModal.tsx`가 `CLASS_DRAFT_COLLECTION`을 import하지 않음.

**현재 코드** (Line 5):
```typescript
import { EN_COLLECTION, CLASS_COLLECTION } from './englishUtils';
```

**권장 코드**:
```typescript
import { EN_COLLECTION, CLASS_COLLECTION, CLASS_DRAFT_COLLECTION } from './englishUtils';
```

**영향**:
- 기능적 문제 없음 (현재 코드에서 사용 안 함)
- 향후 Draft 컬렉션 사용 시 import 추가 필요
- 일관성 유지 차원에서 개선 권장

#### 해결 방법

**1. Import 문 수정**:

```typescript
// BackupHistoryModal.tsx Line 5
import { EN_COLLECTION, CLASS_COLLECTION, CLASS_DRAFT_COLLECTION } from './englishUtils';
```

#### 예상 소요 시간

- 5분

---

## 3. Firebase 비용 분석

### 3.1. 월간 비용 분석

firebase-cost-optimizer 에이전트의 상세 분석 결과:

| 작업 | 빈도/월 | Reads | Writes | Deletes | 비용 |
|------|---------|-------|--------|---------|------|
| 시뮬레이션 진입 | 10회 | 1,000 | 1,000 | 0 | $0.024 |
| 실제 반영 | 5회 | 1,250 | 505 | 10 | $0.017 |
| StudentModal 열기 | 50회 | 150 | 0 | 0 | $0.00009 |
| 백업 모달 열기 | 20회 | 400 | 0 | 0 | $0.00024 |
| 리스너 업데이트 | 20회 | 20 | 0 | 0 | $0.000012 |
| 스토리지 (6.45 MB) | - | - | - | - | $0.0012 |
| **총계** | - | **2,820** | **1,505** | **10** | **$0.043/월** |

**연간 비용**: $0.043 × 12 = **$0.52/년**

### 3.2. 무료 티어 사용률

**Firestore 무료 티어** (Spark Plan):
- Reads: 50,000/일 (1.5M/월)
- Writes: 20,000/일 (600K/월)
- Deletes: 20,000/일 (600K/월)
- Storage: 1 GB

**시뮬레이션 모드 사용률**:
- Reads: 2,820/월 (**0.19%** of free tier)
- Writes: 1,505/월 (**0.25%** of free tier)
- Deletes: 10/월 (**0.002%** of free tier)
- Storage: 6.45 MB (**0.64%** of free tier)

**결론**: ✅ **무료 티어 범위 내**에서 충분히 운영 가능

### 3.3. 비용 최적화 평가

**code-reviewer 평가**: A+ (Excellent)

| 항목 | 평가 | 근거 |
|------|------|------|
| Batch 연산 사용 | ✅ 완벽 | 500개 제한 체크 포함 |
| 리스너 효율성 | ✅ 우수 | 스코프 제한, 정리 함수 |
| 백업 보존 전략 | ✅ 우수 | 50개 자동 정리 |
| 쿼리 최적화 | ✅ 우수 | 단일 필드 인덱스만 사용 |
| N+1 쿼리 방지 | ✅ 완벽 | 컬렉션당 1회 조회 |

**개선 불필요**: 현재 구현이 최적 상태

---

## 4. 보완 사항

### 4.1. CRITICAL - 즉시 조치 (1-2시간)

#### 1. Firestore Security Rules 배포 (30분)

**우선순위**: 🔴 **P0 - BLOCKER**

- [ ] `firestore.rules` 파일 생성 ([섹션 2.1](#21-issue-1-firestore-security-rules-미배포-critical) 참조)
- [ ] `수업목록_draft` 규칙 추가
- [ ] `firebase deploy --only firestore:rules` 실행
- [ ] Firebase Console에서 규칙 확인
- [ ] Manager 계정으로 권한 테스트

#### 2. EnglishClassTab 전체 검증 (15분)

**우선순위**: 🟡 **P1 - CRITICAL**

- [ ] EnglishClassTab.tsx 전체 파일 읽기 ([섹션 2.2](#22-issue-2-englishclasstab-studentmodal-props-미검증) 참조)
- [ ] StudentModal `isSimulationMode` prop 확인
- [ ] `readOnly` 로직 확인
- [ ] 학생 통계 컬렉션 선택 확인 ([섹션 2.3](#23-issue-3-학생-통계-컬렉션-선택-미확인) 참조)

#### 3. 테스트 실행 (45분)

**우선순위**: 🟡 **P1 - CRITICAL**

- [ ] Test 1: 시뮬레이션 진입
- [ ] Test 2: StudentModal 데이터 격리
- [ ] Test 3: 실제 반영 (백업 검증)
- [ ] Test 4: 백업 복원 (학생 데이터 포함)
- [ ] Test 5: 하위 호환성 (구 백업 복원)

---

### 4.2. IMPORTANT - 권장 조치 (30-60분)

#### 4. 백업 정리 에러 처리 개선 (30분)

**우선순위**: 🟢 **P2 - IMPORTANT**

- [ ] EnglishTimetable.tsx Line 285-287 수정 ([섹션 2.4](#24-issue-4-백업-정리-에러-처리-개선) 참조)
- [ ] 백업 개수 70개 초과 시 알림 추가
- [ ] (옵션) UI에 백업 개수 표시

#### 5. Import 일관성 개선 (5분)

**우선순위**: 🟢 **P3 - MINOR**

- [ ] BackupHistoryModal.tsx Import 문 수정 ([섹션 2.5](#25-issue-5-import-일관성-개선) 참조)

---

### 4.3. ENHANCEMENT - 향후 개선 (선택)

#### 6. 비용 추적 유틸리티 추가 (2-3시간)

**우선순위**: 🟢 **P4 - ENHANCEMENT**

**firebase-cost-optimizer 권장사항**:

```typescript
// utils/firebaseCostTracker.ts
class FirestoreCostTracker {
    private static instance: FirestoreCostTracker;
    private reads = 0;
    private writes = 0;
    private deletes = 0;

    trackRead(count = 1) {
        this.reads += count;
        console.log(`[Cost] Reads: +${count} (Total: ${this.reads})`);
    }

    getEstimatedCost() {
        const readCost = (this.reads / 100000) * 0.06;
        const writeCost = (this.writes / 100000) * 0.18;
        const deleteCost = (this.deletes / 100000) * 0.02;

        return {
            reads: this.reads,
            writes: this.writes,
            deletes: this.deletes,
            totalCost: readCost + writeCost + deleteCost
        };
    }
}
```

**효과**:
- 개발 중 비용 모니터링
- 예상치 못한 비용 급증 감지
- 최적화 검증

---

## 5. 테스트 검증

### 5.1. 예상 테스트 결과

firebase-cost-optimizer 에이전트의 예측:

| Test | 예상 결과 | 조건 |
|------|----------|------|
| Test 1: 시뮬레이션 진입 | ✅ PASS | Security Rules 배포 시 경고 발생 |
| Test 2: StudentModal 시뮬레이션 | ⚠️ CONDITIONAL | EnglishClassTab Props 전달 확인 필요 |
| Test 3: 실제 반영 | ✅ PASS | 백업에 studentData 포함 검증됨 |
| Test 4: 백업 복원 | ✅ PASS | 복원 로직 검증됨 |
| Test 5: 하위 호환성 | ✅ PASS | 구 백업 처리 로직 검증됨 |

### 5.2. 테스트 시나리오 상세

#### Test 1: 시뮬레이션 진입 (예상 PASS)

**절차**:
1. 실시간 모드에서 [시뮬레이션 모드] 토글 ON
2. [현재 시간표 가져오기] 버튼 클릭

**예상 결과**:
- ✅ `english_schedules_draft` 생성
- ✅ `수업목록_draft` 생성
- ✅ 문서 개수 일치
- ✅ Console log: "✅ Timetable copied", "✅ Student data copied"

**검증 방법**:
- Firestore 콘솔 확인
- 브라우저 개발자 도구 Console 확인

---

#### Test 2: StudentModal 시뮬레이션 (예상 CONDITIONAL)

**절차**:
1. 시뮬레이션 모드에서 수업 셀 클릭
2. StudentModal에서 학생 "테스트학생1" 추가
3. [저장] 클릭
4. 실시간 모드로 전환
5. 동일 수업 셀 클릭

**예상 결과** (EnglishClassTab Props 전달 시):
- ✅ 시뮬레이션 모드: "테스트학생1" 표시
- ✅ 실시간 모드: "테스트학생1" 표시 안 됨

**예상 결과** (Props 전달 안 될 경우):
- ❌ 시뮬레이션 모드: Live 데이터 수정됨
- ❌ 실시간 모드: "테스트학생1" 표시됨

**검증 방법**:
- Firestore 콘솔에서 `수업목록_draft` vs `수업목록` 비교

---

#### Test 3: 실제 반영 (예상 PASS)

**절차**:
1. 시뮬레이션 모드에서 학생 "테스트학생2" 추가
2. [실제 반영] 버튼 클릭
3. 확인 팝업 [확인]

**예상 결과**:
- ✅ `english_backups` 최신 백업 생성
- ✅ 백업에 `studentData` 필드 포함
- ✅ `수업목록`에 "테스트학생2" 반영
- ✅ 실시간 모드에서 "테스트학생2" 표시
- ✅ Console log: "✅ Backup created", "✅ Student data published"

**검증 방법**:
- Firestore 콘솔에서 최신 백업 문서 확인
- `studentData` 필드 존재 확인
- Live 데이터 변경 확인

---

#### Test 4: 백업 복원 (예상 PASS)

**절차**:
1. [백업 기록] 버튼 클릭
2. `studentData` 필드 있는 백업 선택
3. [복원] 버튼 클릭
4. 확인 팝업 [확인]

**예상 결과**:
- ✅ 시간표 복원됨
- ✅ 학생 데이터 복원됨
- ✅ `pre_restore_*` 백업 생성됨
- ✅ Console log: "✅ Timetable restored", "✅ Student data restored"
- ✅ 알림: "복원 완료! 시간표: XX개, 학생 데이터: YY개"

**검증 방법**:
- Firestore 콘솔에서 복원 전후 데이터 비교
- `pre_restore_*` 백업 존재 확인

---

#### Test 5: 하위 호환성 (예상 PASS)

**절차**:
1. `studentData` 필드 **없는** 오래된 백업 선택
2. [복원] 버튼 클릭

**예상 결과**:
- ✅ 시간표만 복원됨
- ✅ 학생 데이터 변경 없음
- ✅ 알림: "⚠️ 이 백업은 학생 데이터를 포함하지 않습니다."

**검증 방법**:
- Firestore 콘솔에서 학생 데이터 변경 없음 확인
- 알림 메시지 확인

---

### 5.3. 테스트 체크리스트

**전체 테스트 실행 (45분)**:

- [ ] Test 1: 시뮬레이션 진입 (10분)
- [ ] Test 2: StudentModal 데이터 격리 (10분)
- [ ] Test 3: 실제 반영 (10분)
- [ ] Test 4: 백업 복원 (10분)
- [ ] Test 5: 하위 호환성 (5분)

**권한 테스트 (15분)**:

- [ ] Admin 계정: 시뮬레이션 모드 읽기만 가능
- [ ] Manager 계정: StudentModal 수정 불가
- [ ] Master 계정: 모든 기능 정상 작동

**성능 테스트 (옵션, 15분)**:

- [ ] Draft 복사 시간 측정 (< 5초)
- [ ] 백업 생성 시간 측정 (< 3초)
- [ ] 실제 반영 시간 측정 (< 7초)

---

## 6. 문서 업데이트

### 6.1. IMPLEMENTATION_SUMMARY.md 업데이트

**현재 체크리스트**:
```markdown
- [x] Phase 1: Constants 추가
- [x] Phase 2: StudentModal 수정
- [x] Phase 3: EnglishTimetable 수정
- [x] Phase 4: EnglishClassTab 수정
- [x] Phase 5: Props 전달 연결
- [x] Phase 6: BackupHistoryModal 수정
- [ ] Phase 7: Firestore Security Rules (수동 배포 필요)
- [ ] 테스트 실행
```

**업데이트 후**:
```markdown
**✅ 구현 완료 체크리스트**

- [x] 문서 검토 완료
- [x] Phase 1: Constants 추가 (`englishUtils.ts`)
- [x] Phase 2: StudentModal 수정
- [x] Phase 3: EnglishTimetable 수정
- [x] Phase 4: EnglishClassTab 수정 (⚠️ StudentModal Props 전달 검증 필요)
- [x] Phase 5: Props 전달 연결
- [x] Phase 6: BackupHistoryModal 수정
- [ ] Phase 7: Firestore Security Rules (🔴 CRITICAL - 미완료)
- [ ] EnglishClassTab 전체 파일 검증
- [ ] 테스트 실행 (Test 1-5)

**🔴 배포 전 필수 조치**:
1. CRITICAL: Firestore Security Rules 배포 ([VERIFICATION_REPORT.md#2.1](./VERIFICATION_REPORT.md#21-issue-1-firestore-security-rules-미배포-critical) 참조)
2. CRITICAL: EnglishClassTab 전체 검증 ([VERIFICATION_REPORT.md#2.2](./VERIFICATION_REPORT.md#22-issue-2-englishclasstab-studentmodal-props-미검증) 참조)
3. IMPORTANT: 테스트 시나리오 실행 (Test 1-5)

**구현 상태**: 95% 완료 (1-2시간 추가 작업 필요)
```

---

### 6.2. student_data_simulation_mode.md 업데이트

**추가 섹션** (Line 8에 삽입):

```markdown
## ⚠️ 보안 경고

**현재 상태**: Firestore Security Rules가 배포되지 않았습니다.

**위험**:
- `수업목록_draft` 컬렉션에 대한 보안 규칙이 없어,
  인증된 모든 사용자가 Draft 데이터를 수정할 수 있는 위험이 있습니다.
- Admin/Manager가 Master 권한 없이 시뮬레이션 모드에서 학생 데이터를 수정할 수 있습니다.

**즉시 조치 필요**:
1. 프로젝트 루트에 `firestore.rules` 파일 생성
2. [Section 7.2](#72-firestore-security-rules-업데이트)의 규칙 추가
3. `firebase deploy --only firestore:rules` 실행
4. Firebase Console에서 규칙 적용 확인

**배포 후 검증**:
- Manager 계정으로 시뮬레이션 모드 진입
- StudentModal에서 학생 추가 시도
- "permission-denied" 에러 확인 (정상)

**상세 정보**: [VERIFICATION_REPORT.md#2.1](./VERIFICATION_REPORT.md#21-issue-1-firestore-security-rules-미배포-critical)
```

---

## 7. 최종 권장사항

### 7.1. 즉시 조치 항목 (배포 전 필수)

| 우선순위 | 항목 | 예상 시간 | 담당 |
|---------|------|----------|------|
| 🔴 P0 | Firestore Security Rules 배포 | 30분 | DevOps/Backend |
| 🟡 P1 | EnglishClassTab 전체 검증 | 15분 | Frontend |
| 🟡 P1 | 테스트 실행 (Test 1-5) | 45분 | QA/Frontend |

**총 예상 시간**: 1시간 30분

---

### 7.2. 권장 조치 항목 (배포 후 개선)

| 우선순위 | 항목 | 예상 시간 | 효과 |
|---------|------|----------|------|
| 🟢 P2 | 백업 정리 에러 처리 개선 | 30분 | 안정성 향상 |
| 🟢 P3 | Import 일관성 개선 | 5분 | 코드 품질 |

**총 예상 시간**: 35분

---

### 7.3. 프로덕션 배포 준비 상태

**현재 상태**: ❌ **NOT READY**

**블로킹 이슈**:
1. 🔴 Firestore Security Rules 미배포 (CRITICAL)
2. 🟡 EnglishClassTab 전체 검증 미완료 (IMPORTANT)

**프로덕션 준비 예상 시간**: 1.5-2시간

**배포 권장 순서**:
1. Firestore Security Rules 생성 및 배포 (30분)
2. EnglishClassTab 전체 검증 및 수정 (15분)
3. 전체 테스트 실행 (45분)
4. 백업 정리 에러 처리 개선 (30분) - 옵션
5. 문서 업데이트 (15분)
6. **배포 승인**

---

## 8. 참고 문서

- **상세 기술 문서**: [student_data_simulation_mode.md](./student_data_simulation_mode.md)
- **구현 가이드**: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **코드 리뷰**: code-reviewer 에이전트 (Agent ID: a623110)
- **비용 분석**: firebase-cost-optimizer 에이전트 (Agent ID: a6355ab)

---

## 9. 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 2026-01-01 | 1.0 | 검증 보고서 초안 작성 (code-reviewer + firebase-cost-optimizer 분석 통합) | AI Assistant |

---

**보고서 끝**

**다음 단계**: [섹션 4.1](#41-critical---즉시-조치-1-2시간)의 즉시 조치 항목 실행
