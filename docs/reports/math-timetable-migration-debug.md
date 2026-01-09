# 수학 시간표 새 구조 전환 디버깅 보고서

**작성일**: 2026-01-09
**상태**: 🔴 마이그레이션 재실행 필요
**우선순위**: HIGH

---

## 📋 현재 상황 요약

### 문제 현상
- ✅ **영어 시간표**: 정상 작동 (토글 ON/OFF 모두)
- ❌ **수학 시간표**: 토글 OFF(기존 구조)는 정상, 토글 ON(새 구조)에서 **비어있음**

### 데이터 구조 토글
- **토글 OFF**: `수업목록` 컬렉션에서 데이터 조회 (기존 방식)
- **토글 ON**: `students/{studentId}/enrollments` 구조에서 데이터 조회 (새 방식)

### 영향 범위
- 시간표 표시 기능 전체
- 학생 관리 탭 (향후)
- 출석부 동기화 (향후)

---

## 🔍 근본 원인 분석

### 원인 1: `schedule` 필드 누락 (CRITICAL)

**위치**: `scripts/migrateToEnrollments.ts:77-92`

**문제**:
마이그레이션 스크립트가 `schedule` 필드를 enrollment 문서에 복사하지 않음

```typescript
// ❌ 기존 코드 (BEFORE)
await setDoc(enrollmentRef, {
  subject: 'math',
  className: classData.name || classDoc.id,
  teacherId: classData.teacher || '',
  days: classData.days || [],
  // ⚠️ schedule 필드 누락!!!
  period: classData.period || null,
  room: classData.room || null,
  startDate: classData.startDate || null,
  endDate: classData.endDate || null,
  color: classData.color || null,
  migratedAt: Timestamp.now(),
  migratedFrom: 'math_timetable',
  originalClassId: classDoc.id
});
```

**왜 중요한가?**

`schedule` 필드는 시간표 표시의 핵심:

1. **`TimetableClass` 인터페이스에서 필수 필드**
   ```typescript
   // types.ts:483-494
   export interface TimetableClass {
     id: string;
     className: string;
     teacher: string;
     subject: string;
     schedule: string[];   // ← 필수! ["월 1교시", "수 3교시"]
     studentList?: TimetableStudent[];
     // ...
   }
   ```

2. **시간표 셀 배치에 사용**
   - 값 예시: `["화 2-2", "화 2-1", "목 3-1"]`
   - 각 문자열이 요일과 교시를 나타냄
   - 이 정보가 없으면 어느 시간대에도 배치되지 않음 → 빈 화면

3. **영어는 왜 작동하는가?**
   - 영어 마이그레이션 부분도 확인 필요
   - 또는 영어 시간표가 다른 데이터 소스 사용 가능성

### 원인 2: `className` 필드명 불일치 가능성

**문제**:
`수업목록` 컬렉션의 필드명이 `className`이 아니라 `name`일 수 있음

```typescript
// 기존 코드
className: classData.name || classDoc.id,  // 'name' 필드만 체크

// 실제 Firestore에는 'className' 필드로 저장되어 있을 수 있음
```

---

## ✅ 적용된 수정 사항

### 수정 1: 마이그레이션 스크립트 업데이트

**파일**: `scripts/migrateToEnrollments.ts:77-92`

**변경 내용**:

```typescript
// ✅ 수정된 코드 (AFTER)
await setDoc(enrollmentRef, {
  subject: 'math',
  className: classData.className || classData.name || classDoc.id, // ✅ 양쪽 필드명 체크
  teacherId: classData.teacher || '',
  schedule: classData.schedule || [],  // ✅ CRITICAL: 시간표 표시에 필수
  days: classData.days || [],
  period: classData.period || null,
  room: classData.room || null,
  startDate: classData.startDate || null,
  endDate: classData.endDate || null,
  color: classData.color || null,
  // 마이그레이션 메타데이터
  migratedAt: Timestamp.now(),
  migratedFrom: 'math_timetable',
  originalClassId: classDoc.id
});
```

**핵심 변경**:
1. ✅ `schedule: classData.schedule || []` 추가
2. ✅ `className: classData.className || classData.name` 필드명 양쪽 체크

### 수정 2: 디버깅 로그 추가

#### A. `hooks/useEnrollments.ts`

enrollment 데이터 변환 과정 추적:

```typescript
console.log(`[useEnrollmentsAsClasses] Total enrollment docs fetched: ${snapshot.docs.length}`);
console.log(`[useEnrollmentsAsClasses] Subject breakdown:`, {
    math: enrollments.filter(e => e.subject === 'math').length,
    english: enrollments.filter(e => e.subject === 'english').length,
    other: enrollments.filter(e => e.subject !== 'math' && e.subject !== 'english').length,
});
console.log(`[useEnrollmentsAsClasses] After filtering by subject '${subject}': ${filteredEnrollments.length} enrollments`);
console.log(`[useEnrollmentsAsClasses] Created ${classes.length} classes from ${classMap.size} unique classNames`);
console.log(`[useEnrollmentsAsClasses] Sample ${subject} classes:`, classes.slice(0, 3).map(c => ({
    className: c.className,
    teacher: c.teacher,
    studentCount: c.studentList.length,
})));
```

#### B. `components/Timetable/Math/hooks/useTimetableClasses.ts`

시간표 컴포넌트에서 받은 데이터 확인:

```typescript
console.log('[useTimetableClasses] Using NEW structure');
console.log('[useTimetableClasses] enrollmentClasses:', enrollmentClasses?.length || 0, 'classes');
console.log('[useTimetableClasses] enrollmentLoading:', enrollmentLoading);
```

---

## 📝 다음 단계 (필수 실행 순서)

### ⚠️ Step 1: 마이그레이션 재실행 (가장 중요!)

**이유**:
현재 Firestore의 enrollment 문서들에 `schedule` 필드가 없음. 시간표에 표시하려면 이 데이터가 필수.

#### Option A: UI를 통한 재마이그레이션 (권장) ⭐

```
1. 브라우저에서 학원 관리 시스템 접속
2. 상단 네비게이션 → "설정" 탭 클릭
3. 좌측 메뉴 → "데이터 마이그레이션" 선택
4. "마이그레이션 시작" 버튼 클릭
5. 진행 상황 모니터링:
   - 로그 창에서 실시간 진행 확인
   - 예상 시간: 1-3분 (725개 enrollment 생성)

6. 완료 후 확인 사항:
   ✅ "마이그레이션 완료" 메시지
   ✅ 총 enrollment 개수: ~725개
   ✅ 에러 개수: 0개
   ✅ 처리된 학생 수: ~432명
```

#### Option B: CLI 스크립트 실행

터미널에서 실행:

```bash
# 프로젝트 루트 디렉토리에서
npx tsx scripts/migrateToEnrollments.ts
```

**예상 출력**:
```
📘 수학 시간표 마이그레이션 시작...
   발견된 수학 수업: 45개
   처리 중: 초등M ±6 정규반2 (학생 15명)
   ...

📗 영어 시간표 마이그레이션 시작...
   ...

✅ 마이그레이션 완료!
   - 수학 enrollments: 500개
   - 영어 enrollments: 225개
   - 총 학생 수: 432명
   - 에러: 0개
```

#### ⚠️ 주의사항

- **덮어쓰기**: 기존 enrollment 문서를 덮어씀 (같은 학생의 같은 수업)
- **안전성**: `수업목록` 컬렉션은 **절대 삭제되지 않음**
- **롤백**: 언제든 토글 OFF로 기존 방식 복귀 가능

---

### Step 2: 브라우저에서 검증

#### 2-1. 콘솔 로그 확인

1. **브라우저 개발자 도구 열기**
   - Windows: `F12` 또는 `Ctrl+Shift+I`
   - Mac: `Cmd+Option+I`

2. **Console 탭 선택**

3. **토글 전환**
   - 설정 탭 → 데이터 마이그레이션
   - "데이터 구조 전환" 토글 **ON**
   - 페이지 새로고침 확인 (confirm 창에서 "확인" 클릭)

4. **수학 시간표 탭으로 이동**

5. **예상 콘솔 출력**:

```javascript
[useEnrollmentsAsClasses] Total enrollment docs fetched: 725
[useEnrollmentsAsClasses] Parsed enrollments: 725
[useEnrollmentsAsClasses] Subject breakdown: {
  math: 500,
  english: 225,
  other: 0
}
[useEnrollmentsAsClasses] After filtering by subject 'math': 500 enrollments
[useEnrollmentsAsClasses] Created 45 classes from 45 unique classNames
[useEnrollmentsAsClasses] Sample math classes: [
  { className: "초등M ±6 정규반2", teacher: "김민주", studentCount: 15 },
  { className: "초등M ±4 정규반1", teacher: "김민주", studentCount: 12 },
  { className: "중등M 중2 집중반", teacher: "이서연", studentCount: 8 }
]

[useTimetableClasses] Using NEW structure
[useTimetableClasses] enrollmentClasses: 45 classes
[useTimetableClasses] enrollmentLoading: false
```

#### 2-2. 시간표 UI 확인

**체크리스트**:

- [ ] 수학 시간표에 수업 카드들이 표시됨
- [ ] 각 수업 카드에 학생 목록이 표시됨
- [ ] 시간대별로 올바른 위치에 배치됨
- [ ] 요일 필터링 작동 (월~일 선택 시)
- [ ] 검색 기능 작동 (학생 이름 검색)
- [ ] 수업 카드 클릭 시 상세 모달 열림

**예상 화면**:
```
┌─────────────────────────────────────────┐
│  수학 시간표 (2026년 1월 6일 주차)      │
├─────────────────────────────────────────┤
│ 월  화  수  목  금  토  일              │
├─────────────────────────────────────────┤
│    [초등M ±6 정규반2]                   │
│     - 강민준                            │
│     - 강수정                            │
│     - ... (15명)                        │
└─────────────────────────────────────────┘
```

#### 2-3. 토글 OFF 상태도 확인

1. 설정 탭 → 토글 **OFF**
2. 페이지 새로고침
3. 수학 시간표가 **동일하게** 표시되는지 확인

---

### Step 3: 문제 지속 시 추가 디버깅

만약 Step 2 후에도 시간표가 비어있다면:

#### 3-1. Firebase Console에서 수동 확인

1. **Firebase Console 접속**
   - https://console.firebase.google.com
   - 프로젝트 선택

2. **Firestore Database로 이동**

3. **students 컬렉션 확인**
   - 임의의 학생 문서 선택 (예: "강민준_침산초_4")
   - `enrollments` 서브컬렉션 확인

4. **enrollment 문서 내용 확인**

**예상 필드 (정상)**:
```javascript
{
  subject: "math",
  className: "초등M ±6 정규반2",
  teacherId: "김민주",
  schedule: ["화 2-2", "화 2-1", "목 3-1"],  // ← 이 필드 확인!
  days: ["화", "목"],
  room: "301호",
  startDate: "2024-03-01",
  endDate: null,
  migratedAt: Timestamp(2026-01-09 ...),
  migratedFrom: "math_timetable",
  originalClassId: "..."
}
```

**⚠️ 문제 상황**:
```javascript
{
  subject: "math",
  className: "초등M ±6 정규반2",
  teacherId: "김민주",
  // schedule 필드 없음! ← 이 경우 마이그레이션 재실행 필요
  days: ["화", "목"],
  // ...
}
```

#### 3-2. 콘솔에서 수동 쿼리 테스트

브라우저 개발자 도구 Console에서 실행:

```javascript
// Firestore 모듈 import (이미 로드되어 있음)
import { collection, getDocs, collectionGroup, query } from 'firebase/firestore';
import { db } from './firebaseConfig';

// 모든 enrollments 조회
const enrollmentsQuery = query(collectionGroup(db, 'enrollments'));
const snapshot = await getDocs(enrollmentsQuery);

console.log('Total enrollments:', snapshot.docs.length);

// 첫 5개 enrollment의 schedule 필드 확인
snapshot.docs.slice(0, 5).forEach(doc => {
  const data = doc.data();
  console.log({
    studentId: doc.ref.parent.parent?.id,
    className: data.className,
    schedule: data.schedule,  // ← undefined이면 마이그레이션 재실행!
    scheduleLength: data.schedule?.length || 0,
    subject: data.subject
  });
});

// Math 과목만 필터링
const mathEnrollments = snapshot.docs.filter(doc => doc.data().subject === 'math');
console.log('Math enrollments:', mathEnrollments.length);

// schedule 없는 enrollment 개수
const missingSchedule = snapshot.docs.filter(doc => !doc.data().schedule || doc.data().schedule.length === 0);
console.log('Enrollments missing schedule:', missingSchedule.length);
```

**정상 출력 예시**:
```javascript
Total enrollments: 725
{
  studentId: "강민준_침산초_4",
  className: "초등M ±6 정규반2",
  schedule: ["화 2-2", "화 2-1", "목 3-1"],
  scheduleLength: 3,
  subject: "math"
}
...
Math enrollments: 500
Enrollments missing schedule: 0  // ← 0이어야 정상!
```

**문제 출력 예시**:
```javascript
Total enrollments: 725
{
  studentId: "강민준_침산초_4",
  className: "초등M ±6 정규반2",
  schedule: undefined,  // ← 문제!
  scheduleLength: 0,
  subject: "math"
}
...
Enrollments missing schedule: 725  // ← 모두 schedule 없음!
```

#### 3-3. 원본 데이터 확인

`수업목록` 컬렉션에 `schedule` 필드가 있는지 확인:

```javascript
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';

const classesSnapshot = await getDocs(collection(db, '수업목록'));
console.log('Total classes:', classesSnapshot.docs.length);

classesSnapshot.docs.slice(0, 3).forEach(doc => {
  const data = doc.data();
  console.log({
    id: doc.id,
    className: data.className || data.name,
    schedule: data.schedule,
    scheduleExists: !!data.schedule
  });
});
```

**만약 원본에도 schedule이 없다면**:
- 데이터 구조 자체가 다를 수 있음
- 영어 시간표가 작동하는 이유 조사 필요
- 별도 로직으로 schedule 생성 필요

---

## 📊 예상 결과

### 마이그레이션 재실행 후

#### Firestore 데이터
```
students (컬렉션)
├── 강민준_침산초_4
│   └── enrollments (서브컬렉션)
│       ├── {enrollmentId1}
│       │   ├── subject: "math"
│       │   ├── className: "초등M ±6 정규반2"
│       │   ├── schedule: ["화 2-2", "화 2-1", "목 3-1"]  ✅
│       │   └── ...
│       └── {enrollmentId2} (영어 수업)
│           └── ...
├── 강수정_침산초_4
│   └── enrollments
│       └── ...
└── ... (432명 학생)

총 enrollment 문서: ~725개
- Math: ~500개
- English: ~225개
```

#### 시간표 표시
```
토글 OFF (기존 구조):
  ✅ 수업목록 컬렉션에서 직접 조회
  ✅ 정상 표시 (변화 없음)

토글 ON (새 구조):
  ✅ students/enrollments에서 조회
  ✅ className별로 그룹화
  ✅ 동일한 시간표 표시
  ✅ 수학/영어 모두 정상 작동
```

---

## 🔧 관련 파일 목록

### 수정 완료 파일

| 파일 | 수정 내용 | 중요도 |
|------|----------|--------|
| `scripts/migrateToEnrollments.ts` | schedule 필드 추가, className 필드명 양쪽 체크 | 🔴 HIGH |
| `hooks/useEnrollments.ts` | 디버깅 로그 추가 (데이터 변환 과정) | 🟡 MEDIUM |
| `components/Timetable/Math/hooks/useTimetableClasses.ts` | 디버깅 로그 추가 (컴포넌트 레벨) | 🟡 MEDIUM |

### 듀얼 모드 지원 파일

| 파일 | 기능 | 상태 |
|------|------|------|
| `hooks/useClasses.ts` | localStorage 토글에 따라 old/new 구조 선택 | ✅ 완료 |
| `components/settings/MigrationTab.tsx` | 마이그레이션 UI, 토글 제어, 캐시 무효화 | ✅ 완료 |
| `hooks/useEnrollments.ts` | collectionGroup으로 enrollments 조회 | ✅ 완료 |

### 타입 정의 파일

| 파일 | 내용 |
|------|------|
| `types.ts:483-494` | `TimetableClass` 인터페이스 (schedule 필수 필드) |
| `hooks/useEnrollments.ts:6-20` | `EnrollmentInfo` 인터페이스 |

### 문서 파일

| 파일 | 내용 |
|------|------|
| `docs/MIGRATION_GUIDE.md` | 전체 마이그레이션 가이드 |
| `docs/reports/math-timetable-migration-debug.md` | 본 디버깅 보고서 |

---

## 🎯 핵심 요약

### 문제
토글 ON 시 수학 시간표 비어있음

### 원인
마이그레이션 시 `schedule` 필드 누락 → 시간표에 배치할 정보 없음

### 해결책
1. 마이그레이션 스크립트 수정 (✅ 완료)
2. 마이그레이션 재실행 (⚠️ **필수**)
3. 브라우저에서 검증

### 안전성
- ✅ 기존 `수업목록` 컬렉션 보존
- ✅ 토글 OFF로 언제든 롤백 가능
- ✅ 학생 데이터 영구 보존

---

## 📅 타임라인

| 날짜 | 작업 | 상태 |
|------|------|------|
| 2026-01-09 | 데이터 마이그레이션 최초 실행 (schedule 필드 누락) | ✅ 완료 |
| 2026-01-09 | 문제 발견: 토글 ON 시 수학 시간표 비어있음 | ✅ 확인 |
| 2026-01-09 | 마이그레이션 스크립트 수정 | ✅ 완료 |
| 2026-01-09 | 디버깅 로그 추가 | ✅ 완료 |
| **다음** | **마이그레이션 재실행** | ⚠️ **대기 중** |
| 향후 | 학생 관리 모달 새 구조 전환 (Phase 2) | 🔵 계획 |

---

## 🚨 긴급 조치 사항

### 우선순위 1: 마이그레이션 재실행
- **담당**: 시스템 관리자 (Master 권한 필요)
- **예상 소요**: 1-3분
- **위험도**: 낮음 (기존 데이터 보존)

### 우선순위 2: 검증
- **담당**: 개발자 + 사용자
- **예상 소요**: 5-10분
- **확인 항목**: 콘솔 로그 + 시간표 UI

### 우선순위 3: 디버깅 로그 제거 (선택)
- **담당**: 개발자
- **시점**: 검증 완료 후
- **이유**: 프로덕션 환경에서 console.log 제거

---

## 📞 문의 및 지원

문제 발생 시:
1. 브라우저 콘솔 로그 캡처
2. Firebase Console의 enrollment 문서 스크린샷
3. 개발팀에 전달

긴급 롤백:
1. 설정 탭 → 토글 OFF
2. 페이지 새로고침
3. 기존 방식으로 즉시 복귀

---

## 🎉 업데이트: 마이그레이션 성공!

**날짜**: 2026-01-10 오전 2:05

### ✅ 확인 완료
- 수학 시간표가 토글 ON 상태(새 구조)에서 **정상 표시**됨
- 수업 카드들이 올바른 위치에 배치됨
- 학생 목록이 각 수업에 표시됨

### ⚠️ 발견된 추가 문제: React Key 중복 경고

**증상**:
브라우저 콘솔에 "Encountered two children with the same key" 경고 다수 발생

**원인**:
`hooks/useEnrollments.ts:119`에서 클래스 ID 생성 로직:
```typescript
id: `${classData.subject}_${classData.className}_${index}`
```

같은 `className`을 가진 수업들이 여러 개 있을 경우, `index`만으로는 고유성이 보장되지 않음.

**해결 방법**:
더 고유한 ID 생성 필요:
```typescript
// Before
id: `${classData.subject}_${classData.className}_${index}`

// After (제안)
id: `${classData.subject}_${classData.className}_${classData.teacher}_${index}`
// 또는
id: crypto.randomUUID() // 완전히 고유한 ID
```

**우선순위**: 🟡 MEDIUM (기능은 작동하나 성능 및 안정성 개선 필요)

**수정 완료**: ✅ [hooks/useEnrollments.ts:122](hooks/useEnrollments.ts#L122)에서 ID에 teacher 포함하도록 수정

### ⚠️ 발견된 추가 문제 2: 학생 이름 표시 형식 오류

**증상**:
학생 이름이 `공서연_칠성초_5` 형식으로 표시됨 (원래는 `공서연/칠성초5` 또는 이름만 표시)

**원인**:
`hooks/useEnrollments.ts`에서 `studentId`를 그대로 `name`으로 사용:
```typescript
// Before
studentList.push({
  id: enrollment.studentId,  // "공서연_칠성초_5"
  name: enrollment.studentName,  // studentId 그대로 사용
});
```

**해결 방법**: ✅ 완료
`studentId`를 파싱해서 `name`, `school`, `grade`로 분리:
```typescript
// After
const parseStudentId = (id: string) => {
  const parts = id.split('_');
  if (parts.length >= 3) {
    return {
      name: parts[0],    // "공서연"
      school: parts[1],  // "칠성초"
      grade: parts[2]    // "5"
    };
  }
  return { name: id, school: '', grade: '' };
};

const parsedInfo = parseStudentId(enrollment.studentId);

studentList.push({
  id: enrollment.studentId,
  name: parsedInfo.name,      // "공서연"
  school: parsedInfo.school,  // "칠성초"
  grade: parsedInfo.grade,    // "5"
});
```

**우선순위**: 🟢 LOW (이미 수정 완료, 브라우저 새로고침 필요)

---

## 📝 최종 체크리스트

### ✅ 완료된 작업
1. 마이그레이션 스크립트 수정 (`schedule` 필드 추가)
2. 마이그레이션 재실행 (725개 enrollment 생성)
3. 수학 시간표 정상 표시 확인
4. React key 중복 문제 해결
5. 학생 이름 표시 형식 수정

### 🔄 다음 단계
1. **브라우저 새로고침** - 학생 이름 형식 확인
2. **영어 시간표 테스트** - 토글 ON 상태에서 확인
3. **디버깅 로그 제거** (프로덕션 배포 전)
   - `hooks/useEnrollments.ts`: lines 34, 58-62, 68, 72-76, 133-140
   - `components/Timetable/Math/hooks/useTimetableClasses.ts`: lines 28, 42-44

### 🎯 성공 기준
- [x] 수학 시간표 표시
- [x] 학생 목록 표시
- [x] React key 경고 없음
- [ ] 학생 이름 올바른 형식 (새로고침 후 확인)

---

**보고서 끝**
