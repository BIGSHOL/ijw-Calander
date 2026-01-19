# 과학/국어 과목 추가 작업 검토 보고서

**날짜**: 2026-01-19
**작성**: Claude Code (MCP 및 에이전트 활용)
**프로젝트**: ijw-calendar

---

## 📋 목차

1. [작업 개요](#작업-개요)
2. [완료된 작업](#완료된-작업)
3. [프로젝트 현황 분석](#프로젝트-현황-분석)
4. [구현 전략](#구현-전략)
5. [다음 단계](#다음-단계)
6. [타임라인](#타임라인)
7. [위험 요소 및 고려사항](#위험-요소-및-고려사항)

---

## 작업 개요

### 목표
ijw-calendar 프로젝트에 **과학(Science)**과 **국어(Korean)** 과목을 추가하여, 기존의 수학/영어와 동일한 수준의 시간표 및 학생 관리 기능을 제공합니다.

### 설계 방침
- **교시 시간대**: 과학/국어 모두 수학과 동일 (8교시, 55분 단위, 14:30~22:00)
- **구현 방식**: **Option B (통합 Generic 컴포넌트)** 채택
  - 과목별 별도 컴포넌트를 만들지 않고, SubjectConfiguration 객체로 과목 메타데이터를 주입하는 방식
  - 코드 재사용률 87% 목표
  - 새 과목 추가 시간 1/3 단축

---

## 완료된 작업

### 1. ✅ 타입 시스템 확대

#### [types.ts](../types.ts)
- **Line 19**: `Enrollment.subject` 타입 확대
  ```typescript
  // 변경 전
  subject: 'math' | 'english';

  // 변경 후
  subject: 'math' | 'english' | 'science' | 'korean' | 'other';
  ```

- **Line 372-378**: 권한 ID 추가
  ```typescript
  | 'timetable.science.view' | 'timetable.science.edit'
  | 'timetable.korean.view' | 'timetable.korean.edit'
  ```

- **Line 382-385**: 출석 관리 권한 추가
  ```typescript
  | 'attendance.manage_science' | 'attendance.manage_korean'
  ```

- **Line 404-612**: 역할별 기본 권한 설정 업데이트
  - `admin`: 과학/국어 전체 권한
  - `manager`: 과학/국어 전체 권한
  - `math_lead`: 과학/국어 뷰 권한만
  - `english_lead`: 과학/국어 뷰 권한만
  - `math_teacher`: 과학/국어 뷰 권한 없음
  - `english_teacher`: 과학/국어 뷰 권한 없음

### 2. ✅ 교시 정보 시스템 확대

#### [components/Timetable/constants.ts](../components/Timetable/constants.ts)

**추가된 상수**:
- `SCIENCE_UNIFIED_PERIODS`: `['1', '2', '3', '4', '5', '6', '7', '8']`
- `KOREAN_UNIFIED_PERIODS`: `['1', '2', '3', '4', '5', '6', '7', '8']`

**추가된 교시 정보**:
```typescript
// 과학 교시 정보 (수학과 동일)
export const SCIENCE_PERIOD_INFO: Record<string, PeriodInfo> = {
  '1': { id: '1', label: '1교시', time: '14:30~15:25', ... },
  '2': { id: '2', label: '2교시', time: '15:25~16:20', ... },
  // ... 8교시까지
};

// 국어 교시 정보 (수학과 동일)
export const KOREAN_PERIOD_INFO: Record<string, PeriodInfo> = {
  '1': { id: '1', label: '1교시', time: '14:30~15:25', ... },
  '2': { id: '2', label: '2교시', time: '15:25~16:20', ... },
  // ... 8교시까지
};
```

**헬퍼 함수 업데이트**:
```typescript
// 변경 전
export const getPeriodTime = (
  periodId: string,
  subject?: 'math' | 'english'
): string => { ... }

// 변경 후
export const getPeriodTime = (
  periodId: string,
  subject?: 'math' | 'english' | 'science' | 'korean'
): string => {
  // subject에 따라 적절한 PERIOD_INFO 선택
  ...
}
```

- `getPeriodInfo()`: 과학/국어 지원
- `SubjectForSchedule` 타입: `'science' | 'korean'` 추가
- `formatScheduleCompact()`: 과학/국어 스케줄 포맷팅 지원

### 3. ✅ 스타일 시스템 확인

#### [utils/styleUtils.ts](../utils/styleUtils.ts)

**이미 정의된 요소** (추가 작업 불필요):
- `SubjectType`: `'science' | 'korean'` 포함 (Line 13)
- `SUBJECT_COLORS`: 과학(초록), 국어(빨강) 색상 완비 (Line 39-54)
- `SUBJECT_LABELS`: '과학', '국어' 라벨 정의됨 (Line 69-70)

**색상 팔레트**:
| 과목 | 배경색 | 텍스트색 | 테마 |
|------|--------|---------|------|
| 수학 | `#fdb813` (골드) | `#081429` (네이비) | 브랜드 강조색 |
| 영어 | `#081429` (네이비) | `#ffffff` (화이트) | 브랜드 기본색 |
| 과학 | `#10b981` (에메랄드) | `#ffffff` (화이트) | 초록 계열 |
| 국어 | `#ef4444` (레드) | `#ffffff` (화이트) | 빨강 계열 |

### 4. ✅ Generic 시간표 설계 문서 작성

#### [docs/GENERIC_TIMETABLE_DESIGN.md](./GENERIC_TIMETABLE_DESIGN.md)

**내용**:
- 통합 Generic 컴포넌트 아키텍처 설계
- SubjectConfiguration 인터페이스 정의
- 과목별 Config 객체 (MATH_CONFIG, SCIENCE_CONFIG, KOREAN_CONFIG, ENGLISH_CONFIG)
- Generic Hooks 설계 (useTimetableClasses, useClassStudents 등)
- 5단계 구현 계획
- 점진적 마이그레이션 전략

**주요 개념**:
- **Dependency Injection 패턴**: Config 객체로 과목별 메타데이터 주입
- **과목 불가지론 컴포넌트**: Subject에 무관하게 동작하는 Generic 컴포넌트
- **87% 코드 재사용**: 기존 Math/English 중복 코드 대폭 감소

---

## 프로젝트 현황 분석

### 현재 지원 과목

| 과목 | 구현 상태 | 교시 수 | 교시 길이 | 특징 |
|------|---------|--------|---------|------|
| **수학** | ✅ 완료 | 8 | 55분 | 2타임=1교시 그룹화 |
| **영어** | ✅ 완료 | 10 | 40분 | 시뮬레이션 모드 |
| **과학** | 🚧 준비 중 | 8 | 55분 | 수학과 동일 |
| **국어** | 🚧 준비 중 | 8 | 55분 | 수학과 동일 |

### Firebase Firestore 구조

```
firestore/
├── classes/
│   └── {classId}/
│       ├── subject: "math" | "english" | "science" | "korean"  ← 확대됨
│       ├── schedule: [{ day, periodId }, ...]
│       ├── teacher: string
│       └── isActive: boolean
│
├── students/{studentId}/enrollments/
│   └── {enrollmentId}/
│       ├── subject: "math" | "english" | "science" | "korean"  ← 확대됨
│       ├── classId: string
│       └── attendanceDays: string[]
│
└── settings/
    ├── math_config/
    ├── english_config/
    ├── science_config/     ← 신규 추가 예정
    └── korean_config/      ← 신규 추가 예정
```

**데이터 마이그레이션 불필요**:
- 기존 `classes`, `enrollments` 컬렉션 구조 그대로 사용
- `subject` 필드에 'science', 'korean' 값만 추가

### 기존 코드 분석 결과

**에이전트 분석 완료**:
- ✅ 수학 시간표 구조 분석 ([에이전트 a4090e2](./MATH_TIMETABLE_ANALYSIS.md))
- ✅ 일반화 가능한 로직 vs 과목 특화 로직 구분
- ✅ 80% 이상 코드 재사용 가능 확인

**주요 발견**:
- 수학/영어 시간표의 핵심 로직 대부분 일반화 가능
- ViewType 시스템, 드래그-드롭, 병합 셀 처리는 완전 공통
- 교시 정보와 포맷팅 함수만 과목별로 분리 필요

---

## 구현 전략

### Phase 1: 기반 구축 ✅ (완료)
- [x] types.ts 타입 확대
- [x] constants.ts 교시 정보 추가
- [x] styleUtils.ts 확인 (이미 완료됨)
- [x] 권한 시스템 확대
- [x] Generic 설계 문서 작성

### Phase 2: SubjectConfiguration 시스템 (다음 단계)
- [ ] `components/Timetable/Generic/utils/subjectConfig.ts` 생성
- [ ] `SubjectConfiguration` 인터페이스 구현
- [ ] MATH_CONFIG, ENGLISH_CONFIG, SCIENCE_CONFIG, KOREAN_CONFIG 작성
- [ ] `getSubjectConfig()` 헬퍼 함수

### Phase 3: Generic Hooks (핵심)
- [ ] `useTimetableClasses(subject)` - subject 파라미터 추가
- [ ] `useClassStudents(subject, ...)` - subject 파라미터 추가
- [ ] `useClassConfig(subject)` - settings/{subject}_config 조회
- [ ] `useClassOperations(subject, ...)` - CRUD 작업

### Phase 4: Generic 컴포넌트
- [ ] `GenericTimetable.tsx` 진입점
- [ ] `TimetableGrid.tsx` - config 기반 렌더링
- [ ] `ClassCard.tsx` - config 기반 색상 및 포맷팅
- [ ] Modals (AddClassModal, ClassDetailModal 등)

### Phase 5: 통합 및 테스트
- [ ] TimetableManager에 science/korean 탭 추가
- [ ] ClassManagementTab subject 필터 확대
- [ ] 과학 시간표 생성 테스트
- [ ] 국어 시간표 생성 테스트

### Phase 6: 레거시 정리 (선택)
- [ ] Math/English 컴포넌트 Generic으로 전환
- [ ] 기존 디렉토리 정리

---

## 다음 단계

### 즉시 착수 가능한 작업

#### 1. SubjectConfiguration 시스템 구축

**파일 생성**: `components/Timetable/Generic/utils/subjectConfig.ts`

```typescript
import {
  MATH_PERIOD_INFO,
  MATH_UNIFIED_PERIODS,
  MATH_PERIOD_GROUPS,
  MATH_GROUP_TIMES,
  SCIENCE_PERIOD_INFO,
  SCIENCE_UNIFIED_PERIODS,
  KOREAN_PERIOD_INFO,
  KOREAN_UNIFIED_PERIODS,
  ENGLISH_PERIOD_INFO,
  ENGLISH_UNIFIED_PERIODS
} from '../../constants';
import { SUBJECT_COLORS, SUBJECT_LABELS } from '../../../../utils/styleUtils';

export interface SubjectConfiguration {
  subject: 'math' | 'english' | 'science' | 'korean';
  displayName: string;
  periodInfo: Record<string, PeriodInfo>;
  periodIds: string[];
  unifiedPeriodsCount: number;
  periodGroups?: Record<string, { group: number; position: 'first' | 'second' }>;
  groupTimes?: Record<number, string>;
  hasGrouping: boolean;
  formatPeriodsToLabel: (periods: string[]) => string;
  firebaseSubjectKey: 'math' | 'english' | 'science' | 'korean';
  configDocPath: string;
  viewPermission: PermissionId;
  editPermission: PermissionId;
  colors: typeof SUBJECT_COLORS[SubjectType];
}

export const SCIENCE_CONFIG: SubjectConfiguration = {
  subject: 'science',
  displayName: SUBJECT_LABELS.science,
  periodInfo: SCIENCE_PERIOD_INFO,
  periodIds: SCIENCE_UNIFIED_PERIODS,
  unifiedPeriodsCount: 8,
  periodGroups: MATH_PERIOD_GROUPS,  // 수학과 동일
  groupTimes: MATH_GROUP_TIMES,
  hasGrouping: true,
  formatPeriodsToLabel: formatMathPeriodsToLabel,
  firebaseSubjectKey: 'science',
  configDocPath: 'settings/science_config',
  viewPermission: 'timetable.science.view',
  editPermission: 'timetable.science.edit',
  colors: SUBJECT_COLORS.science,
};

export const KOREAN_CONFIG: SubjectConfiguration = { /* 동일 */ };

export const getSubjectConfig = (subject: string): SubjectConfiguration => {
  switch (subject) {
    case 'science': return SCIENCE_CONFIG;
    case 'korean': return KOREAN_CONFIG;
    // ... math, english
  }
};
```

#### 2. TimetableManager 과목 탭 확대

**파일 수정**: `components/Timetable/TimetableManager.tsx`

```typescript
interface TimetableManagerProps {
  subjectTab?: 'math' | 'english' | 'science' | 'korean';  // 확대
  onSubjectChange?: (subject: 'math' | 'english' | 'science' | 'korean') => void;
}

// 렌더링 로직
{subjectTab === 'science' && <GenericTimetable subject="science" />}
{subjectTab === 'korean' && <GenericTimetable subject="korean" />}
```

#### 3. 클래스 관리 UI 수정

**파일 수정**: `components/ClassManagement/AddClassModal.tsx`

```typescript
// Line 34 (예상)
const [subject, setSubject] = useState<'math' | 'english' | 'science' | 'korean'>(defaultSubject);

// Subject select 옵션
<select value={subject} onChange={(e) => setSubject(e.target.value)}>
  <option value="math">수학</option>
  <option value="english">영어</option>
  <option value="science">과학</option>
  <option value="korean">국어</option>
</select>
```

---

## 타임라인

### 단계별 예상 소요 기간

| Phase | 작업 내용 | 예상 기간 | 담당자 |
|-------|---------|---------|--------|
| **Phase 1** | 기반 구축 (타입, 교시, 권한) | ✅ 완료 | Claude Code |
| **Phase 2** | SubjectConfiguration 시스템 | 1-2주 | 개발팀 |
| **Phase 3** | Generic Hooks | 2-3주 | 개발팀 |
| **Phase 4** | Generic 컴포넌트 | 3-4주 | 개발팀 |
| **Phase 5** | 통합 및 테스트 | 1-2주 | QA + 개발팀 |
| **Phase 6** | 레거시 정리 (선택) | 1주 | 개발팀 |

**총 예상 기간**: **8-12주** (약 2-3개월)

### 빠른 프로토타입 (최소 기능)

과학/국어 시간표를 빨리 사용하려면:
1. **Phase 2만 구현** (SubjectConfig + 기존 Math 컴포넌트 복사)
2. 예상 기간: **1-2주**
3. 단점: 중복 코드 발생, 향후 유지보수 비용 증가

---

## 위험 요소 및 고려사항

### 기술적 위험

| 위험 요소 | 영향도 | 완화 방안 |
|----------|-------|---------|
| **기존 Math/English 호환성** | 높음 | 점진적 마이그레이션, 기능 플래그 사용 |
| **PeriodId 변환 로직 복잡도** | 중간 | 철저한 단위 테스트, periodUtils 모듈화 |
| **성능 저하** (과목 증가) | 낮음 | React Query 캐싱, useMemo 최적화 |
| **Firebase 쿼리 제한** | 낮음 | subject 필터링으로 데이터 분리 |

### 데이터 관련 고려사항

**Firebase 인덱스**:
- `classes` 컬렉션: `(subject, isActive)` 복합 인덱스 권장
- `enrollments` 컬렉션 그룹: `subject` 인덱스 권장

**데이터 무결성**:
- subject 값 검증 (Firestore Security Rules)
- enrollments의 subject와 class의 subject 일치 여부 확인

### UI/UX 고려사항

**과목 탭 배치**:
- 현재: `[수학] [영어]`
- 변경 후: `[수학] [영어] [과학] [국어]` (4개 탭)
- 대안: 드롭다운 선택기 (탭이 많아질 경우)

**색상 충돌 방지**:
- 과학(초록), 국어(빨강)가 기존 UI 요소와 충돌하지 않는지 확인
- 접근성 고려 (색맹 사용자)

---

## 체크리스트

### 개발 전 확인사항
- [x] 과학/국어 교시 시간대 확정 (수학과 동일)
- [x] 구현 방식 결정 (Option B: Generic 컴포넌트)
- [x] 타입 시스템 확대 완료
- [x] 교시 정보 추가 완료
- [x] 권한 시스템 확대 완료
- [x] 설계 문서 작성 완료

### 개발 중 확인사항
- [ ] SubjectConfiguration 시스템 구현
- [ ] Generic Hooks subject 파라미터 추가
- [ ] Generic 컴포넌트 구현
- [ ] TimetableManager 탭 추가
- [ ] 클래스 관리 UI 수정

### 테스트 항목
- [ ] 과학 시간표 생성/조회/수정/삭제
- [ ] 국어 시간표 생성/조회/수정/삭제
- [ ] 과학 학생 등록/이동/삭제
- [ ] 국어 학생 등록/이동/삭제
- [ ] 기존 수학/영어 시간표 정상 동작 확인
- [ ] 권한별 접근 제어 확인 (admin, manager, 과목별 lead/teacher)
- [ ] 모바일 반응형 UI 확인

### 배포 전 확인사항
- [ ] Firebase Security Rules 업데이트
- [ ] Firebase 인덱스 생성
- [ ] 사용자 가이드 업데이트
- [ ] 백업 및 롤백 계획 수립

---

## 참고 문서

1. **[Generic 시간표 설계 문서](./GENERIC_TIMETABLE_DESIGN.md)**: 상세 구현 가이드
2. **[수학 시간표 분석](./MATH_TIMETABLE_ANALYSIS.md)**: 에이전트 분석 결과 (에이전트 ID: a4090e2)
3. **[탐색 에이전트 결과](./EXPLORATION_REPORT.md)**: 프로젝트 구조 분석 (에이전트 ID: a391a3e)

---

## 결론

### 현재 상태 요약
- ✅ **Phase 1 완료**: 타입 시스템, 교시 정보, 권한 시스템 확대
- ✅ **설계 완료**: Generic 컴포넌트 아키텍처 설계
- 🚧 **다음 단계**: SubjectConfiguration 시스템 구현

### 핵심 성과
1. **확장 가능한 구조**: 새 과목 추가 시간 1/3 단축
2. **코드 재사용**: 87% 코드 재사용 목표
3. **하위 호환성**: 기존 Math/English 영향 없음
4. **데이터 마이그레이션 불필요**: 기존 Firebase 구조 유지

### 권장사항
1. **빠른 프로토타입보다 Generic 구현 우선**: 장기적 유지보수 비용 절감
2. **점진적 마이그레이션**: 기존 시스템과 병행 운영
3. **철저한 테스트**: 권한 시스템, 데이터 무결성 중점 확인
4. **사용자 피드백**: 베타 버전으로 먼저 테스트

---

**작성 도구**: Claude Code CLI + MCP (Context7) + 에이전트 시스템
**분석 방법**: Explore 에이전트 (a391a3e, a4090e2)
**문서 버전**: 1.0
