# IJW-Calendar 대형 파일 리팩토링 계획서

---

**작성일**: 2026-01-05
**프로젝트**: ijw-calander (학원 관리 시스템)
**분석자**: Refactor Expert Agent
**문서 목적**: 대형 파일(1,000행 이상) 모듈화 및 유지보수성 개선

---

## ⚠️ 핵심 원칙

**절대 지켜야 할 리팩토링 원칙**:
```
✅ 모든 리팩토링은 다음을 보장해야 합니다:

1. 기능 보존: 외부 동작은 절대 변경하지 않음
2. 성능 유지: 사용자 체감 속도 저하 없음 (오히려 개선)
3. 타입 안정성: TypeScript 타입 체계 유지
4. 점진적 진행: 한 번에 하나의 파일만 처리

❌ 절대 하지 말아야 할 것:
- 기능 변경과 리팩토링 동시 진행
- 테스트 없이 대규모 변경
- 타입 안정성을 희생한 빠른 수정

💡 올바른 리팩토링:
- Extract Function/Component/Hook 패턴 활용
- 각 단계마다 기능 검증
- 작은 커밋으로 추적 가능하게 관리
```

---

## 📊 전체 분석 요약

### 🚨 대형 파일 현황

| 순위 | 파일명 | 행수 | 복잡도 | 우선순위 | 예상 기간 |
|------|--------|------|--------|----------|----------|
| 1 | **App.tsx** | **2,021행** | Very High | **1 (최우선)** | 3주 |
| 2 | **EnglishClassTab.tsx** | **1,567행** | High | **2** | 2주 |
| 3 | **TimetableManager.tsx** | **1,522행** | Very High | **3** | 2주 |
| 4 | **SettingsModal.tsx** | **1,385행** | Very High | **4** | 2주 |
| 5 | EnglishTeacherTab.tsx | 1,075행 | High | 5 | 2주 |
| 6 | EventModal.tsx | 1,039행 | Medium-High | 6 | 2주 |
| **총계** | **6개 파일** | **8,609행** | - | - | **13주** |

**문제의 심각성**:
- App.tsx는 권장 크기(300-500행)의 **4배** 초과
- 상위 6개 파일이 전체 코드베이스의 **33%** 차지
- IDE 성능 저하 및 협업 충돌 위험 증가

---

## 🎯 리팩토링 목표

### 단기 목표 (3개월)
1. **가독성 향상**: 평균 파일 크기 200-300행으로 축소
2. **유지보수성 개선**: 기능별 독립적 수정 가능
3. **성능 최적화**: 불필요한 재렌더링 제거

### 장기 목표 (6개월)
1. **테스트 커버리지**: 70% 이상 달성
2. **코드 재사용성**: Hooks/Utils 50% 재사용
3. **협업 효율성**: Git 머지 충돌 50% 감소

### 핵심 성과 지표 (KPI)
| 지표 | 현재 | 목표 | 측정 방법 |
|------|------|------|----------|
| 평균 파일 크기 | 1,435행 | 250행 | Lines of Code |
| Cyclomatic Complexity | 20+ | <10 | ESLint |
| 번들 크기 | 측정 필요 | -20% | webpack-bundle-analyzer |
| 리뷰 시간 | 2시간 | 30분 | 코드 리뷰 시간 측정 |

---

## 📁 파일별 상세 분석 및 전략

### 1. EnglishClassTab.tsx (1,567행) - 우선순위: 2

#### 📌 현재 구조 분석

**주요 기능**:
- 영어 수업별 통합 시간표 뷰 (수업별 컬럼 표시)
- 학생 통계 자동 집계 (재원생/신입생/퇴원생)
- 드래그 앤 드롭으로 학생 이동
- 합반 수업 관리
- 레벨업 시스템

**복잡도 원인**:
```typescript
// 문제 1: 5개의 거대한 useEffect (225-353행)
useEffect(() => {
  // 90행의 복잡한 로직
}, [dependencies]);

// 문제 2: 290행짜리 useMemo (374-664행)
const processedClasses = useMemo(() => {
  // 복잡한 데이터 변환 로직
}, [classes, ...]);

// 문제 3: 인라인 서브 컴포넌트 2개
const ClassCard = ({ ... }) => { /* 280행 */ };
const MiniGridRow = ({ ... }) => { /* 50행 */ };
```

#### 🔧 리팩토링 전략

##### Step 1: Custom Hooks 추출 (Week 1)

**목표**: 복잡한 로직을 재사용 가능한 Hooks로 분리

```
📦 hooks/english/
  ├─ useEnglishSettings.ts        // 설정 관리 (239-268행)
  │   └─ 역할: 시간표 설정 로드 및 관리
  │
  ├─ useEnglishLevels.ts           // 레벨 설정 (258-267행)
  │   └─ 역할: 레벨별 색상 및 표시명 관리
  │
  ├─ useStudentStats.ts            // 학생 통계 (270-353행) ⭐ 최우선
  │   └─ 역할: 재원/신입/퇴원 학생 통계 자동 계산
  │
  └─ useClassTransform.ts          // 데이터 변환 (374-664행)
      └─ 역할: 원본 classes → 표시용 데이터 변환
```

**구현 예시 - useStudentStats.ts**:
```typescript
/**
 * 영어 반별 학생 통계를 자동으로 집계하는 Hook
 *
 * @param classes - 영어 수업 목록
 * @param isSimulationMode - 시뮬레이션 모드 여부
 * @returns 집계된 학생 통계 (재원/신입1/신입2/퇴원)
 */
export function useStudentStats(
  classes: EnglishClass[],
  isSimulationMode: boolean
) {
  const [stats, setStats] = useState({
    active: 0,
    new1: 0,
    new2: 0,
    withdrawn: 0
  });

  useEffect(() => {
    // 기존 270-353행 로직 이동
    const targetCollection = isSimulationMode
      ? EN_DRAFT_COLLECTION
      : EN_COLLECTION;

    // ... 통계 계산 로직 ...

    return () => unsubscribe();
  }, [classes, isSimulationMode]);

  return stats;
}
```

**효과**:
- EnglishClassTab.tsx: 1,567행 → 1,200행 (-367행)
- 재사용성: 다른 영어 탭에서도 사용 가능
- 테스트: 통계 로직 단위 테스트 작성 가능

---

##### Step 2: Utils 함수 분리 (Week 1)

**목표**: 순수 함수를 utils 폴더로 이동

```
📦 utils/english/
  ├─ roomFormatter.ts              // formatRoomByDay (391-417행)
  │   └─ 역할: 요일별 강의실 정보 포맷팅
  │
  ├─ teacherResolver.ts            // 담임 결정 로직 (532-554행)
  │   └─ 역할: 복수 담임 중 우선순위 결정
  │
  ├─ scheduleLogic.ts              // Weekend shift 계산 (557-650행)
  │   └─ 역할: 주말반 스케줄 계산 로직
  │
  └─ classGrouping.ts              // 그룹화 로직 (667-736행)
      └─ 역할: 수업을 그룹으로 묶는 알고리즘
```

**구현 예시 - roomFormatter.ts**:
```typescript
/**
 * 요일별 강의실 정보를 사용자 친화적 형식으로 포맷
 *
 * @example
 * formatRoomByDay({ mon: 'A101', tue: 'A101', wed: 'B201' })
 * // → "A101(월화), B201(수)"
 */
export function formatRoomByDay(rooms: Record<Weekday, string>): string {
  const grouped = new Map<string, Weekday[]>();

  Object.entries(rooms).forEach(([day, room]) => {
    if (!grouped.has(room)) {
      grouped.set(room, []);
    }
    grouped.get(room)!.push(day as Weekday);
  });

  return Array.from(grouped.entries())
    .map(([room, days]) => `${room}(${days.join('')})`)
    .join(', ');
}
```

**효과**:
- EnglishClassTab.tsx: 1,200행 → 950행 (-250행)
- 테스트: 순수 함수라 단위 테스트 매우 쉬움
- 재사용: 다른 시간표 컴포넌트에서도 활용

---

##### Step 3: Component 분해 (Week 2)

**목표**: 280행짜리 인라인 컴포넌트를 별도 파일로 분리

```
📦 components/Timetable/English/ClassCard/
  ├─ ClassCard.tsx                 // 메인 컴포넌트 (60행)
  │   └─ 역할: 전체 레이아웃 조율
  │
  ├─ ClassCardHeader.tsx           // 헤더 (1177-1255행 → 80행)
  │   └─ 역할: 수업명, 레벨, 수강 인원 표시
  │
  ├─ ClassCardInfo.tsx             // 정보 (1257-1281행 → 25행)
  │   └─ 역할: 담임, 강의실 정보 표시
  │
  ├─ MiniGrid.tsx                  // 미니 그리드 (1283-1308행 → 30행)
  │   └─ 역할: 요일별 간략 스케줄 표시
  │
  ├─ StudentList.tsx               // 학생 목록 (1310-1456행 → 150행)
  │   └─ 역할: 학생 카드 표시 및 드래그앤드롭
  │
  └─ index.ts                      // 재export
```

**구현 예시 - ClassCardHeader.tsx**:
```typescript
interface ClassCardHeaderProps {
  className: string;
  level: string;
  studentCount: number;
  maxCapacity: number;
  color: string;
  onClick: () => void;
}

/**
 * 영어 반 카드의 헤더 영역
 * 반 이름, 레벨, 수강 인원을 표시
 */
export const ClassCardHeader: React.FC<ClassCardHeaderProps> = ({
  className,
  level,
  studentCount,
  maxCapacity,
  color,
  onClick
}) => {
  const isOverCapacity = studentCount > maxCapacity;

  return (
    <div
      className="class-card-header"
      style={{ backgroundColor: color }}
      onClick={onClick}
    >
      <h3>{className}</h3>
      <span className="level-badge">{level}</span>
      <span className={isOverCapacity ? 'over-capacity' : ''}>
        {studentCount}/{maxCapacity}
      </span>
    </div>
  );
};
```

**효과**:
- EnglishClassTab.tsx: 950행 → 300행 (-650행) ✨
- 성능: React.memo로 불필요한 재렌더링 방지
- 테스트: 각 컴포넌트 독립적 테스트

---

##### Step 4: 상태 관리 최적화 (Week 2)

**문제**: 18개의 흩어진 useState
```typescript
// ❌ Before: 관리하기 어려운 상태
const [searchTerm, setSearchTerm] = useState('');
const [mode, setMode] = useState<'view' | 'edit'>('view');
const [selectedClass, setSelectedClass] = useState<string | null>(null);
const [showMoveConfirm, setShowMoveConfirm] = useState(false);
// ... 14개 더
```

**해결책**: 관련 상태를 Hook으로 그룹화
```typescript
// ✅ After: 명확한 책임 분리
const viewState = useEnglishClassView({
  initialMode: 'view',
  onModeChange: handleModeChange
});

const movementState = useClassMovement({
  isSimulationMode,
  onSaveSuccess: () => toast.success('저장 완료')
});

const {
  searchTerm,
  filteredClasses,
  setSearchTerm
} = useClassSearch(classes);
```

**구현 예시 - useEnglishClassView.ts**:
```typescript
export function useEnglishClassView(options: {
  initialMode?: 'view' | 'edit';
  onModeChange?: (mode: 'view' | 'edit') => void;
}) {
  const [mode, setMode] = useState(options.initialMode ?? 'view');
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((classId: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  }, []);

  const switchMode = useCallback((newMode: 'view' | 'edit') => {
    setMode(newMode);
    options.onModeChange?.(newMode);
  }, [options]);

  return {
    mode,
    selectedClass,
    expandedClasses,
    setSelectedClass,
    toggleExpand,
    switchMode
  };
}
```

#### 📊 최종 효과 (EnglishClassTab.tsx)

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| **총 행수** | 1,567행 | ~300행 | **-81%** |
| **메인 로직** | 1,567행 | 300행 | 간결 |
| **Hooks** | 0개 | 8개 | 재사용성 ↑ |
| **Utils** | 0개 | 4개 | 테스트 용이 |
| **Components** | 2개 인라인 | 5개 독립 | 독립성 ↑ |

**새로운 폴더 구조**:
```
src/
├─ components/Timetable/English/
│   ├─ EnglishClassTab.tsx          (300행) ⭐ 메인
│   └─ ClassCard/
│       ├─ ClassCard.tsx            (60행)
│       ├─ ClassCardHeader.tsx      (80행)
│       ├─ ClassCardInfo.tsx        (25행)
│       ├─ MiniGrid.tsx             (30행)
│       └─ StudentList.tsx          (150행)
│
├─ hooks/english/
│   ├─ useEnglishSettings.ts        (50행)
│   ├─ useEnglishLevels.ts          (30행)
│   ├─ useStudentStats.ts           (90행)
│   ├─ useClassTransform.ts         (120행)
│   ├─ useEnglishClassView.ts       (60행)
│   └─ useClassMovement.ts          (80행)
│
└─ utils/english/
    ├─ roomFormatter.ts             (40행)
    ├─ teacherResolver.ts           (50행)
    ├─ scheduleLogic.ts             (90행)
    └─ classGrouping.ts             (70행)
```

---

### 2. TimetableManager.tsx (1,522행) - 우선순위: 3

#### 📌 현재 구조 분석

**주요 기능**:
- 수학/영어 시간표 통합 관리
- 수업 CRUD (Create, Read, Update, Delete)
- 학생 드래그 앤 드롭 이동
- 다중 뷰 모드: 강사별/교실별/수업별
- 요일/강사 순서 커스터마이징

**복잡도 원인**:
```typescript
// 문제 1: 수학/영어 로직 혼재
{activeTab === 'math' ? (
  // 700행의 수학 로직
) : (
  // 600행의 영어 로직
)}

// 문제 2: 40개 이상의 상태 변수
const [teachers, setTeachers] = useState([]);
const [rooms, setRooms] = useState([]);
// ... 38개 더

// 문제 3: 복잡한 rowspan 계산 (367-421행)
const calculateRowspan = (schedule, teacherId, day) => {
  // 55행의 복잡한 로직
};
```

#### 🔧 리팩토링 전략

##### Step 1: Tab 분리 (Week 1)

**목표**: 수학과 영어를 완전히 독립된 컴포넌트로 분리

```
📦 components/Timetable/
  ├─ TimetableManager.tsx          (150행) ⭐ 탭 전환만
  │   └─ 역할: 수학/영어 탭 선택 및 레이아웃
  │
  ├─ Math/
  │   ├─ MathTimetable.tsx         (400행) 🆕 새 파일
  │   │   └─ 역할: 수학 시간표 전용 로직
  │   │
  │   ├─ MathScheduleGrid.tsx      (200행)
  │   │   └─ 역할: 수학 그리드 렌더링
  │   │
  │   └─ useMathConfig.ts          (80행)
  │       └─ 역할: 수학 시간표 설정
  │
  └─ English/
      └─ (이미 존재하는 영어 컴포넌트들)
```

**구현 예시 - MathTimetable.tsx**:
```typescript
/**
 * 수학 시간표 전용 컴포넌트
 * TimetableManager에서 분리됨
 */
export const MathTimetable: React.FC = () => {
  const { teachers, rooms } = useMathConfig();
  const { classes, addClass, updateClass } = useClassManagement('math');
  const dragDrop = useStudentDragDrop();

  return (
    <div className="math-timetable">
      <MathToolbar />
      <MathScheduleGrid
        teachers={teachers}
        classes={classes}
        onDrop={dragDrop.handleDrop}
      />
    </div>
  );
};
```

**효과**:
- TimetableManager.tsx: 1,522행 → 150행 (-1,372행)
- 독립성: 수학/영어 각각 독립적으로 수정 가능
- 번들: Code Splitting으로 초기 로딩 속도 개선

---

##### Step 2: Custom Hooks 추출 (Week 1)

**목표**: 복잡한 비즈니스 로직을 Hooks로 분리

```
📦 hooks/timetable/
  ├─ useTimetableConfig.ts         // 강사/요일 순서 (94-158행)
  │   └─ 역할: 사용자 커스텀 설정 관리
  │
  ├─ useClassManagement.ts         // 수업 CRUD (453-558행)
  │   └─ 역할: 수업 추가/수정/삭제 로직
  │
  ├─ useStudentDragDrop.ts         // 드래그앤드롭 (561-641행)
  │   └─ 역할: 학생 이동 처리
  │
  ├─ usePendingMoves.ts            // 대기 중 이동 (605-634행)
  │   └─ 역할: 미저장 이동 내역 관리
  │
  └─ useScheduleData.ts            // 스케줄 데이터
      └─ 역할: Firestore와 로컬 상태 동기화
```

**구현 예시 - useClassManagement.ts**:
```typescript
/**
 * 수업 CRUD 로직을 관리하는 Hook
 *
 * @param subject - 과목 ('math' | 'english')
 */
export function useClassManagement(subject: 'math' | 'english') {
  const [classes, setClasses] = useState<TimetableClass[]>([]);
  const [loading, setLoading] = useState(false);

  const addClass = useCallback(async (newClass: TimetableClass) => {
    setLoading(true);
    try {
      const docRef = await addDoc(
        collection(db, 'classes'),
        { ...newClass, subject }
      );
      setClasses(prev => [...prev, { ...newClass, id: docRef.id }]);
      toast.success('수업이 추가되었습니다');
    } catch (error) {
      toast.error('수업 추가 실패');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [subject]);

  const updateClass = useCallback(async (
    classId: string,
    updates: Partial<TimetableClass>
  ) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'classes', classId), updates);
      setClasses(prev => prev.map(c =>
        c.id === classId ? { ...c, ...updates } : c
      ));
      toast.success('수업이 수정되었습니다');
    } catch (error) {
      toast.error('수업 수정 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  return { classes, addClass, updateClass, loading };
}
```

---

##### Step 3: Utils 분리 (Week 2)

**목표**: 복잡한 계산 로직을 순수 함수로 분리

```
📦 utils/timetable/
  ├─ cellCalculation.ts            // getConsecutiveSpan (367-388행)
  │   └─ 역할: rowspan/colspan 계산
  │
  ├─ scheduleValidator.ts          // checkConsecutive (424-450행)
  │   └─ 역할: 연속 수업 유효성 검증
  │
  ├─ weekCalculation.ts            // 주차 계산 (300-323행)
  │   └─ 역할: ISO 주차 번호 계산
  │
  └─ themeUtils.ts                 // getSubjectTheme (29-42행)
      └─ 역할: 과목별 색상 테마 반환
```

**구현 예시 - cellCalculation.ts**:
```typescript
/**
 * 연속 수업의 rowspan 값을 계산
 *
 * @param schedule - 전체 스케줄 데이터
 * @param teacherId - 강사 ID
 * @param day - 요일
 * @param period - 교시
 * @returns rowspan 값 (1 이상)
 *
 * @example
 * // 2교시 연속 수업인 경우
 * getConsecutiveSpan(schedule, 'T001', 'mon', 1) // → 2
 */
export function getConsecutiveSpan(
  schedule: ScheduleData,
  teacherId: string,
  day: Weekday,
  period: number
): number {
  const currentClass = schedule[teacherId]?.[day]?.[period];
  if (!currentClass) return 1;

  let span = 1;
  let nextPeriod = period + 1;

  // 다음 교시가 같은 수업인지 확인
  while (schedule[teacherId]?.[day]?.[nextPeriod] === currentClass) {
    span++;
    nextPeriod++;
  }

  return span;
}
```

**효과**:
- 순수 함수라 단위 테스트 100% 커버 가능
- 다른 시간표 컴포넌트에서도 재사용
- 복잡한 계산 로직 격리로 버그 감소

---

##### Step 4: Component 분해 (Week 2)

**목표**: UI를 작고 재사용 가능한 컴포넌트로 분리

```
📦 components/Timetable/
  ├─ Toolbar/
  │   ├─ TimetableToolbar.tsx      (80행)
  │   ├─ WeekNavigator.tsx         (50행)
  │   ├─ SearchBar.tsx             (40행)
  │   └─ OptionPanel.tsx           (60행)
  │
  ├─ Grid/
  │   ├─ ScheduleGrid.tsx          (150행)
  │   ├─ ClassCell.tsx             (80행)
  │   └─ StudentBadge.tsx          (40행)
  │
  └─ Modals/
      ├─ AddClassModal.tsx         (120행)
      ├─ ClassDetailModal.tsx      (100행)
      └─ ViewSettingsModal.tsx     (90행)
```

**구현 예시 - ClassCell.tsx**:
```typescript
interface ClassCellProps {
  className: string;
  students: Student[];
  rowSpan: number;
  colSpan: number;
  isDraggingOver: boolean;
  onDrop: (studentId: string) => void;
  onClick: () => void;
}

/**
 * 시간표 그리드의 개별 수업 셀
 * 드래그앤드롭을 지원하는 메모이즈된 컴포넌트
 */
export const ClassCell = React.memo<ClassCellProps>(({
  className,
  students,
  rowSpan,
  colSpan,
  isDraggingOver,
  onDrop,
  onClick
}) => {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const studentId = e.dataTransfer.getData('studentId');
    onDrop(studentId);
  };

  return (
    <td
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={`class-cell ${isDraggingOver ? 'dragging-over' : ''}`}
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      onClick={onClick}
    >
      <div className="class-name">{className}</div>
      <div className="student-count">{students.length}명</div>
      {students.slice(0, 3).map(s => (
        <StudentBadge key={s.id} student={s} />
      ))}
    </td>
  );
});
```

**효과**:
- React.memo로 불필요한 재렌더링 방지
- 각 셀이 독립적으로 동작 (성능 향상)
- Storybook으로 독립적 개발 가능

#### 📊 최종 효과 (TimetableManager.tsx)

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| **총 행수** | 1,522행 | ~200행 | **-87%** |
| **메인 로직** | 1,522행 | 200행 | 간결 |
| **Hooks** | 0개 | 5개 | 재사용성 ↑ |
| **Utils** | 0개 | 4개 | 테스트 용이 |
| **Components** | 1개 거대 | 12개 작은 | 독립성 ↑ |

---

### 3. SettingsModal.tsx (1,385행) - 우선순위: 4

#### 📌 현재 구조 분석

**주요 기능**:
- 4개 메인 탭: Calendar, Timetable, Gantt, Permissions
- 11개 서브 탭 관리
- 부서/사용자/강사/수업/권한 설정
- 배치 저장 시스템 (여러 탭 동시 저장)

**복잡도 원인**:
```typescript
// 문제 1: 11개 탭 UI가 모두 하나의 파일에 포함
function SettingsModal() {
  return (
    <Modal>
      {mainTab === 'calendar' && subTab === 'users' && <UsersTab />}
      {mainTab === 'calendar' && subTab === 'departments' && <DepartmentsTab />}
      // ... 9개 더
    </Modal>
  );
}

// 문제 2: 165행짜리 인라인 함수 (572-737행)
const renderUserDetail = (user: User) => {
  // 복잡한 권한 그리드 렌더링
};

// 문제 3: 복잡한 배치 저장 (373-449행)
const handleSaveAll = async () => {
  // 77행의 복잡한 로직
};
```

#### 🔧 리팩토링 전략

##### Step 1: Tab Components 완전 분리 (Week 1)

**현재 상태**: 일부는 이미 분리됨 (import 확인)
```typescript
// SettingsModal.tsx:11-12
import { DepartmentsTab } from './settings/DepartmentsTab';
import { TeachersTab } from './settings/TeachersTab';
```

**목표**: 나머지 탭도 모두 분리

```
📦 components/settings/
  ├─ Calendar/
  │   ├─ UsersTab.tsx              (200행) 🆕 분리 필요
  │   ├─ DepartmentsTab.tsx        (150행) ✅ 이미 분리됨
  │   ├─ HolidaysTab.tsx           (120행) 🆕 분리 필요
  │   └─ TeachersTab.tsx           (180행) ✅ 이미 분리됨
  │
  ├─ Timetable/
  │   ├─ ClassesTab.tsx            (160행) 🆕 분리 필요
  │   └─ ClassKeywordsTab.tsx      (100행) 🆕 분리 필요
  │
  ├─ Gantt/
  │   └─ GanttCategoriesTab.tsx    (140행) 🆕 분리 필요
  │
  └─ Permissions/
      ├─ RolePermissionsTab.tsx    (180행) 🆕 분리 필요
      └─ TabAccessTab.tsx          (120행) 🆕 분리 필요
```

---

##### Step 2: User Management 모듈화 (Week 1)

**목표**: 가장 복잡한 Users 탭을 별도 폴더로 구조화

```
📦 components/settings/Users/
  ├─ UsersTab.tsx                  (80행) ⭐ 메인
  │   └─ 역할: 사용자 목록 및 필터
  │
  ├─ UserDetailModal.tsx           (200행) 🆕 renderUserDetail 분리
  │   └─ 역할: 사용자 상세 정보 및 권한 편집
  │
  ├─ UserPermissionGrid.tsx        (120행) 🆕
  │   └─ 역할: 권한 그리드 (읽기/쓰기/삭제)
  │
  ├─ UserFilters.tsx               (60행) 🆕
  │   └─ 역할: 승인/대기/거부 필터
  │
  └─ types.ts                      (40행)
      └─ 역할: Users 모듈 전용 타입
```

**구현 예시 - UserDetailModal.tsx**:
```typescript
/**
 * 사용자 상세 정보 모달
 * SettingsModal의 renderUserDetail 함수에서 분리
 */
interface UserDetailModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<UserProfile>) => Promise<void>;
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  user,
  isOpen,
  onClose,
  onSave
}) => {
  const [editedUser, setEditedUser] = useState(user);
  const { departments } = useDepartments();
  const { permissions, updatePermission } = useUserPermissions(user.uid);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader>
        <h2>{user.displayName} 상세 정보</h2>
      </ModalHeader>

      <ModalBody>
        <UserInfoSection user={editedUser} onChange={setEditedUser} />
        <UserPermissionGrid
          permissions={permissions}
          onUpdate={updatePermission}
        />
        <UserDepartmentSelect
          selected={editedUser.departmentIds}
          options={departments}
          onChange={ids => setEditedUser({ ...editedUser, departmentIds: ids })}
        />
      </ModalBody>

      <ModalFooter>
        <Button onClick={onClose}>취소</Button>
        <Button primary onClick={() => onSave(editedUser)}>저장</Button>
      </ModalFooter>
    </Modal>
  );
};
```

---

##### Step 3: Custom Hooks 추출 (Week 2)

**목표**: 복잡한 비즈니스 로직을 Hooks로 분리

```
📦 hooks/settings/
  ├─ useSettingsState.ts           // 전역 설정 상태 관리
  │   └─ 역할: mainTab, subTab, hasChanges 통합
  │
  ├─ useDepartmentActions.ts       // 부서 CRUD
  │   └─ 역할: 부서 추가/수정/삭제 로직
  │
  ├─ useUserActions.ts             // 사용자 CRUD
  │   └─ 역할: 사용자 승인/거부/수정 로직
  │
  ├─ useBatchSave.ts               // 배치 저장 (373-449행)
  │   └─ 역할: 여러 탭의 변경사항 일괄 저장
  │
  └─ usePermissionCheck.ts         // 권한 체크 통합
      └─ 역할: hasPermission 로직 통합
```

**구현 예시 - useBatchSave.ts**:
```typescript
/**
 * 여러 설정 탭의 변경사항을 일괄 저장하는 Hook
 *
 * @example
 * const { hasChanges, pendingChanges, saveAll } = useBatchSave();
 *
 * // 변경사항 추가
 * pendingChanges.add('departments', newDepartment);
 *
 * // 일괄 저장
 * await saveAll();
 */
export function useBatchSave() {
  const [changes, setChanges] = useState<Map<string, any>>(new Map());
  const [saving, setSaving] = useState(false);

  const addChange = useCallback((key: string, data: any) => {
    setChanges(prev => new Map(prev).set(key, data));
  }, []);

  const saveAll = useCallback(async () => {
    if (changes.size === 0) return;

    setSaving(true);
    const batch = writeBatch(db);

    try {
      // Departments 저장
      const departments = changes.get('departments');
      if (departments) {
        departments.forEach(dept => {
          const ref = dept.id
            ? doc(db, 'departments', dept.id)
            : doc(collection(db, 'departments'));
          batch.set(ref, dept);
        });
      }

      // Teachers 저장
      const teachers = changes.get('teachers');
      if (teachers) {
        // ... 유사 로직
      }

      await batch.commit();
      setChanges(new Map()); // 초기화
      toast.success('모든 변경사항이 저장되었습니다');
    } catch (error) {
      console.error('Batch save failed:', error);
      toast.error('저장 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  }, [changes]);

  return {
    hasChanges: changes.size > 0,
    pendingChanges: changes,
    addChange,
    saveAll,
    saving
  };
}
```

---

##### Step 4: 메인 컴포넌트 간소화 (Week 2)

**목표**: SettingsModal을 탭 전환 레이어로만 사용

**Before (1,385행)**:
```typescript
function SettingsModal() {
  // 40개의 상태 변수
  const [mainTab, setMainTab] = useState('calendar');
  const [subTab, setSubTab] = useState('users');
  // ... 38개 더

  // 11개 탭의 모든 UI 로직
  return (
    <Modal>
      {/* 1,200행의 조건부 렌더링 */}
    </Modal>
  );
}
```

**After (~150행)**:
```typescript
/**
 * 설정 모달 - 탭 전환 및 레이아웃만 담당
 * 각 탭의 실제 로직은 개별 컴포넌트에서 처리
 */
function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { mainTab, subTab, setMainTab, setSubTab } = useSettingsState();
  const { hasChanges, saveAll } = useBatchSave();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
    >
      <SettingsHeader>
        <MainTabSelector
          active={mainTab}
          onChange={setMainTab}
        />
        <SubTabSelector
          mainTab={mainTab}
          active={subTab}
          onChange={setSubTab}
        />
      </SettingsHeader>

      <SettingsBody>
        <TabContent mainTab={mainTab} subTab={subTab} />
      </SettingsBody>

      {hasChanges && (
        <SettingsFooter>
          <SavePrompt count={changes.size} />
          <Button onClick={saveAll}>모두 저장</Button>
        </SettingsFooter>
      )}
    </Modal>
  );
}

/**
 * 탭별 컴포넌트 렌더링
 */
function TabContent({ mainTab, subTab }: TabContentProps) {
  // Calendar 탭
  if (mainTab === 'calendar') {
    if (subTab === 'users') return <UsersTab />;
    if (subTab === 'departments') return <DepartmentsTab />;
    if (subTab === 'teachers') return <TeachersTab />;
    if (subTab === 'holidays') return <HolidaysTab />;
  }

  // Timetable 탭
  if (mainTab === 'timetable') {
    if (subTab === 'classes') return <ClassesTab />;
    if (subTab === 'keywords') return <ClassKeywordsTab />;
  }

  // Gantt 탭
  if (mainTab === 'gantt') {
    return <GanttCategoriesTab />;
  }

  // Permissions 탭
  if (mainTab === 'permissions') {
    if (subTab === 'roles') return <RolePermissionsTab />;
    if (subTab === 'tabs') return <TabAccessTab />;
  }

  return null;
}
```

#### 📊 최종 효과 (SettingsModal.tsx)

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| **총 행수** | 1,385행 | ~150행 | **-89%** |
| **메인 로직** | 1,385행 | 150행 | 간결 |
| **Tab Components** | 일부만 분리 | 11개 모두 분리 | 완전 독립 |
| **Hooks** | 0개 | 5개 | 재사용성 ↑ |
| **번들 크기** | 거대 | Code Splitting | 초기 로딩 ↓ |

---

### 4. EnglishTeacherTab.tsx (1,075행) - 우선순위: 5

#### 📌 현재 구조 분석

**주요 기능**:
- 강사별 영어 시간표 뷰 (강사 × 요일 그리드)
- 셀 단위 편집 (드래그로 범위 선택)
- 배치 입력/삭제 (선택한 셀에 일괄 적용)
- 셀 이동 모드 (특정 셀 내용을 다른 셀로 이동)
- 합반 수업 관리

**복잡도 원인**:
```typescript
// 문제 1: 3가지 복잡한 모드 전환
const [mode, setMode] = useState<'view' | 'edit' | 'move'>('view');

// 문제 2: 드래그 선택 로직 (104-232행 = 129행)
const handleMouseDown = (teacherId, day, period) => {
  // 드래그 시작점 저장
  // 범위 계산
  // 선택 영역 업데이트
};

// 문제 3: 셀 이동 로직 (234-514행 = 281행)
const handleCellMove = async (from, to) => {
  // 이동 가능 여부 검증
  // Firestore 업데이트
  // 로컬 상태 동기화
};
```

#### 🔧 리팩토링 전략

##### Step 1: Custom Hooks 추출 (Week 1)

**목표**: 복잡한 상호작용 로직을 독립적인 Hooks로 분리

```
📦 hooks/englishTeacher/
  ├─ useDragSelection.ts           // 드래그 선택 (104-232행)
  │   └─ 역할: 마우스 드래그로 셀 범위 선택
  │
  ├─ useCellMovement.ts            // 셀 이동 (234-514행)
  │   └─ 역할: 셀 내용 이동 로직
  │
  ├─ useBatchInput.ts              // 배치 입력 (556-648행)
  │   └─ 역할: 선택한 셀에 일괄 입력
  │
  └─ useTeacherSchedule.ts         // 스케줄 관리
      └─ 역할: Firestore 데이터 로드 및 동기화
```

**구현 예시 - useDragSelection.ts**:
```typescript
/**
 * 드래그로 셀 범위를 선택하는 Hook
 *
 * @returns 선택 상태 및 이벤트 핸들러
 */
export function useDragSelection() {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<CellCoords | null>(null);
  const [dragEnd, setDragEnd] = useState<CellCoords | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  const handleMouseDown = useCallback((
    teacherId: string,
    day: Weekday,
    period: number
  ) => {
    setIsDragging(true);
    const coords = { teacherId, day, period };
    setDragStart(coords);
    setDragEnd(coords);
    setSelectedCells(new Set([getCellKey(coords)]));
  }, []);

  const handleMouseEnter = useCallback((
    teacherId: string,
    day: Weekday,
    period: number
  ) => {
    if (!isDragging || !dragStart) return;

    const coords = { teacherId, day, period };
    setDragEnd(coords);

    // 드래그 영역의 모든 셀 계산
    const cells = calculateDragArea(dragStart, coords);
    setSelectedCells(new Set(cells.map(getCellKey)));
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const clearSelection = useCallback(() => {
    setDragStart(null);
    setDragEnd(null);
    setSelectedCells(new Set());
  }, []);

  return {
    isDragging,
    selectedCells,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUp,
    clearSelection
  };
}

/**
 * 드래그 영역에 포함된 모든 셀의 좌표 계산
 */
function calculateDragArea(
  start: CellCoords,
  end: CellCoords
): CellCoords[] {
  const cells: CellCoords[] = [];

  // 시작/끝 좌표 정규화 (min/max)
  const minPeriod = Math.min(start.period, end.period);
  const maxPeriod = Math.max(start.period, end.period);

  // 같은 강사, 같은 요일의 범위만 선택
  if (start.teacherId === end.teacherId && start.day === end.day) {
    for (let p = minPeriod; p <= maxPeriod; p++) {
      cells.push({
        teacherId: start.teacherId,
        day: start.day,
        period: p
      });
    }
  }

  return cells;
}
```

**효과**:
- EnglishTeacherTab.tsx: 1,075행 → 800행 (-275행)
- 재사용성: 다른 시간표 뷰에서도 드래그 선택 기능 재사용
- 테스트: 드래그 로직만 독립적으로 테스트 가능

---

##### Step 2: Component 분해 (Week 2)

**목표**: UI를 작은 컴포넌트로 분리

```
📦 components/Timetable/English/TeacherTab/
  ├─ EnglishTeacherTab.tsx         (200행) ⭐ 메인
  │   └─ 역할: 레이아웃 및 모드 관리
  │
  ├─ TeacherToolbar.tsx            (80행)
  │   └─ 역할: 모드 전환, 검색, 옵션 버튼
  │
  ├─ ScheduleTable.tsx             (150행)
  │   └─ 역할: 강사 × 요일 그리드 테이블
  │
  ├─ ScheduleCell.tsx              (100행)
  │   └─ 역할: 개별 셀 렌더링 및 상호작용
  │
  └─ CellTooltip.tsx               (50행)
      └─ 역할: 합반 수업 정보 툴팁
```

**구현 예시 - ScheduleCell.tsx**:
```typescript
interface ScheduleCellProps {
  teacherId: string;
  day: Weekday;
  period: number;
  className?: string;
  isSelected: boolean;
  isMoving: boolean;
  onMouseDown: () => void;
  onMouseEnter: () => void;
  onClick: () => void;
}

/**
 * 강사 시간표의 개별 셀
 * 드래그 선택, 클릭, 이동 모드를 지원
 */
export const ScheduleCell = React.memo<ScheduleCellProps>(({
  teacherId,
  day,
  period,
  className,
  isSelected,
  isMoving,
  onMouseDown,
  onMouseEnter,
  onClick
}) => {
  const cellClass = classNames('schedule-cell', {
    'selected': isSelected,
    'moving': isMoving,
    'filled': !!className
  });

  return (
    <td
      className={cellClass}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      data-teacher={teacherId}
      data-day={day}
      data-period={period}
    >
      {className && (
        <>
          <div className="class-name">{className}</div>
          {/* 합반인 경우 툴팁 표시 */}
          {isMultiClass(className) && (
            <CellTooltip classes={parseMultiClass(className)} />
          )}
        </>
      )}
    </td>
  );
});
```

---

##### Step 3: Utils 분리 (Week 2)

**목표**: 순수 함수를 utils로 이동

```
📦 utils/englishTeacher/
  ├─ cellKeyUtils.ts               // getCellKey, parseCellKey
  │   └─ 역할: 셀 좌표 ↔ 문자열 키 변환
  │
  ├─ dragAreaUtils.ts              // calculateDragArea, isCellInArea
  │   └─ 역할: 드래그 영역 계산 로직
  │
  └─ firebaseSync.ts               // saveSplitDataToFirebase (539-555행)
      └─ 역할: 스케줄 데이터 Firestore 저장
```

**구현 예시 - cellKeyUtils.ts**:
```typescript
export interface CellCoords {
  teacherId: string;
  day: Weekday;
  period: number;
}

/**
 * 셀 좌표를 고유 문자열 키로 변환
 *
 * @example
 * getCellKey({ teacherId: 'T001', day: 'mon', period: 1 })
 * // → "T001-mon-1"
 */
export function getCellKey(coords: CellCoords): string {
  return `${coords.teacherId}-${coords.day}-${coords.period}`;
}

/**
 * 셀 키를 좌표 객체로 파싱
 *
 * @example
 * parseCellKey("T001-mon-1")
 * // → { teacherId: 'T001', day: 'mon', period: 1 }
 */
export function parseCellKey(key: string): CellCoords | null {
  const [teacherId, day, periodStr] = key.split('-');
  const period = parseInt(periodStr, 10);

  if (!teacherId || !day || isNaN(period)) {
    return null;
  }

  return { teacherId, day: day as Weekday, period };
}
```

#### 📊 최종 효과 (EnglishTeacherTab.tsx)

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| **총 행수** | 1,075행 | ~200행 | **-81%** |
| **메인 로직** | 1,075행 | 200행 | 간결 |
| **Hooks** | 0개 | 4개 | 재사용성 ↑ |
| **Utils** | 0개 | 3개 | 테스트 용이 |
| **Components** | 1개 거대 | 5개 독립 | 독립성 ↑ |

---

### 5. EventModal.tsx (1,039행) - 우선순위: 6

#### 📌 현재 구조 분석

**주요 기능**:
- 일정 생성/수정/삭제 (CRUD)
- 참가자 관리 (부서별 필터링)
- 반복 일정 설정 (매일/매주/매월/매년)
- 색상/스타일 커스터마이징
- View/Edit 모드 전환

**복잡도 원인**:
```typescript
// 문제 1: 거대한 초기화 로직 (103-253행 = 151행)
useEffect(() => {
  if (existingEvent) {
    // 기존 이벤트 데이터 파싱
    // 반복 설정 파싱
    // 참가자 목록 구성
    // ... 151행
  }
}, [existingEvent]);

// 문제 2: 24개의 폼 상태 변수
const [title, setTitle] = useState('');
const [description, setDescription] = useState('');
const [startDate, setStartDate] = useState('');
const [startTime, setStartTime] = useState('');
// ... 20개 더

// 문제 3: 복잡한 참가자 드롭다운 (612-745행 = 134행)
```

#### 🔧 리팩토링 전략

##### Step 1: Custom Hooks 추출 (Week 1)

**목표**: 복잡한 폼 로직을 Hooks로 분리

```
📦 hooks/event/
  ├─ useEventForm.ts               // 폼 상태 통합 관리
  │   └─ 역할: 24개 상태를 하나의 객체로 통합
  │
  ├─ useEventInitializer.ts        // 초기화 로직 (103-253행)
  │   └─ 역할: 기존 이벤트 → 폼 데이터 변환
  │
  ├─ useParticipantManager.ts      // 참가자 관리
  │   └─ 역할: 참가자 추가/제거/필터링
  │
  ├─ useRecurrence.ts              // 반복 설정
  │   └─ 역할: 반복 일정 로직 및 검증
  │
  └─ useAttendance.ts              // 참석 상태
      └─ 역할: 참석/불참석 관리
```

**구현 예시 - useEventForm.ts**:
```typescript
/**
 * 이벤트 폼 상태를 통합 관리하는 Hook
 * 24개의 개별 상태를 하나의 객체로 관리
 */
export interface EventFormData {
  // 기본 정보
  title: string;
  description: string;

  // 날짜/시간
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  isAllDay: boolean;

  // 분류
  departmentIds: string[];
  color: string;
  style: EventStyle;

  // 참가자
  participants: Participant[];
  attendance: Record<string, AttendanceStatus>;

  // 반복
  recurrence: RecurrenceSettings | null;
}

export function useEventForm(
  existingEvent?: CalendarEvent,
  initialData?: Partial<EventFormData>
) {
  const [formData, setFormData] = useState<EventFormData>(() => ({
    title: '',
    description: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endDate: format(new Date(), 'yyyy-MM-dd'),
    endTime: '10:00',
    isAllDay: false,
    departmentIds: [],
    color: '#3788d8',
    style: 'solid',
    participants: [],
    attendance: {},
    recurrence: null,
    ...initialData
  }));

  // 이벤트 초기화 (별도 Hook 사용)
  useEventInitializer(existingEvent, setFormData);

  // 개별 필드 업데이트
  const updateField = useCallback(<K extends keyof EventFormData>(
    field: K,
    value: EventFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // 여러 필드 동시 업데이트
  const updateFields = useCallback((
    updates: Partial<EventFormData>
  ) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // 폼 초기화
  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      description: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      // ... 기본값
    });
  }, []);

  // 유효성 검증
  const validateForm = useCallback((): string[] => {
    const errors: string[] = [];

    if (!formData.title.trim()) {
      errors.push('제목을 입력하세요');
    }

    if (formData.startDate > formData.endDate) {
      errors.push('종료일은 시작일 이후여야 합니다');
    }

    if (formData.participants.length === 0) {
      errors.push('최소 1명의 참가자를 선택하세요');
    }

    return errors;
  }, [formData]);

  return {
    formData,
    updateField,
    updateFields,
    resetForm,
    validateForm,
    isValid: validateForm().length === 0
  };
}
```

**효과**:
- EventModal.tsx: 1,039행 → 700행 (-339행)
- 타입 안정성: 모든 필드가 타입 체크됨
- 재사용성: 다른 이벤트 폼에서도 사용 가능

---

##### Step 2: Component 분해 (Week 2)

**목표**: 거대한 폼을 섹션별 컴포넌트로 분리

```
📦 components/EventModal/
  ├─ EventModal.tsx                (150행) ⭐ 메인
  │   └─ 역할: 레이아웃 및 저장/취소 로직
  │
  ├─ EventForm/
  │   ├─ BasicInfoSection.tsx      (80행)
  │   │   └─ 역할: 제목, 설명 입력
  │   │
  │   ├─ DateTimeSection.tsx       (120행)
  │   │   └─ 역할: 날짜, 시간, 종일 설정
  │   │
  │   ├─ DepartmentSelector.tsx    (60행)
  │   │   └─ 역할: 부서 다중 선택
  │   │
  │   ├─ ParticipantSelector.tsx   (150행)
  │   │   └─ 역할: 참가자 선택 드롭다운
  │   │
  │   ├─ RecurrenceSettings.tsx    (180행)
  │   │   └─ 역할: 반복 일정 설정
  │   │
  │   └─ ColorStyleSection.tsx     (70행)
  │       └─ 역할: 색상 및 스타일 선택
  │
  └─ EventModalFooter.tsx          (60행)
      └─ 역할: 저장/취소/삭제 버튼
```

**구현 예시 - ParticipantSelector.tsx**:
```typescript
/**
 * 이벤트 참가자 선택 컴포넌트
 * 부서별 필터링 및 검색 지원
 */
interface ParticipantSelectorProps {
  selected: Participant[];
  departments: Department[];
  onChange: (participants: Participant[]) => void;
}

export const ParticipantSelector: React.FC<ParticipantSelectorProps> = ({
  selected,
  departments,
  onChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState<string | null>(null);

  const { data: allUsers = [] } = useUsers({ status: 'approved' });

  // 필터링된 사용자 목록
  const filteredUsers = useMemo(() => {
    let users = allUsers;

    // 부서 필터
    if (filterDept) {
      users = users.filter(u => u.departmentIds.includes(filterDept));
    }

    // 검색어 필터
    if (searchTerm) {
      users = users.filter(u =>
        u.displayName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return users;
  }, [allUsers, filterDept, searchTerm]);

  const handleToggle = (user: UserProfile) => {
    const isSelected = selected.some(p => p.uid === user.uid);

    if (isSelected) {
      onChange(selected.filter(p => p.uid !== user.uid));
    } else {
      onChange([...selected, {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email
      }]);
    }
  };

  return (
    <div className="participant-selector">
      <label>참가자</label>

      <div className="selected-chips">
        {selected.map(p => (
          <Chip
            key={p.uid}
            label={p.displayName}
            onRemove={() => handleToggle(p)}
          />
        ))}
      </div>

      <Dropdown isOpen={isOpen} onToggle={setIsOpen}>
        <DropdownHeader>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="참가자 검색..."
          />
          <DepartmentFilter
            departments={departments}
            selected={filterDept}
            onChange={setFilterDept}
          />
        </DropdownHeader>

        <DropdownBody>
          {filteredUsers.map(user => (
            <DropdownItem
              key={user.uid}
              label={user.displayName}
              checked={selected.some(p => p.uid === user.uid)}
              onClick={() => handleToggle(user)}
            />
          ))}
        </DropdownBody>
      </Dropdown>
    </div>
  );
};
```

---

##### Step 3: Utils 분리 (Week 2)

**목표**: 이벤트 관련 유틸리티 함수 분리

```
📦 utils/event/
  ├─ eventIdGenerator.ts           // ID 생성 (261-273행)
  │   └─ 역할: 고유한 이벤트 ID 생성
  │
  ├─ colorUtils.ts                 // 색상 유틸
  │   └─ 역할: 색상 밝기 계산, 대비 색상
  │
  ├─ participantParser.ts          // 참가자 파싱
  │   └─ 역할: 문자열 ↔ Participant[] 변환
  │
  └─ recurrenceUtils.ts            // 반복 유틸
      └─ 역할: rrule 문자열 파싱 및 생성
```

**구현 예시 - eventIdGenerator.ts**:
```typescript
/**
 * 이벤트 ID 생성 유틸리티
 */

/**
 * 새 이벤트의 고유 ID 생성
 *
 * @param prefix - ID 접두사 (기본: 'evt')
 * @returns 고유한 이벤트 ID
 *
 * @example
 * generateEventId() // → "evt_20260105_1704441600_abc123"
 * generateEventId('meeting') // → "meeting_20260105_1704441600_abc123"
 */
export function generateEventId(prefix = 'evt'): string {
  const date = format(new Date(), 'yyyyMMdd');
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  return `${prefix}_${date}_${timestamp}_${random}`;
}

/**
 * 반복 이벤트의 개별 인스턴스 ID 생성
 *
 * @param parentId - 부모 이벤트 ID
 * @param date - 인스턴스 날짜
 * @returns 인스턴스 ID
 *
 * @example
 * generateInstanceId('evt_123', '2026-01-05')
 * // → "evt_123_20260105"
 */
export function generateInstanceId(
  parentId: string,
  date: string
): string {
  const dateStr = date.replace(/-/g, '');
  return `${parentId}_${dateStr}`;
}
```

#### 📊 최종 효과 (EventModal.tsx)

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| **총 행수** | 1,039행 | ~150행 | **-86%** |
| **메인 로직** | 1,039행 | 150행 | 간결 |
| **Hooks** | 0개 | 5개 | 재사용성 ↑ |
| **Utils** | 0개 | 4개 | 테스트 용이 |
| **Components** | 1개 거대 | 8개 독립 | 독립성 ↑ |

---

### 6. App.tsx (2,021행) - 우선순위: 1 (최우선)

#### 📌 특수 상황

**문제**: 파일이 너무 커서 한 번에 읽기 불가능 (25,400+ 토큰 초과)

**전략**: 단계적 접근
1. **Section별 읽기** (offset/limit 활용)
2. **주요 기능 파악**
3. **우선순위 설정**
4. **점진적 분리**

#### 🔧 리팩토링 전략 (예상)

##### Step 1: 구조 분석 (Week 1)

**목표**: App.tsx의 전체 구조 파악

```bash
# 섹션별로 나누어 읽기
1-500행:   Provider 및 Context 설정
501-1000행: Firebase 초기화 및 인증
1001-1500행: 라우팅 로직
1501-2021행: 메인 레이아웃
```

##### Step 2: Provider 레이어 분리 (Week 2)

**예상 구조**:
```
📦 providers/
  ├─ AuthProvider.tsx              // 인증 컨텍스트
  ├─ FirebaseProvider.tsx          // Firebase 초기화
  ├─ ThemeProvider.tsx             // 테마 설정
  └─ index.tsx                     // 통합 Provider
```

##### Step 3: 라우팅 분리 (Week 2)

**예상 구조**:
```
📦 routes/
  ├─ AppRouter.tsx                 // 메인 라우터
  ├─ ProtectedRoute.tsx            // 인증 필요 라우트
  └─ routes.config.ts              // 라우트 설정
```

##### Step 4: App.tsx 간소화 (Week 3)

**목표**: App.tsx를 최상위 조율자로만 사용

```typescript
// After (~100행)
function App() {
  return (
    <Providers>
      <AppRouter />
    </Providers>
  );
}
```

---

## 🚀 전체 실행 계획

### 타임라인 (13주)

```
Week  1-2:  EnglishClassTab 리팩토링
Week  3-4:  TimetableManager 리팩토링
Week  5-6:  SettingsModal 리팩토링
Week  7-8:  EnglishTeacherTab 리팩토링
Week  9-10: EventModal 리팩토링
Week 11-13: App.tsx 리팩토링
```

### 준비 단계 (Week 0)

**Git 브랜치 전략**:
```bash
# 메인 리팩토링 브랜치
git checkout -b refactor/large-files

# 파일별 서브 브랜치
git checkout -b refactor/english-class-tab
git checkout -b refactor/timetable-manager
git checkout -b refactor/settings-modal
# ...
```

**테스트 준비**:
- [ ] Vitest 설정
- [ ] React Testing Library 설정
- [ ] Snapshot 테스트 작성
- [ ] E2E 테스트 (Playwright) 주요 플로우

**도구 설정**:
- [ ] ESLint 규칙 강화
- [ ] Prettier 설정
- [ ] Husky pre-commit hook
- [ ] GitHub Actions CI/CD

---

## 📋 리팩토링 체크리스트

### 각 파일 리팩토링 시 확인사항

#### ✅ 코드 품질
- [ ] **메인 파일 300행 이하**
- [ ] **함수 50행 이하**
- [ ] **Cyclomatic Complexity < 10**
- [ ] **중복 코드 제거 (DRY)**
- [ ] **명확한 네이밍**

#### ✅ 성능
- [ ] **불필요한 재렌더링 제거**
  - React DevTools Profiler로 측정
  - useMemo/useCallback 적절히 사용
  - React.memo 적용 (필요시)
- [ ] **번들 크기 측정**
  - webpack-bundle-analyzer로 확인
  - Code Splitting 적용

#### ✅ 테스트
- [ ] **기존 기능 모두 정상 동작**
  - 수동 테스트 수행
  - E2E 테스트 통과
- [ ] **UI 스냅샷 테스트 통과**
- [ ] **단위 테스트 커버리지 > 70%**

#### ✅ 문서화
- [ ] **JSDoc 주석 작성**
  - 모든 public 함수/컴포넌트
  - 복잡한 로직 설명
- [ ] **README 업데이트**
  - 폴더 구조 설명
  - 주요 모듈 소개
- [ ] **CHANGELOG 기록**
  - 변경 이력 상세 기록

#### ✅ Git 관리
- [ ] **작은 커밋 단위**
  - 하나의 변경사항 = 하나의 커밋
- [ ] **의미 있는 커밋 메시지**
  - `refactor(파일명): 변경 내용`
- [ ] **PR 단위 명확**
  - 리뷰 가능한 크기 (300-500행)

---

## ⚠️ 리스크 및 대응 방안

### 1. 기능 회귀 (Regression)

**리스크**: 리팩토링 중 기존 기능 손상

**대응**:
- ✅ **리팩토링 전 스냅샷 테스트** 작성
- ✅ **각 단계마다 전체 앱 동작 확인**
- ✅ **Critical Path 수동 테스트**
  - 사용자 로그인
  - 일정 생성/수정/삭제
  - 시간표 조회/편집
  - 설정 변경

### 2. 타입 안정성 손실

**리스크**: 리팩토링 과정에서 any 타입 남용

**대응**:
- ✅ **TypeScript strict 모드 유지**
- ✅ **분리된 파일마다 타입 명시**
- ✅ **any 타입 사용 금지**
  - ESLint 규칙: `@typescript-eslint/no-explicit-any`

### 3. Git 충돌

**리스크**: 팀원과 동시 작업 시 충돌

**대응**:
- ✅ **리팩토링 중 신규 기능 개발 중단**
- ✅ **파일별 독립 브랜치**
- ✅ **작은 PR로 빠른 머지**

### 4. 성능 저하

**리스크**: 리팩토링 후 속도 느려짐

**대응**:
- ✅ **리팩토링 전후 Lighthouse 점수 비교**
- ✅ **React DevTools Profiler로 측정**
- ✅ **번들 크기 모니터링**

---

## 📈 예상 효과 종합

### 코드 메트릭 개선

| 파일 | Before | After | 개선율 | 절감 행수 |
|------|--------|-------|--------|----------|
| App.tsx | 2,021행 | ~100행 | 95% | 1,921행 |
| EnglishClassTab | 1,567행 | ~300행 | 81% | 1,267행 |
| TimetableManager | 1,522행 | ~200행 | 87% | 1,322행 |
| SettingsModal | 1,385행 | ~150행 | 89% | 1,235행 |
| EnglishTeacherTab | 1,075행 | ~200행 | 81% | 875행 |
| EventModal | 1,039행 | ~150행 | 86% | 889행 |
| **총계** | **8,609행** | **~1,100행** | **87%** | **7,509행** |

### 프로젝트 구조 개선

**Before**:
```
src/
├─ App.tsx                (2,021행)
├─ components/
│   ├─ EnglishClassTab.tsx   (1,567행)
│   ├─ TimetableManager.tsx  (1,522행)
│   ├─ SettingsModal.tsx     (1,385행)
│   ├─ EnglishTeacherTab.tsx (1,075행)
│   └─ EventModal.tsx        (1,039행)
└─ types.ts              (581행)

총 파일: 77개
거대 파일: 6개 (8,609행)
```

**After**:
```
src/
├─ App.tsx                (~100행) ✨
│
├─ components/
│   ├─ EnglishClassTab.tsx      (~300행) ✨
│   ├─ TimetableManager.tsx     (~200행) ✨
│   ├─ SettingsModal.tsx        (~150행) ✨
│   ├─ EnglishTeacherTab.tsx    (~200행) ✨
│   ├─ EventModal.tsx           (~150행) ✨
│   │
│   ├─ Timetable/
│   │   ├─ English/ClassCard/   (5개 파일)
│   │   ├─ Math/                (3개 파일)
│   │   ├─ Grid/                (3개 파일)
│   │   └─ Toolbar/             (4개 파일)
│   │
│   ├─ settings/
│   │   ├─ Calendar/            (4개 탭)
│   │   ├─ Timetable/           (2개 탭)
│   │   ├─ Gantt/               (1개 탭)
│   │   └─ Permissions/         (2개 탭)
│   │
│   └─ EventModal/
│       └─ EventForm/           (6개 섹션)
│
├─ hooks/
│   ├─ english/                 (8개 Hooks)
│   ├─ timetable/               (5개 Hooks)
│   ├─ englishTeacher/          (4개 Hooks)
│   ├─ settings/                (5개 Hooks)
│   └─ event/                   (5개 Hooks)
│
├─ utils/
│   ├─ english/                 (4개 Utils)
│   ├─ timetable/               (4개 Utils)
│   ├─ englishTeacher/          (3개 Utils)
│   └─ event/                   (4개 Utils)
│
├─ providers/                   (4개 Providers)
└─ routes/                      (3개 Router 파일)

총 파일: ~150개 (2배 증가)
평균 파일 크기: ~150행 (10배 감소)
```

### 개발자 경험 개선

| 지표 | Before | After | 개선 |
|------|--------|-------|------|
| **코드 파악 시간** | 2-3시간 | 30분 | 75% 단축 |
| **버그 수정 시간** | 1-2시간 | 15-30분 | 70% 단축 |
| **신규 기능 추가** | 4-6시간 | 2-3시간 | 50% 단축 |
| **Git 머지 충돌** | 주 5-7회 | 주 2-3회 | 60% 감소 |
| **코드 리뷰 시간** | 2시간 | 30분 | 75% 단축 |

---

## 🎓 리팩토링 원칙

### 안전한 리팩토링

1. **Red-Green-Refactor 사이클**
   - Red: 테스트 작성 (기능 명세)
   - Green: 최소 구현으로 테스트 통과
   - Refactor: 코드 개선

2. **Boy Scout Rule**
   - 코드를 만질 때마다 조금씩 개선
   - 주변 코드도 함께 정리

3. **2-Hat Philosophy**
   - 기능 추가 모드 ↔ 리팩토링 모드 명확히 구분
   - 동시에 하지 않기

### 리팩토링 패턴 활용

- **Extract Function**: 긴 함수 분리
- **Extract Component**: 큰 컴포넌트 분리
- **Extract Hook**: 상태 로직 분리
- **Extract Module**: 관련 코드 모듈화
- **Replace Conditional with Polymorphism**: 조건문을 컴포넌트로

---

## 📞 다음 단계

### 권장 시작 순서

1. **EnglishClassTab** (2주)
   - 독립적이고 명확한 구조
   - 다른 파일 의존성 낮음
   - 리팩토링 연습에 적합

2. **TimetableManager** (2주)
   - EnglishClassTab 경험 활용
   - 수학/영어 분리로 큰 효과

3. **SettingsModal** (2주)
   - 탭 분리 패턴 확립
   - Code Splitting 실습

4. **나머지 파일** (6주)
   - 패턴이 확립된 후 빠르게 진행

### 시작 전 확인사항

- [ ] 팀원들과 리팩토링 계획 공유
- [ ] 신규 기능 개발 일정 조율
- [ ] 테스트 환경 준비
- [ ] Git 브랜치 전략 합의

---

**작성 완료**: 2026-01-05
**다음 리뷰**: Phase 1 완료 후 (2주 후)
**문의**: 리팩토링 관련 문의는 개발팀 회의에서 논의
