# TypeScript 오류 분석 보고서

**날짜**: 2026-01-13  
**분석자**: Kombai AI Assistant  
**프로젝트**: InjaeWon Calendar Application

---

## 📋 목차

1. [개요](#개요)
2. [오류 통계](#오류-통계)
3. [카테고리별 오류 분석](#카테고리별-오류-분석)
4. [우선순위별 해결 방안](#우선순위별-해결-방안)
5. [영향도 분석](#영향도-분석)
6. [권장 조치사항](#권장-조치사항)

---

## 개요

Type checking 과정에서 총 **31개의 TypeScript 오류**가 발견되었습니다. 이 오류들은 주로 타입 정의 불일치, 누락된 속성, 그리고 제네릭 타입 처리와 관련된 문제들입니다.

### 주요 발견사항
- ✅ Firebase listener cleanup 작업과 **무관한 기존 코드베이스 이슈**
- ⚠️ 대부분 런타임에는 영향 없으나 타입 안전성 저하
- 🔧 일부는 간단한 타입 정의 업데이트로 해결 가능

---

## 오류 통계

| 카테고리 | 개수 | 비율 |
|---------|------|------|
| Type Mismatch | 12 | 38.7% |
| Missing Properties | 7 | 22.6% |
| Generic Type Issues | 6 | 19.4% |
| Enum/Union Issues | 4 | 12.9% |
| Function Signature | 2 | 6.5% |
| **Total** | **31** | **100%** |

### 영향받는 파일

| 파일 | 오류 개수 |
|------|----------|
| hooks/useClasses.ts | 8 |
| hooks/useGanttDepartments.ts | 6 |
| components/ClassManagement/*.tsx | 5 |
| hooks/useExams.ts | 4 |
| components/Gantt/GanttBuilder.tsx | 2 |
| components/settings/tabs/DepartmentsManagementTab.tsx | 1 |
| components/StudentManagement/tabs/GradesTab.tsx | 1 |
| App.tsx | 1 |
| Others | 3 |

---

## 카테고리별 오류 분석

### 1. Type Mismatch Issues (12개)

#### 🔴 Critical: SubjectType 불일치
**파일**: `components/ClassManagement/ClassDetailModal.tsx`, `EditClassModal.tsx`

```typescript
// 오류: SubjectType ('science') → 'math' | 'english'만 허용
Type 'SubjectType' is not assignable to type '"math" | "english"'.
Type '"science"' is not assignable to type '"math" | "english"'.
```

**원인**: 
- `SubjectType`는 `'math' | 'english' | 'science' | 'korean' | 'other'`로 정의됨
- 일부 컴포넌트/함수는 `'math' | 'english'`만 허용

**영향도**: ⚠️ Medium
- ClassManagement 모듈에서 science, korean 등 과목 사용 불가
- 데이터 무결성 문제 가능

**해결 방안**:
```typescript
// Option 1: 함수 타입 확장
function someFunction(subject: SubjectType) { ... }

// Option 2: 타입 가드 추가
if (subject === 'math' || subject === 'english') {
  // Only allow math/english operations
}

// Option 3: 별도 타입 정의
type MathEnglishSubject = Extract<SubjectType, 'math' | 'english'>;
```

---

#### 🔴 Critical: unknown 타입 속성 접근
**파일**: `hooks/useClasses.ts`

```typescript
// 오류: Property 'schedule' does not exist on type 'unknown'
Property 'schedule' does not exist on type 'unknown'.
Property 'className' does not exist on type 'unknown'.
// ... (8개 속성)
```

**원인**: 
- Firestore 문서를 `unknown`으로 반환
- 명시적 타입 캐스팅 누락

**영향도**: 🔥 High
- useClasses 훅 전체가 타입 체크 통과 못함
- 런타임에는 동작하나 IDE 지원 부족

**해결 방안**:
```typescript
// Before
const data = doc.data(); // unknown
const schedule = data.schedule; // ❌ Error

// After
const data = doc.data() as UnifiedClass;
const schedule = data.schedule; // ✅ OK

// Or use Firestore converter
const classConverter = {
  toFirestore: (cls: UnifiedClass) => cls,
  fromFirestore: (snapshot: QueryDocumentSnapshot) => 
    snapshot.data() as UnifiedClass
};
```

---

### 2. Missing Properties (7개)

#### 🟡 Medium: GanttDepartment 누락 속성
**파일**: `hooks/useGanttDepartments.ts`

```typescript
// 오류: Property 'color' is missing
Property 'color' is missing in type '{ id: string; label: string; order: number; }'
```

**원인**:
- `GanttDepartment` 인터페이스에 `color: string` 필수 속성
- 기본값 생성 시 color 누락

**영향도**: ⚠️ Medium
- Gantt 차트 색상 표시 안됨
- 기능적으로는 동작 가능

**해결 방안**:
```typescript
// Before
const DEFAULT_DEPARTMENTS: GanttDepartment[] = [
  { id: 'dev', label: '개발', order: 0 }, // ❌
];

// After
const DEFAULT_DEPARTMENTS: GanttDepartment[] = [
  { id: 'dev', label: '개발', order: 0, color: '#3B82F6' }, // ✅
];
```

---

#### 🟡 Medium: Exam 타입 scope 속성 누락
**파일**: `components/StudentManagement/tabs/GradesTab.tsx`

```typescript
// 오류: Property 'scope' is missing
Property 'scope' is missing in type '{ title: string; date: string; ... }'
```

**원인**:
- `Exam` 인터페이스에 새로 추가된 `scope` 속성
- 기존 생성 코드에서 누락

**영향도**: ⚠️ Medium
- 시험 범위 정보 없이 저장됨
- UI에서 범위 표시 불가

**해결 방안**:
```typescript
// Add scope to exam creation
const newExam = {
  title: examTitle,
  date: examDate,
  type: examType,
  subject: examSubject,
  maxScore: maxScore,
  scope: 'midterm', // ✅ Add this
  createdBy: currentUser.uid,
  createdByName: currentUser.displayName
};
```

---

#### 🟡 Medium: userProfile prop 불일치
**파일**: `App.tsx` → `StaffManager`

```typescript
// 오류: Property 'userProfile' does not exist
Type '{ userProfile: UserProfile; }' is not assignable to 
type 'IntrinsicAttributes & StaffManagerProps'.
```

**원인**:
- `StaffManager` 컴포넌트가 `userProfile` prop을 받지 않음
- App.tsx에서 전달하려 시도

**영향도**: 🟢 Low
- StaffManager 내부에서 useAuth 등으로 가져올 수 있음

**해결 방안**:
```typescript
// Option 1: Remove prop from App.tsx
<StaffManager /> // ✅

// Option 2: Add to StaffManagerProps
interface StaffManagerProps {
  userProfile?: UserProfile; // Add this
}
```

---

### 3. Generic Type Issues (6개)

#### 🟡 Medium: React Query 타입 추론 실패
**파일**: `components/Gantt/GanttBuilder.tsx`

```typescript
// 오류: Property 'map' does not exist on type 'any[] | NoInfer<TQueryFnData>'
Property 'map' does not exist on type 'NoInfer<TQueryFnData>'.
```

**원인**:
- React Query의 `data` 타입이 union으로 추론됨
- TypeScript가 `map` 메서드 존재 확인 불가

**영향도**: 🟢 Low
- 런타임에는 정상 동작
- IDE autocomplete 제한

**해결 방안**:
```typescript
// Before
const departments = useDepartments();
departments.map(d => ...) // ❌

// After - Type assertion
(departments as GanttDepartment[]).map(d => ...) // ✅

// Or - Optional chaining
departments?.map?.(d => ...) // ✅

// Or - Type guard
if (Array.isArray(departments)) {
  departments.map(d => ...) // ✅
}
```

---

### 4. Enum/Union Issues (4개)

#### 🟡 Medium: ExamType 불완전 매핑
**파일**: `hooks/useExams.ts`

```typescript
// 오류: Missing properties from type 'Record<ExamType, Exam[]>'
Type '{ midterm: []; final: []; ... }' is missing the following properties: 
daily, monthly, school, competition
```

**원인**:
- `ExamType` enum이 확장됨 (daily, monthly, school, competition 추가)
- 기존 초기값이 일부만 포함

**영향도**: ⚠️ Medium
- 새로운 시험 유형 처리 불가
- 필터링 시 오류 발생 가능

**해결 방안**:
```typescript
// Before
const initialExams = {
  midterm: [],
  final: [],
  mock: [],
  weekly: [],
  diagnostic: [],
  other: []
}; // ❌ Incomplete

// After
const initialExams: Record<ExamType, Exam[]> = {
  midterm: [],
  final: [],
  mock: [],
  weekly: [],
  diagnostic: [],
  daily: [],      // ✅ Add
  monthly: [],    // ✅ Add
  school: [],     // ✅ Add
  competition: [], // ✅ Add
  other: []
};
```

---

#### 🟢 Low: PermissionLevel 타입 불일치
**파일**: `components/settings/tabs/DepartmentsManagementTab.tsx`

```typescript
// 오류: Type '"block"' is not assignable to type 'PermissionLevel'
Type '"view" | "edit" | "block"' is not assignable to type 'PermissionLevel'.
```

**원인**:
- `PermissionLevel`이 `"view" | "edit"` 만 허용
- UI에서 `"block"` 사용 시도

**영향도**: 🟢 Low
- 권한 차단 기능 사용 불가

**해결 방안**:
```typescript
// Update PermissionLevel type
export type PermissionLevel = 'view' | 'edit' | 'block';
```

---

### 5. Function Signature Issues (2개)

#### 🟡 Medium: Event handler 타입 불일치
**파일**: `components/ClassManagement/EditClassModal.tsx`

```typescript
// 오류: Function signature mismatch
Type '(saved?: boolean) => void' is not assignable to 
type 'MouseEventHandler<HTMLButtonElement>'.
```

**원인**:
- `onClose` 콜백이 `saved?: boolean` 파라미터 기대
- React의 `onClick`은 `MouseEvent` 전달

**영향도**: ⚠️ Medium
- 버튼 클릭 이벤트 처리 불가
- 타입 캐스팅으로 우회 중일 가능성

**해결 방안**:
```typescript
// Before
<button onClick={onClose}>Close</button> // ❌

// After - Wrapper function
<button onClick={() => onClose(false)}>Close</button> // ✅

// Or - Update onClose signature
interface Props {
  onClose: (event?: React.MouseEvent) => void; // ✅
}
```

---

### 6. Optional Property Access (미분류)

#### 🟢 Low: gradeLevel 속성 미정의
**파일**: `hooks/useExams.ts`

```typescript
// 오류: Property 'gradeLevel' does not exist on type 'Exam'
exam.gradeLevel // ❌
```

**원인**:
- `Exam` 인터페이스에 `gradeLevel` 속성 없음
- 코드에서 접근 시도

**영향도**: 🟢 Low
- 학년별 필터링 불가

**해결 방안**:
```typescript
// Add to Exam interface
export interface Exam {
  id: string;
  title: string;
  // ... existing fields
  gradeLevel?: string; // ✅ Add this
}
```

---

## 우선순위별 해결 방안

### 🔥 Priority 1: Critical (즉시 수정 필요)

1. **hooks/useClasses.ts - unknown 타입 처리**
   - 영향: useClasses 훅 전체
   - 예상 소요: 30분
   - 방법: Firestore converter 적용 또는 타입 캐스팅

2. **SubjectType 불일치**
   - 영향: ClassManagement 모듈
   - 예상 소요: 1시간
   - 방법: 타입 정의 통일 또는 타입 가드 추가

### ⚠️ Priority 2: High (1주일 내 수정)

3. **Missing Properties (GanttDepartment, Exam)**
   - 영향: Gantt 차트, 성적 관리
   - 예상 소요: 30분
   - 방법: 기본값 추가

4. **ExamType enum 완성**
   - 영향: 시험 유형 필터링
   - 예상 소요: 20분
   - 방법: 초기값 객체 업데이트

### 🟡 Priority 3: Medium (2주일 내 수정)

5. **React Query generic 타입**
   - 영향: IDE 지원 제한
   - 예상 소요: 1시간
   - 방법: 타입 assertion 또는 타입 가드

6. **Event handler 시그니처**
   - 영향: 모달 닫기 동작
   - 예상 소요: 30분
   - 방법: Wrapper 함수 또는 시그니처 변경

### 🟢 Priority 4: Low (향후 개선)

7. **StaffManager userProfile prop**
   - 영향: 없음 (내부에서 가져올 수 있음)
   - 방법: Prop 제거 또는 interface 업데이트

8. **PermissionLevel 타입 확장**
   - 영향: 권한 차단 기능
   - 방법: 타입 정의 업데이트

---

## 영향도 분석

### 런타임 영향

| 오류 타입 | 런타임 영향 | 설명 |
|----------|------------|------|
| unknown 타입 접근 | ⚠️ 없음 | JavaScript는 동적 타입, 런타임 오류 없음 |
| Missing properties | ⚠️ 낮음 | 속성 누락 시 undefined, 조건부 처리로 방어 |
| Generic issues | ✅ 없음 | 순수 타입 체크 문제 |
| Enum 불완전 | ⚠️ 중간 | 일부 케이스 처리 안됨 |

### 개발자 경험 영향

| 영역 | 영향도 | 설명 |
|-----|--------|------|
| IDE Autocomplete | 🔴 높음 | 타입 추론 실패로 자동완성 제한 |
| 리팩토링 안전성 | 🔴 높음 | 타입 불일치로 안전한 리팩토링 어려움 |
| 신규 개발자 온보딩 | 🟡 중간 | 타입 오류로 코드 이해 저하 |
| 버그 탐지 | 🔴 높음 | 타입 체크로 잡을 수 있는 버그 놓침 |

---

## 권장 조치사항

### 단기 조치 (1주일)

1. **Priority 1 이슈 해결**
   - [ ] `useClasses.ts` Firestore converter 적용
   - [ ] `SubjectType` 타입 불일치 해결
   - [ ] Missing properties 기본값 추가

2. **타입 체크 CI 통합**
   - [ ] GitHub Actions에 `tsc --noEmit` 추가
   - [ ] PR마다 타입 체크 필수화
   - [ ] 타입 오류 0개 목표 설정

### 중기 조치 (1개월)

3. **타입 정의 개선**
   - [ ] 모든 Firestore 컬렉션에 converter 적용
   - [ ] Shared types 문서화
   - [ ] 타입 가드 유틸리티 함수 작성

4. **코드 리뷰 프로세스**
   - [ ] 타입 체크 통과 필수
   - [ ] `any`, `unknown` 사용 시 주석 필수
   - [ ] 타입 캐스팅 최소화

### 장기 조치 (3개월)

5. **타입 안전성 강화**
   - [ ] `strict` 모드 단계적 적용
   - [ ] `noImplicitAny` 활성화
   - [ ] `strictNullChecks` 활성화

6. **자동화**
   - [ ] 타입 오류 트래킹 대시보드
   - [ ] 주간 타입 오류 리포트
   - [ ] 타입 커버리지 측정

---

## 예상 수정 소요 시간

| Priority | 오류 개수 | 예상 시간 | 담당자 제안 |
|----------|----------|----------|------------|
| P1 Critical | 10 | 2-3시간 | Senior Developer |
| P2 High | 11 | 2-3시간 | Mid-level Developer |
| P3 Medium | 8 | 1-2시간 | Any Developer |
| P4 Low | 2 | 30분 | Any Developer |
| **Total** | **31** | **6-9시간** | |

---

## 체크리스트

### 즉시 조치
- [ ] useClasses.ts unknown 타입 해결
- [ ] SubjectType 통일
- [ ] GanttDepartment color 추가
- [ ] Exam scope 속성 추가
- [ ] ExamType enum 완성

### 1주일 내
- [ ] React Query 타입 개선
- [ ] Event handler 시그니처 수정
- [ ] CI에 타입 체크 추가

### 1개월 내
- [ ] 전체 Firestore converter 적용
- [ ] 타입 가드 유틸리티 작성
- [ ] 타입 문서화

---

## 결론

현재 TypeScript 오류들은 **Firebase listener cleanup 작업과 무관한 기존 코드베이스의 이슈**입니다. 

### 핵심 요약
- 📊 총 31개 오류, 8개 파일 영향
- 🔥 Critical: 10개 (즉시 수정 필요)
- ⚠️ High: 11개 (1주일 내 수정)
- 🟡 Medium/Low: 10개 (향후 개선)
- ⏱️ 전체 수정 예상: **6-9시간**

### 권장사항
1. **단기**: Priority 1-2 이슈 집중 해결 (4-6시간)
2. **중기**: CI/CD에 타입 체크 통합
3. **장기**: Strict 모드 단계적 도입

---

**작성자**: Kombai AI Assistant  
**문서 버전**: 1.0  
**최종 수정**: 2026-01-13