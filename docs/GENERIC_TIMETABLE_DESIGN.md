# Generic 시간표 컴포넌트 설계 문서

## 📋 목차
1. [개요](#개요)
2. [현재 상태 분석](#현재-상태-분석)
3. [설계 철학](#설계-철학)
4. [아키텍처](#아키텍처)
5. [과목별 설정 시스템](#과목별-설정-시스템)
6. [구현 단계](#구현-단계)
7. [마이그레이션 전략](#마이그레이션-전략)

---

## 개요

### 목표
- 수학/영어 시간표의 중복 코드 제거
- 과학/국어 과목 추가를 위한 확장 가능한 구조 구축
- 통합 Generic 컴포넌트로 80% 이상 코드 재사용
- 새 과목 추가 시간을 1/3로 단축

### 핵심 전략
**Option B: 통합 Generic 컴포넌트** 방식 채택
- 과목별로 별도 컴포넌트를 만들지 않음
- SubjectConfiguration 객체로 과목별 메타데이터 주입
- 조건부 렌더링으로 과목별 특성 처리

---

## 현재 상태 분석

### 과목별 차이점

| 항목 | 수학 | 영어 | 과학 | 국어 |
|------|------|------|------|------|
| **교시 수** | 8 | 10 | 8 | 8 |
| **교시 길이** | 55분 | 40분 | 55분 | 55분 |
| **시간대** | 14:30~22:00 | 14:20~22:00 | 14:30~22:00 | 14:30~22:00 |
| **그룹화** | 2타임=1교시 | 없음 | 2타임=1교시 | 2타임=1교시 |
| **시뮬레이션** | 없음 | 있음 | 없음 | 없음 |

### 공통점 (일반화 가능)

✅ **ViewType 시스템** (teacher/room/class)
✅ **드래그-드롭** 학생 이동
✅ **병합 셀** 처리
✅ **권한 체계** (timetable.{subject}.view/edit)
✅ **Firebase 구조** (classes, enrollments 컬렉션)
✅ **학생 필터링** (입학일, 대기, 퇴원 등)

### 분리해야 할 로직

❌ **교시 정보** (PERIOD_INFO)
❌ **교시 그룹화** (MATH_PERIOD_GROUPS)
❌ **시간 포맷팅** (formatScheduleCompact)
❌ **PeriodId 변환** (레거시 ↔ 통일)

---

## 설계 철학

### 1. Dependency Injection 패턴
과목별 설정을 객체로 주입하여 컴포넌트를 과목 불가지론적으로 설계

```typescript
<GenericTimetable
  subject="science"
  config={SCIENCE_CONFIG}  // 의존성 주입
/>
```

### 2. 단일 책임 원칙
- 컴포넌트: UI 렌더링만 담당
- Config 객체: 과목별 메타데이터 제공
- Hooks: 데이터 조회 및 상태 관리

### 3. 점진적 마이그레이션
- 기존 Math/English 컴포넌트 유지
- Generic 컴포넌트 점진적 도입
- 하위 호환성 보장

---

## 아키텍처

### 디렉토리 구조

```
components/Timetable/
├── Generic/                          # 새로 생성
│   ├── components/
│   │   ├── TimetableGrid.tsx         # 과목 불가지론 그리드
│   │   ├── ClassCard.tsx             # 과목 불가지론 카드
│   │   ├── TimetableHeader.tsx       # 검색, 모드 토글
│   │   └── Modals/
│   │       ├── AddClassModal.tsx
│   │       ├── ClassDetailModal.tsx
│   │       └── ViewSettingsModal.tsx
│   ├── hooks/
│   │   ├── useTimetableClasses.ts    # subject 파라미터 추가
│   │   ├── useClassStudents.ts       # subject 파라미터 추가
│   │   ├── useClassConfig.ts         # subject 파라미터 추가
│   │   └── useClassOperations.ts     # subject 파라미터 추가
│   ├── utils/
│   │   ├── gridUtils.ts              # 셀 필터링, 스팬 계산
│   │   ├── periodUtils.ts            # period 변환 로직
│   │   └── subjectConfig.ts          # 과목별 설정 객체 ⭐
│   ├── types.ts                      # Generic 타입 정의
│   └── GenericTimetable.tsx          # 진입점
│
├── Math/                             # 기존 유지 (레거시)
├── English/                          # 기존 유지 (레거시)
├── TimetableManager.tsx              # 과목 탭 전환
└── constants.ts                      # 교시 정보
```

---

## 과목별 설정 시스템

### SubjectConfiguration 인터페이스

```typescript
// components/Timetable/Generic/utils/subjectConfig.ts

export interface SubjectConfiguration {
  // 기본 정보
  subject: 'math' | 'english' | 'science' | 'korean';
  displayName: string;  // '수학', '영어', '과학', '국어'

  // 교시 정보
  periodInfo: Record<string, PeriodInfo>;
  periodIds: string[];              // ["1", "2", ..., "8"] 또는 [..., "10"]
  unifiedPeriodsCount: number;      // 8 또는 10

  // 교시 그룹화 (선택적 - 수학/과학/국어만)
  periodGroups?: Record<string, { group: number; position: 'first' | 'second' }>;
  groupTimes?: Record<number, string>;
  hasGrouping: boolean;              // true면 2타임=1교시

  // 포맷팅 함수
  formatPeriodsToLabel: (periods: string[]) => string;

  // Firebase
  firebaseSubjectKey: 'math' | 'english' | 'science' | 'korean';
  configDocPath: string;             // 'settings/math_config'

  // 권한
  viewPermission: PermissionId;      // 'timetable.math.view'
  editPermission: PermissionId;      // 'timetable.math.edit'

  // 색상 (styleUtils에서 가져옴)
  colors: typeof SUBJECT_COLORS[SubjectType];
}
```

### 구체적인 Config 객체

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
import { SUBJECT_COLORS, SUBJECT_LABELS } from '../../../utils/styleUtils';

// 수학 설정
export const MATH_CONFIG: SubjectConfiguration = {
  subject: 'math',
  displayName: SUBJECT_LABELS.math,

  periodInfo: MATH_PERIOD_INFO,
  periodIds: MATH_UNIFIED_PERIODS,
  unifiedPeriodsCount: 8,

  periodGroups: MATH_PERIOD_GROUPS,
  groupTimes: MATH_GROUP_TIMES,
  hasGrouping: true,

  formatPeriodsToLabel: formatMathPeriodsToLabel,

  firebaseSubjectKey: 'math',
  configDocPath: 'settings/math_config',

  viewPermission: 'timetable.math.view',
  editPermission: 'timetable.math.edit',

  colors: SUBJECT_COLORS.math,
};

// 과학 설정 (수학과 거의 동일)
export const SCIENCE_CONFIG: SubjectConfiguration = {
  subject: 'science',
  displayName: SUBJECT_LABELS.science,

  periodInfo: SCIENCE_PERIOD_INFO,
  periodIds: SCIENCE_UNIFIED_PERIODS,
  unifiedPeriodsCount: 8,

  periodGroups: MATH_PERIOD_GROUPS,  // 수학과 동일
  groupTimes: MATH_GROUP_TIMES,       // 수학과 동일
  hasGrouping: true,

  formatPeriodsToLabel: formatMathPeriodsToLabel,  // 재사용

  firebaseSubjectKey: 'science',
  configDocPath: 'settings/science_config',

  viewPermission: 'timetable.science.view',
  editPermission: 'timetable.science.edit',

  colors: SUBJECT_COLORS.science,
};

// 국어 설정 (수학과 거의 동일)
export const KOREAN_CONFIG: SubjectConfiguration = {
  subject: 'korean',
  displayName: SUBJECT_LABELS.korean,

  periodInfo: KOREAN_PERIOD_INFO,
  periodIds: KOREAN_UNIFIED_PERIODS,
  unifiedPeriodsCount: 8,

  periodGroups: MATH_PERIOD_GROUPS,
  groupTimes: MATH_GROUP_TIMES,
  hasGrouping: true,

  formatPeriodsToLabel: formatMathPeriodsToLabel,

  firebaseSubjectKey: 'korean',
  configDocPath: 'settings/korean_config',

  viewPermission: 'timetable.korean.view',
  editPermission: 'timetable.korean.edit',

  colors: SUBJECT_COLORS.korean,
};

// 영어 설정
export const ENGLISH_CONFIG: SubjectConfiguration = {
  subject: 'english',
  displayName: SUBJECT_LABELS.english,

  periodInfo: ENGLISH_PERIOD_INFO,
  periodIds: ENGLISH_UNIFIED_PERIODS,
  unifiedPeriodsCount: 10,

  hasGrouping: false,  // 그룹화 없음

  formatPeriodsToLabel: formatEnglishPeriodsToLabel,

  firebaseSubjectKey: 'english',
  configDocPath: 'settings/english_config',

  viewPermission: 'timetable.english.view',
  editPermission: 'timetable.english.edit',

  colors: SUBJECT_COLORS.english,
};

// 헬퍼 함수
export const getSubjectConfig = (
  subject: 'math' | 'english' | 'science' | 'korean'
): SubjectConfiguration => {
  switch (subject) {
    case 'math': return MATH_CONFIG;
    case 'english': return ENGLISH_CONFIG;
    case 'science': return SCIENCE_CONFIG;
    case 'korean': return KOREAN_CONFIG;
    default: return MATH_CONFIG;
  }
};
```

### 포맷팅 함수 예시

```typescript
// 수학/과학/국어: 2타임 = 1교시
function formatMathPeriodsToLabel(periods: string[]): string {
  const completeGroups: number[] = [];
  for (let group = 1; group <= 4; group++) {
    const first = String(group * 2 - 1);
    const second = String(group * 2);
    if (periods.includes(first) && periods.includes(second)) {
      completeGroups.push(group);
    }
  }
  if (completeGroups.length === 0) {
    // 불완전한 교시 → 시간대로 표시
    return periods.map(p => MATH_PERIOD_INFO[p]?.time).filter(Boolean).join(', ');
  }
  return completeGroups.map(g => `${g}교시`).join(', ');
}

// 영어: 연속된 교시는 범위로
function formatEnglishPeriodsToLabel(periods: string[]): string {
  const nums = periods.map(Number).sort((a, b) => a - b);
  const isConsecutive = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
  if (isConsecutive && nums.length > 1) {
    return `${nums[0]}~${nums[nums.length - 1]}교시`;
  }
  return nums.map(n => `${n}교시`).join(', ');
}
```

---

## Generic 컴포넌트 인터페이스

### GenericTimetable (진입점)

```typescript
interface GenericTimetableProps {
  subject: 'math' | 'english' | 'science' | 'korean';
  config?: SubjectConfiguration;  // 선택적 (자동으로 getSubjectConfig 사용)
  currentUser: any;
  onStudentsUpdated?: () => void;
}

const GenericTimetable: React.FC<GenericTimetableProps> = ({
  subject,
  config: providedConfig,
  currentUser,
  onStudentsUpdated,
}) => {
  const config = providedConfig || getSubjectConfig(subject);
  const { classes, loading } = useTimetableClasses(subject);

  // 권한 확인
  const canView = hasPermission(config.viewPermission);
  const canEdit = hasPermission(config.editPermission);

  if (!canView) return <PermissionDenied />;

  return (
    <TimetableGrid
      config={config}
      classes={classes}
      viewType="teacher"
      canEdit={canEdit}
      // ... 기타 props
    />
  );
};
```

### GenericTimetableGrid

```typescript
interface GenericTimetableGridProps {
  config: SubjectConfiguration;      // 과목 설정
  classes: TimetableClass[];
  periods: string[];                 // config.periodIds에서 제공
  weekdays: string[];
  viewType: 'teacher' | 'room' | 'class';
  mode: 'view' | 'edit';
  canEdit: boolean;

  // UI 설정
  searchQuery: string;
  showStudents: boolean;
  showClassName: boolean;
  fontSize?: 'small' | 'normal' | 'large' | 'very-large';
  rowHeight?: 'compact' | 'short' | 'normal' | 'tall' | 'very-tall';

  // 핸들러
  onClassClick: (cls: TimetableClass) => void;
  onStudentClick?: (studentId: string) => void;

  // 드래그-드롭
  onDragStart: (e: React.DragEvent, studentId: string, fromClassId: string) => void;
  onDrop: (e: React.DragEvent, toClassId: string) => void;
  // ...
}
```

### 핵심 로직 - 과목별 분기

```typescript
const GenericTimetableGrid: React.FC<GenericTimetableGridProps> = ({
  config,
  periods,
  ...
}) => {
  // 교시 라벨 결정
  const getPeriodLabel = (periodId: string): string => {
    if (config.hasGrouping) {
      // 수학/과학/국어: 그룹 번호 (1+2 → 1교시)
      const groupInfo = config.periodGroups?.[periodId];
      return groupInfo ? `${groupInfo.group}교시` : `${periodId}교시`;
    } else {
      // 영어: 그대로 표시
      return `${periodId}교시`;
    }
  };

  // 교시 시간대 표시
  const getPeriodTime = (periodId: string): string => {
    return config.periodInfo[periodId]?.time || '';
  };

  return (
    <div className="timetable-grid">
      {/* 헤더 */}
      <div className="header">
        <div className="corner-cell">
          <span className={config.colors.badge}>{config.displayName}</span>
        </div>
        {periods.map(periodId => (
          <div key={periodId} className="period-header">
            <div>{getPeriodLabel(periodId)}</div>
            <div className="text-xs text-gray-500">{getPeriodTime(periodId)}</div>
          </div>
        ))}
      </div>

      {/* 그리드 본문 */}
      {weekdays.map(day => (
        <div key={day} className="row">
          <div className="day-cell">{day}</div>
          {periods.map(periodId => (
            <ClassCell
              key={`${day}-${periodId}`}
              config={config}
              day={day}
              periodId={periodId}
              classes={getClassesForCell(day, periodId)}
              // ...
            />
          ))}
        </div>
      ))}
    </div>
  );
};
```

---

## Generic Hooks

### useTimetableClasses

```typescript
export const useTimetableClasses = (
  subject: 'math' | 'english' | 'science' | 'korean'
) => {
  const config = getSubjectConfig(subject);

  const q = query(
    collection(db, COL_CLASSES),
    where('isActive', '==', true),
    where('subject', '==', config.firebaseSubjectKey)  // subject 필터
  );

  const [classes, setClasses] = useState<TimetableClass[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // PeriodId 변환 로직
        schedule: convertSchedule(doc.data().schedule, subject),
      }));
      setClasses(data);
    });
    return unsubscribe;
  }, [subject]);

  return { classes, loading };
};
```

### useClassStudents

```typescript
export const useClassStudents = (
  subject: 'math' | 'english' | 'science' | 'korean',
  classNames: string[],
  studentMap: Record<string, any>
) => {
  const config = getSubjectConfig(subject);

  const { data: classDataMap = {} } = useQuery<Record<string, ClassStudentData>>({
    queryKey: ['classStudents', subject, classNamesKey],
    queryFn: async () => {
      const enrollmentsQuery = query(
        collectionGroup(db, 'enrollments'),
        where('subject', '==', config.firebaseSubjectKey)  // subject 필터
      );

      const snapshot = await getDocs(enrollmentsQuery);
      // ... 데이터 처리
    },
    staleTime: 1000 * 60 * 5,  // 5분 캐싱
  });

  return { classDataMap, isLoading };
};
```

### useClassConfig

```typescript
export const useClassConfig = (
  subject: 'math' | 'english' | 'science' | 'korean'
) => {
  const config = getSubjectConfig(subject);
  const [configData, setConfigData] = useState({
    teacherOrder: [],
    weekdayOrder: [],
  });

  const loadConfig = async () => {
    const docRef = doc(db, config.configDocPath);  // 'settings/math_config'
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      setConfigData(docSnap.data());
    }
  };

  const saveConfig = async (newConfig: any) => {
    await setDoc(doc(db, config.configDocPath), newConfig);
  };

  return { configData, loadConfig, saveConfig };
};
```

---

## 구현 단계

### Phase 1: 기반 구축 (1-2주)

1. **SubjectConfiguration 시스템 구축**
   - [ ] `components/Timetable/Generic/utils/subjectConfig.ts` 생성
   - [ ] `SubjectConfiguration` 인터페이스 정의
   - [ ] MATH_CONFIG, ENGLISH_CONFIG, SCIENCE_CONFIG, KOREAN_CONFIG 작성
   - [ ] `getSubjectConfig()` 헬퍼 함수

2. **Generic 타입 정의**
   - [ ] `components/Timetable/Generic/types.ts` 생성
   - [ ] GenericTimetableProps, GenericTimetableGridProps 등

3. **Period Utils**
   - [ ] `components/Timetable/Generic/utils/periodUtils.ts` 생성
   - [ ] `convertLegacyPeriodId()`, `formatPeriods()` 등

### Phase 2: Generic Hooks (2-3주)

1. **useTimetableClasses**
   - [ ] subject 파라미터 추가
   - [ ] config 기반 Firebase 쿼리
   - [ ] PeriodId 변환 로직 통합

2. **useClassStudents**
   - [ ] subject 파라미터 추가
   - [ ] config 기반 enrollments 쿼리

3. **useClassConfig**
   - [ ] subject 파라미터 추가
   - [ ] config.configDocPath 사용

4. **useClassOperations**
   - [ ] subject 파라미터 추가
   - [ ] CRUD 작업 시 subject 검증

### Phase 3: Generic 컴포넌트 (3-4주)

1. **GenericTimetable (진입점)**
   - [ ] 기본 구조 생성
   - [ ] config 주입 로직
   - [ ] 권한 확인

2. **TimetableGrid**
   - [ ] Math TimetableGrid 복사 후 수정
   - [ ] config 기반 교시 라벨/시간 표시
   - [ ] 조건부 렌더링 (hasGrouping 등)

3. **ClassCard**
   - [ ] Math ClassCard 복사 후 수정
   - [ ] config 기반 색상 적용
   - [ ] 병합 셀 로직 유지

4. **Modals**
   - [ ] AddClassModal: subject select 옵션
   - [ ] ClassDetailModal: config 기반 UI
   - [ ] ViewSettingsModal: config 기반 설정

### Phase 4: 통합 및 테스트 (1-2주)

1. **TimetableManager 수정**
   - [ ] 과목 탭에 science, korean 추가
   - [ ] GenericTimetable 렌더링
   - [ ] 기존 Math/English 병행 지원

2. **ClassManagement 수정**
   - [ ] AddClassModal subject select 확대
   - [ ] ClassManagementTab 필터 확대

3. **테스트**
   - [ ] 수학 시간표 Generic 전환 테스트
   - [ ] 영어 시간표 Generic 전환 테스트
   - [ ] 과학/국어 시간표 생성 테스트

### Phase 5: 레거시 제거 (선택)

1. **Math/English 컴포넌트 제거**
   - [ ] Generic으로 완전 전환 확인
   - [ ] 기존 디렉토리 삭제 또는 보관

---

## 마이그레이션 전략

### 점진적 전환

```typescript
// TimetableManager.tsx

const TimetableManager: React.FC<TimetableManagerProps> = ({
  subjectTab,
  onSubjectChange,
}) => {
  const USE_GENERIC = true;  // 기능 플래그

  if (USE_GENERIC) {
    // 새로운 Generic 시스템
    return <GenericTimetable subject={subjectTab} currentUser={currentUser} />;
  } else {
    // 기존 시스템 (하위 호환)
    if (subjectTab === 'math') {
      return <MathTimetable />;
    } else if (subjectTab === 'english') {
      return <EnglishTimetable />;
    }
  }
};
```

### 데이터 호환성

**Firebase 구조 변경 없음**
- 기존 `classes` 컬렉션 그대로 사용
- `subject` 필드에 'science', 'korean' 추가만
- 기존 데이터 마이그레이션 불필요

**PeriodId 변환 자동화**
- 레거시 '1-1', '1-2' → 통일 '1', '2' 자동 변환
- config.periodInfo로 표시 시 자동 처리

---

## 확장성

### 새 과목 추가 시 필요한 작업

1. **교시 정보 추가** (constants.ts)
   ```typescript
   export const NEW_SUBJECT_PERIOD_INFO = { ... };
   export const NEW_SUBJECT_UNIFIED_PERIODS = ['1', '2', ...];
   ```

2. **Config 객체 생성** (subjectConfig.ts)
   ```typescript
   export const NEW_SUBJECT_CONFIG: SubjectConfiguration = {
     subject: 'new_subject',
     periodInfo: NEW_SUBJECT_PERIOD_INFO,
     // ...
   };
   ```

3. **권한 추가** (types.ts)
   ```typescript
   | 'timetable.new_subject.view' | 'timetable.new_subject.edit'
   ```

4. **TimetableManager 탭 추가**
   ```typescript
   <Tab onClick={() => setSubject('new_subject')}>새 과목</Tab>
   ```

**소요 시간**: 약 1-2일 (기존 3-5일 대비 1/3 단축)

---

## 코드 재사용 비율

| 컴포넌트 | 재사용 비율 | 비고 |
|---------|----------|------|
| TimetableGrid | 90% | config 기반 조건부 렌더링 |
| ClassCard | 85% | 병합 셀 로직 공통 |
| Modals | 80% | subject select만 확대 |
| Hooks | 95% | subject 파라미터만 추가 |
| Utils | 100% | 완전 공통 |

**전체 평균**: **87% 코드 재사용**

---

## 참고 자료

- [수학 시간표 분석 보고서](./MATH_TIMETABLE_ANALYSIS.md) (에이전트 결과)
- [constants.ts](../components/Timetable/constants.ts)
- [styleUtils.ts](../utils/styleUtils.ts)
- [types.ts](../types.ts)
