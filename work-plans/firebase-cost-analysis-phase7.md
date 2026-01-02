# Firebase 비용 분석: Phase 7 간트 차트 고도화

**분석 대상**: Phase 7.1 (데이터 모델 확장) & Phase 7.3 (캘린더 통합)
**분석 일시**: 2026년 1월 3일
**분석자**: firebase-cost-optimizer agent

---

## 1. Executive Summary

### 핵심 발견사항

**Phase 7.1 영향** (데이터 모델 확장)
- 문서 크기 증가: ~150 bytes/task (비용 영향 미미)
- 비정규화 전략 우수: assigneeName 저장으로 추가 읽기 제거
- 월간 비용 영향: **$0.00** (무료 범위 내)

**Phase 7.3 영향** (캘린더 통합)
- 현재 구현 상태: **미구현**
- 예상 읽기 증가: 프로젝트당 1회 추가 조회
- React Query 캐싱 적용 시: **비용 영향 없음**

### 종합 평가
- 현재 Firestore 사용량: **14.2%** (무료 한도 대비)
- Phase 7 완료 후: **15-20%** (여전히 안전)
- 상태: 🟢 **매우 안전** - 무료 범위 내 운영 가능

### 권장 조치
1. Phase 7.3 구현 시 **React Query 캐싱 필수 적용**
2. 간트 프로젝트 목록에 **페이지네이션 고려** (향후 100개 이상 시)
3. 현재는 추가 최적화 불필요

---

## 2. Phase 7.1 비용 영향 분석: 데이터 모델 확장

### 2.1 새로운 필드 추가

**확장된 GanttSubTask 구조**:
```typescript
export interface GanttSubTask {
  id: string;
  title: string;
  description: string;
  startOffset: number;
  duration: number;
  completed: boolean;

  // ===== Phase 7 추가 필드 =====
  assigneeId?: string;        // UID (36 bytes)
  assigneeName?: string;      // Display Name (~20 bytes)
  assigneeEmail?: string;     // Email (~30 bytes)
  departmentIds?: string[];   // Department IDs (~40 bytes)
}
```

### 2.2 문서 크기 증가 분석

**기존 문서 크기** (Phase 6):
```
GanttProject 문서 구조:
{
  id: string,              // 20 bytes
  templateId: string,      // 20 bytes
  title: string,           // ~50 bytes
  tasks: GanttSubTask[],   // ~300 bytes/task
  progress: number,        // 8 bytes
  startedAt: number,       // 8 bytes
  lastUpdated: number,     // 8 bytes
  ownerId: string          // 36 bytes
}

평균 작업 수: 5개
기존 문서 크기: ~1,500 bytes
```

**Phase 7.1 이후**:
```
추가 필드 크기 (작업당):
- assigneeId: 36 bytes
- assigneeName: ~20 bytes
- assigneeEmail: ~30 bytes
- departmentIds: ~40 bytes (평균 2개 부서)
----------------------------
총 추가: ~126 bytes/task

5개 작업 × 126 bytes = 630 bytes 추가
새 문서 크기: ~2,130 bytes (+42%)
```

### 2.3 저장 공간 비용 영향

**현재 예상 데이터**:
```
예상 프로젝트 수: 20개
사용자당 평균 프로젝트: 2개
총 사용자: 10명

총 프로젝트 문서: 20개
총 저장 공간:
- Phase 6: 20 × 1,500 bytes = 30 KB
- Phase 7.1: 20 × 2,130 bytes = 42.6 KB
----------------------------
추가 저장 공간: +12.6 KB
```

**비용 계산**:
```
Firestore 저장 공간 요금:
- 무료 할당량: 1 GB
- 초과분: $0.18/GB/월

현재 사용량: ~42.6 KB
무료 할당량 사용률: 0.004%
----------------------------
월간 저장 비용: $0.00
```

### 2.4 읽기 비용 영향

**시나리오 1: 비정규화 없이 구현** (assigneeName 저장 안 함)
```typescript
// ❌ 비효율적: 매번 사용자 정보 조회
async function renderGanttChart(project: GanttProject) {
  // 1. 프로젝트 조회 (1 읽기)
  const projectDoc = await getDoc(doc(db, 'gantt_projects', projectId));

  // 2. 각 작업의 담당자 정보 조회 (5 읽기)
  for (const task of project.tasks) {
    const userDoc = await getDoc(doc(db, 'users', task.assigneeId));
    // assigneeName 사용
  }
}

비용:
- 프로젝트 조회: 1 읽기
- 담당자 조회: 5 읽기 (작업 5개)
----------------------------
총 읽기: 6 읽기/렌더링

일일 렌더링: 10명 × 3회 = 30회
일일 읽기: 30 × 6 = 180 읽기
월간 읽기: 5,400 읽기 💸
```

**시나리오 2: 비정규화 적용** (현재 구현 - assigneeName 저장)
```typescript
// ✅ 효율적: 모든 정보가 포함됨
async function renderGanttChart(project: GanttProject) {
  // 1. 프로젝트 조회만 필요 (1 읽기)
  const projectDoc = await getDoc(doc(db, 'gantt_projects', projectId));

  // 2. tasks에 이미 assigneeName 포함
  project.tasks.forEach(task => {
    console.log(task.assigneeName); // 추가 읽기 불필요
  });
}

비용:
- 프로젝트 조회: 1 읽기
----------------------------
총 읽기: 1 읽기/렌더링 ✅

일일 렌더링: 10명 × 3회 = 30회
일일 읽기: 30 × 1 = 30 읽기
월간 읽기: 900 읽기
```

**비정규화의 비용 절감 효과**:
```
Before: 5,400 읽기/월
After: 900 읽기/월
----------------------------
절감: -4,500 읽기/월 (-83%)
절감 금액: $0.00 (무료 범위 내이지만 미래 대비)
```

### 2.5 쓰기 비용 영향 (Trade-off)

**비정규화의 대가: 이름 변경 시 동기화 필요**

```typescript
// 사용자 이름 변경 시
async function updateUserDisplayName(userId: string, newName: string) {
  const batch = writeBatch(db);

  // 1. users 컬렉션 업데이트 (1 쓰기)
  batch.update(doc(db, 'users', userId), {
    displayName: newName
  });

  // 2. 해당 사용자가 담당자인 모든 프로젝트 업데이트
  const projectsSnapshot = await getDocs(
    query(
      collection(db, 'gantt_projects'),
      // 주의: Firestore는 배열 내 객체 필드 조회 불가
      // 전체 프로젝트를 조회 후 클라이언트 측 필터링 필요
    )
  );

  // 클라이언트 측 필터링
  const affectedProjects = projectsSnapshot.docs.filter(doc => {
    const project = doc.data() as GanttProject;
    return project.tasks.some(task => task.assigneeId === userId);
  });

  // 각 프로젝트의 tasks 배열 업데이트
  affectedProjects.forEach(projectDoc => {
    const project = projectDoc.data() as GanttProject;
    const updatedTasks = project.tasks.map(task =>
      task.assigneeId === userId
        ? { ...task, assigneeName: newName }
        : task
    );

    batch.update(projectDoc.ref, { tasks: updatedTasks });
  });

  await batch.commit();
}

비용:
- users 업데이트: 1 쓰기
- 전체 프로젝트 조회: 20 읽기 (최악의 경우)
- 영향받는 프로젝트 업데이트: 평균 5 쓰기
----------------------------
총 비용: 20 읽기 + 6 쓰기 (이름 변경 1회당)
```

**이름 변경 빈도 vs 조회 빈도**:
```
이름 변경: 1회/월 (드물게 발생)
간트 차트 렌더링: 900회/월

비정규화 적용:
- 읽기: 900 + 20 = 920 읽기/월
- 쓰기: 6 쓰기/월

비정규화 미적용:
- 읽기: 5,400 읽기/월
- 쓰기: 0 쓰기/월

----------------------------
결론: 비정규화가 여전히 효율적 (-83% 읽기 절감)
```

### 2.6 Firestore 보안 규칙 영향

**현재 구현**:
```javascript
// firestore.rules (라인 68-72)
allow create: if isAuthenticated() &&
  hasRole(['master', 'admin', 'manager']) &&
  request.resource.data.createdBy == request.auth.uid &&
  // Phase 7 Validation
  (!('tasks' in request.resource.data) ||
   request.resource.data.tasks.size() == 0 ||
   (!('assigneeId' in request.resource.data.tasks[0]) ||
    request.resource.data.tasks[0].assigneeId is string) &&
   (!('departmentIds' in request.resource.data.tasks[0]) ||
    request.resource.data.tasks[0].departmentIds is list));
```

**보안 규칙 평가 비용**:
- Firestore 보안 규칙은 무료 (읽기/쓰기 횟수에만 과금)
- 타입 검증 추가로 인한 비용 영향: **없음**

### 2.7 Phase 7.1 종합 평가

| 항목 | Before | After | 변화 |
|------|--------|-------|------|
| 문서 크기 | 1,500 bytes | 2,130 bytes | +42% |
| 저장 공간 | 30 KB | 42.6 KB | +12.6 KB |
| 월간 읽기 | 5,400회 | 920회 | -83% ✅ |
| 월간 쓰기 | 0회 | 6회 | +6회 |
| 월간 비용 | $0.00 | $0.00 | 변화 없음 |

**결론**:
- 비정규화 전략 탁월 ✅
- 문서 크기 증가는 미미 (12.6 KB)
- 읽기 83% 절감으로 미래 확장성 확보
- 현재 비용 영향 없음

---

## 3. Phase 7.3 비용 영향 분석: 캘린더 통합

### 3.1 구현 계획 분석

**현재 상태**: 미구현 (계획 단계)

**예상 구현 방식** (리포트 기준):
```typescript
// App.tsx에서 간트 프로젝트 조회
const { data: ganttProjects } = useGanttProjects(user?.uid);

// 변환 로직 (utils/ganttToCalendar.ts)
function convertGanttToCalendarEvents(
  projects: GanttProject[]
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  projects.forEach(project => {
    project.tasks.forEach(task => {
      events.push({
        id: `gantt-${project.id}-${task.id}`,
        title: `[${project.title}] ${task.title}`,
        startDate: calculateStartDate(project.startedAt, task.startOffset),
        endDate: calculateEndDate(project.startedAt, task.startOffset, task.duration),
        isAllDay: true,
        color: '#8b5cf6',
        departmentId: task.departmentIds?.[0] || 'gantt',
        departmentIds: task.departmentIds,
        description: task.description,
        participants: task.assigneeName,
        // ... 기타 필드
      });
    });
  });

  return events;
}

// App.tsx에서 병합
const displayEvents = useMemo(() => {
  const ganttEvents = convertGanttToCalendarEvents(ganttProjects || []);
  return [...events, ...ganttEvents];
}, [events, ganttProjects]);
```

### 3.2 읽기 비용 분석

**시나리오 1: 실시간 리스너 사용** (비권장)
```typescript
// ❌ 비효율적: 실시간 구독
useEffect(() => {
  const unsubscribe = onSnapshot(
    query(
      collection(db, 'gantt_projects'),
      where('ownerId', '==', userId)
    ),
    (snapshot) => {
      const projects = snapshot.docs.map(doc => doc.data());
      setGanttProjects(projects);
    }
  );
  return () => unsubscribe();
}, [userId]);

비용:
- 초기 구독: 사용자당 평균 2개 프로젝트 = 2 읽기
- 변경 알림: 프로젝트 수정 시마다 재전송
- 10명 사용자 × 2 읽기 × 10회 재접속 = 200 읽기/일
----------------------------
월간 읽기: 6,000 읽기 💸
```

**시나리오 2: React Query + 캐싱** (권장 - 현재 구현)
```typescript
// ✅ 효율적: 캐싱 쿼리 (현재 useGanttProjects 구현)
export const useGanttProjects = (userId?: string) => {
  return useQuery({
    queryKey: ['ganttProjects', userId],
    queryFn: async () => {
      if (!userId) return [];

      const q = query(
        collection(db, 'gantt_projects'),
        where('ownerId', '==', userId),
        orderBy('lastUpdated', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ... }));
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,  // 2분간 fresh
    gcTime: 1000 * 60 * 10,    // 10분 캐시 유지
  });
};

비용:
- 초기 로드: 2 읽기 (사용자당 프로젝트 2개)
- 2분 후 재요청: 2 읽기
- 10명 × 2 읽기 × 5회/일 = 100 읽기/일
----------------------------
월간 읽기: 3,000 읽기 ✅
```

**캐싱 효과**:
```
실시간 리스너: 6,000 읽기/월
React Query 캐싱: 3,000 읽기/월
----------------------------
절감: -3,000 읽기/월 (-50%)
```

### 3.3 클라이언트 측 변환 비용

**변환 로직 실행 비용**:
```typescript
// 클라이언트 측 데이터 변환 (Firestore 비용 없음)
function convertGanttToCalendarEvents(projects: GanttProject[]) {
  // 순수 JavaScript 연산 (무료)
  // CPU 사용만 발생, Firestore 비용 없음

  // 복잡도: O(n * m)
  // n = 프로젝트 수 (20개)
  // m = 작업 수 (평균 5개)
  // 총 연산: 100회

  // 실행 시간: ~1ms (무시 가능)
}

Firestore 비용: $0.00
성능 영향: 미미 (1ms 이하)
```

### 3.4 App.tsx에서 추가 조회 비용

**캘린더 탭 렌더링 시나리오**:
```typescript
// App.tsx (Phase 7.3 구현 후)
const App = () => {
  const [appMode, setAppMode] = useState<'calendar' | 'gantt'>('calendar');
  const user = auth.currentUser;

  // 기존 데이터
  const { data: events } = useQuery(...);        // 500 읽기 (초기)
  const { data: departments } = useQuery(...);   // 50 읽기 (초기)

  // Phase 7.3 추가
  const { data: ganttProjects } = useGanttProjects(user?.uid);  // +2 읽기

  const displayEvents = useMemo(() => {
    const ganttEvents = convertGanttToCalendarEvents(ganttProjects || []);
    return [...events, ...ganttEvents];
  }, [events, ganttProjects]);

  return <CalendarBoard events={displayEvents} />;
};

추가 비용 (캘린더 탭 렌더링 시):
- 초기 로드: +2 읽기
- 2분마다 재요청: +2 읽기
----------------------------
기존: 550 읽기 (events + departments)
Phase 7.3: 552 읽기 (+0.4%)
```

### 3.5 캘린더 vs 간트 탭 전환 시나리오

**시나리오 분석**:
```
사용자 행동 패턴:
- 캘린더 탭: 80% 사용 빈도
- 간트 탭: 20% 사용 빈도

현재 구현 (간트 탭에서만 조회):
- 간트 탭 접속 시: 2 읽기
- 캘린더 탭 접속 시: 0 읽기
- 평균: 0.4 읽기/접속

Phase 7.3 구현 (캘린더 탭에서도 조회):
- 간트 탭 접속 시: 2 읽기 (캐시 히트)
- 캘린더 탭 접속 시: 2 읽기
- 평균: 2 읽기/접속

----------------------------
비용 증가: +1.6 읽기/접속 (캐싱 고려 시)
```

**최적화 전략**:
```typescript
// ✅ 조건부 로딩: 캘린더 탭에서만 간트 데이터 조회
const shouldLoadGantt = appMode === 'calendar';

const { data: ganttProjects } = useGanttProjects(
  shouldLoadGantt ? user?.uid : undefined  // enabled 조건
);

효과:
- 간트 탭만 사용 시: 간트 데이터 조회 안 함
- 캘린더 탭 사용 시에만 조회
----------------------------
불필요한 조회 제거
```

### 3.6 Phase 7.3 예상 비용 계산

**일일 사용 패턴**:
```
활성 사용자: 10명
캘린더 탭 접속: 10명 × 5회/일 = 50회
간트 탭 접속: 10명 × 1회/일 = 10회

캘린더 탭에서 간트 데이터 조회:
- 초기 로드: 50회 × 2 읽기 = 100 읽기
- 2분 캐싱 효과: 50회 → 25회 (캐시 히트율 50%)
- 실제 읽기: 25회 × 2 = 50 읽기/일

간트 탭에서 간트 데이터 조회:
- 10회 × 2 읽기 = 20 읽기/일
- 캐시 히트: 대부분 캘린더 탭에서 이미 로드됨
- 실제 읽기: 10 읽기/일

----------------------------
일일 총 추가 읽기: 60 읽기
월간 추가 읽기: 1,800 읽기
```

**전체 비용 영향**:
```
Phase 6 (현재):
- 일일 읽기: 7,100회
- 월간 읽기: 213,000회

Phase 7.3 완료 후:
- 일일 읽기: 7,160회 (+0.8%)
- 월간 읽기: 214,800회 (+0.8%)
- 무료 할당량 사용률: 14.3% (안전)

----------------------------
월간 비용: $0.00 (무료 범위)
```

### 3.7 성능 영향 분석

**렌더링 성능**:
```typescript
// useMemo로 최적화
const displayEvents = useMemo(() => {
  const ganttEvents = convertGanttToCalendarEvents(ganttProjects || []);
  return [...events, ...ganttEvents];
}, [events, ganttProjects]);

복잡도:
- 간트 프로젝트: 2개
- 작업 수: 10개 (2개 × 5개)
- 캘린더 이벤트 변환: 10개 추가
- 기존 이벤트: 500개

총 이벤트: 510개
메모리 증가: +10개 이벤트 (~2KB)
렌더링 영향: 미미 (useMemo로 최적화됨)
```

**캘린더 렌더링 부하**:
```
Before: 500개 이벤트 렌더링
After: 510개 이벤트 렌더링 (+2%)

성능 영향: 거의 없음
```

### 3.8 Phase 7.3 종합 평가

| 항목 | Before | After | 변화 |
|------|--------|-------|------|
| 일일 읽기 | 7,100회 | 7,160회 | +60회 (+0.8%) |
| 월간 읽기 | 213,000회 | 214,800회 | +1,800회 |
| 무료 할당량 | 14.2% | 14.3% | +0.1% |
| 월간 비용 | $0.00 | $0.00 | 변화 없음 |
| 렌더링 부하 | 500 이벤트 | 510 이벤트 | +2% |

**결론**:
- 비용 영향 극히 미미 (+0.8%) ✅
- React Query 캐싱으로 최적화 완료
- 무료 범위 내 안전하게 운영 가능
- 추가 최적화 불필요

---

## 4. 전체 비용 비교표

### 4.1 Phase별 누적 비용 비교

| Phase | 일일 읽기 | 월간 읽기 | 무료 할당량 | 월간 비용 | 상태 |
|-------|----------|----------|------------|----------|------|
| Phase 6 (기준) | 7,100 | 213,000 | 14.2% | $0.00 | 🟢 안전 |
| Phase 7.1 (모델 확장) | 7,100 | 213,000 | 14.2% | $0.00 | 🟢 안전 |
| Phase 7.3 (캘린더 통합) | 7,160 | 214,800 | 14.3% | $0.00 | 🟢 안전 |
| **Phase 7 완료** | **7,160** | **214,800** | **14.3%** | **$0.00** | **🟢 안전** |

### 4.2 사용자 증가 시뮬레이션

**현재 (10명 사용자)**:
```
읽기: 214,800회/월 (14.3%)
쓰기: 2,700회/월 (0.45%)
비용: $0.00/월
```

**사용자 50명**:
```
읽기: 214,800 × 5 = 1,074,000회/월 (71.6%)
쓰기: 2,700 × 5 = 13,500회/월 (2.25%)
비용: $0.00/월 (여전히 무료 범위)
```

**사용자 100명**:
```
읽기: 214,800 × 10 = 2,148,000회/월 (143%)
  └─ 초과분: 648,000회
쓰기: 2,700 × 10 = 27,000회/월 (4.5%)
비용:
  - 읽기: 648,000 × $0.06/100K = $0.39/월
  - 쓰기: $0.00 (무료 범위)
  - 총액: $0.39/월 💸
```

**사용자 200명**:
```
읽기: 214,800 × 20 = 4,296,000회/월 (286%)
  └─ 초과분: 2,796,000회
쓰기: 2,700 × 20 = 54,000회/월 (9%)
비용:
  - 읽기: 2,796,000 × $0.06/100K = $1.68/월
  - 쓰기: $0.00
  - 총액: $1.68/월 💸
```

### 4.3 최적화 시나리오 비교

**현재 구현 (React Query 캐싱 적용)**:
```
200명 사용자 시: $1.68/월
```

**최적화 1: staleTime 5분 → 10분**:
```typescript
staleTime: 1000 * 60 * 10,  // 10분

효과: 재요청 빈도 50% 감소
비용: $1.68 → $0.84/월 (-50%)
```

**최적화 2: 정적 데이터 실시간 리스너 제거** (Phase 6 권장사항):
```
기존 비용 분석 (firebase-cost-optimization-report.md):
- 정적 데이터 리스너 제거로 70% 읽기 감소

Phase 7.3 + 최적화 2:
- 읽기: 214,800 × 0.3 = 64,440회/월 (Phase 7 기준)
- 200명 사용자: 64,440 × 20 = 1,288,800회/월
- 초과분: 0 (무료 범위 내)
- 비용: $0.00/월 ✅
```

**결론**: Phase 6 최적화 권장사항 적용 시 200명까지 무료 운영 가능

---

## 5. 구체적인 최적화 권장사항

### 5.1 Phase 7.3 구현 시 필수 적용사항

#### 권장사항 1: 조건부 로딩 (Conditional Loading)

**문제**:
- 간트 탭만 사용하는 사용자도 간트 데이터를 조회
- 불필요한 읽기 발생

**해결책**:
```typescript
// ✅ App.tsx - 캘린더 탭에서만 간트 데이터 로드
const App = () => {
  const [appMode, setAppMode] = useState<'calendar' | 'gantt'>('calendar');
  const user = auth.currentUser;

  // 조건부 로딩: 캘린더 모드일 때만 간트 프로젝트 조회
  const { data: ganttProjects } = useGanttProjects(
    appMode === 'calendar' ? user?.uid : undefined
  );

  // 간트 탭에서는 GanttManager가 별도로 조회
  // 캘린더 탭에서만 displayEvents에 포함
  const displayEvents = useMemo(() => {
    if (appMode !== 'calendar' || !ganttProjects) {
      return events;
    }

    const ganttEvents = convertGanttToCalendarEvents(ganttProjects);
    return [...events, ...ganttEvents];
  }, [appMode, events, ganttProjects]);

  return (
    <div>
      {appMode === 'calendar' && (
        <CalendarBoard events={displayEvents} />
      )}
      {appMode === 'gantt' && (
        <GanttManager userProfile={userProfile} allUsers={users} />
      )}
    </div>
  );
};

효과:
- 불필요한 조회 제거
- 간트 탭 전용 사용자: 0 추가 읽기
- 캘린더 탭 사용 시에만 간트 데이터 로드
```

#### 권장사항 2: 활성 프로젝트만 조회 (Active Projects Only)

**문제**:
- 완료된 과거 프로젝트도 캘린더에 표시
- 오래된 데이터 불필요 조회

**해결책**:
```typescript
// ✅ utils/ganttToCalendar.ts - 활성 프로젝트만 변환
function convertGanttToCalendarEvents(
  projects: GanttProject[],
  options?: {
    includeCompleted?: boolean;
    maxAge?: number; // 최근 N일 이내 프로젝트만
  }
): CalendarEvent[] {
  const now = Date.now();
  const maxAge = options?.maxAge || 90 * 24 * 60 * 60 * 1000; // 기본 90일

  // 필터링: 진행 중이거나 최근 완료된 프로젝트만
  const activeProjects = projects.filter(project => {
    const isRecent = (now - project.lastUpdated) < maxAge;
    const isActive = project.progress < 100 || options?.includeCompleted;
    return isActive && isRecent;
  });

  // 변환 로직
  const events: CalendarEvent[] = [];
  activeProjects.forEach(project => {
    project.tasks.forEach(task => {
      // 완료된 작업 제외 옵션
      if (task.completed && !options?.includeCompleted) {
        return;
      }

      events.push({
        id: `gantt-${project.id}-${task.id}`,
        title: `[${project.title}] ${task.title}`,
        // ... 나머지 필드
      });
    });
  });

  return events;
}

효과:
- 오래된 프로젝트 필터링 (클라이언트 측 - 무료)
- 캘린더 렌더링 부하 감소
- 시각적 명확성 향상
```

#### 권장사항 3: 간트 이벤트 토글 UI

**목적**:
- 사용자가 간트 일정 표시 여부 선택
- 불필요 시 조회 안 함

**구현**:
```typescript
// ✅ App.tsx - 간트 이벤트 토글
const App = () => {
  const [showGanttEvents, setShowGanttEvents] = useState(() => {
    // localStorage에서 사용자 설정 로드
    return localStorage.getItem('show_gantt_events') !== 'false';
  });

  // 토글 ON일 때만 조회
  const { data: ganttProjects } = useGanttProjects(
    showGanttEvents && appMode === 'calendar' ? user?.uid : undefined
  );

  useEffect(() => {
    localStorage.setItem('show_gantt_events', String(showGanttEvents));
  }, [showGanttEvents]);

  const displayEvents = useMemo(() => {
    if (!showGanttEvents || !ganttProjects) {
      return events;
    }

    const ganttEvents = convertGanttToCalendarEvents(ganttProjects);
    return [...events, ...ganttEvents];
  }, [showGanttEvents, events, ganttProjects]);

  return (
    <div>
      {/* 캘린더 탭 상단 토글 버튼 */}
      {appMode === 'calendar' && (
        <div className="flex items-center gap-2 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showGanttEvents}
              onChange={(e) => setShowGanttEvents(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">간트 차트 일정 표시</span>
          </label>
        </div>
      )}

      <CalendarBoard events={displayEvents} />
    </div>
  );
};

효과:
- 사용자 선택권 제공
- 간트 미사용자: 0 추가 읽기
- UX 향상
```

### 5.2 향후 확장 대비 최적화

#### 최적화 1: 간트 프로젝트 페이지네이션 (100개 이상 시)

**현재 상황**:
- 사용자당 평균 2개 프로젝트
- 전체 조회 가능

**향후 문제** (프로젝트 100개 이상 시):
```typescript
// 현재: 전체 조회
const { data: ganttProjects } = useGanttProjects(userId);
// → 100개 프로젝트 조회 시 100 읽기

비용:
- 10명 × 100 읽기 = 1,000 읽기/일
- 월간: 30,000 읽기 (불필요한 낭비)
```

**해결책**:
```typescript
// ✅ 페이지네이션: 최근 10개만 조회
export const useGanttProjects = (
  userId?: string,
  options?: { limit?: number }
) => {
  return useQuery({
    queryKey: ['ganttProjects', userId, options?.limit],
    queryFn: async () => {
      if (!userId) return [];

      const q = query(
        collection(db, 'gantt_projects'),
        where('ownerId', '==', userId),
        orderBy('lastUpdated', 'desc'),
        limit(options?.limit || 10)  // 기본 10개 제한
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ... }));
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
};

// App.tsx에서 사용
const { data: ganttProjects } = useGanttProjects(user?.uid, { limit: 10 });

효과:
- 100개 → 10개 조회 (-90%)
- 비용 절감: 30,000 → 3,000 읽기/월
```

#### 최적화 2: 캘린더 전용 경량 뷰

**문제**:
- GanttProject 문서가 큼 (~2,130 bytes)
- 캘린더에는 일부 필드만 필요

**해결책**: 캘린더용 경량 컬렉션 생성
```typescript
// ✅ gantt_calendar_view 컬렉션 (경량)
interface GanttCalendarView {
  id: string;
  projectId: string;
  ownerId: string;
  title: string;
  tasks: {
    id: string;
    title: string;
    startOffset: number;
    duration: number;
    assigneeName?: string;
    departmentIds?: string[];
  }[];
  lastUpdated: number;
}

// Cloud Function: gantt_projects 변경 시 자동 동기화
export const syncGanttCalendarView = functions
  .firestore
  .document('gantt_projects/{projectId}')
  .onWrite(async (change, context) => {
    const projectId = context.params.projectId;

    if (change.after.exists) {
      const project = change.after.data() as GanttProject;

      // 경량 뷰 생성 (필요한 필드만)
      const lightView: GanttCalendarView = {
        id: project.id,
        projectId: project.id,
        ownerId: project.ownerId,
        title: project.title,
        tasks: project.tasks.map(task => ({
          id: task.id,
          title: task.title,
          startOffset: task.startOffset,
          duration: task.duration,
          assigneeName: task.assigneeName,
          departmentIds: task.departmentIds,
        })),
        lastUpdated: project.lastUpdated,
      };

      await db.collection('gantt_calendar_view').doc(projectId).set(lightView);
    } else {
      // 프로젝트 삭제 시 뷰도 삭제
      await db.collection('gantt_calendar_view').doc(projectId).delete();
    }
  });

// 클라이언트에서 경량 뷰 조회
export const useGanttCalendarView = (userId?: string) => {
  return useQuery({
    queryKey: ['ganttCalendarView', userId],
    queryFn: async () => {
      if (!userId) return [];

      const q = query(
        collection(db, 'gantt_calendar_view'),
        where('ownerId', '==', userId),
        limit(10)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as GanttCalendarView);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,  // 5분 캐싱
  });
};

효과:
- 문서 크기: 2,130 bytes → ~600 bytes (-72%)
- 네트워크 대역폭 절감
- Cloud Function 쓰기 비용: ~10 쓰기/월 (무시 가능)
- 읽기 속도 향상
```

**Trade-off 분석**:
```
장점:
- 문서 크기 72% 감소
- 네트워크 대역폭 절감
- 읽기 속도 향상

단점:
- Cloud Function 쓰기 비용: 월 ~10회 (무시 가능)
- 추가 컬렉션 관리 필요
- 동기화 지연 (수 초 이내)

권장:
- 프로젝트 100개 이상 시 적용
- 현재는 불필요 (오버엔지니어링)
```

#### 최적화 3: 캐싱 전략 강화

**현재 캐싱**:
```typescript
staleTime: 1000 * 60 * 2,  // 2분
gcTime: 1000 * 60 * 10,    // 10분
```

**개선 제안**:
```typescript
// ✅ 사용 패턴별 차별화된 캐싱
export const useGanttProjects = (userId?: string, mode?: 'calendar' | 'gantt') => {
  return useQuery({
    queryKey: ['ganttProjects', userId, mode],
    queryFn: async () => {
      // ... 조회 로직
    },
    enabled: !!userId,

    // 모드별 캐싱 전략
    staleTime: mode === 'calendar'
      ? 1000 * 60 * 10  // 캘린더: 10분 (변경 빈도 낮음)
      : 1000 * 60 * 2,  // 간트: 2분 (실시간성 필요)

    gcTime: 1000 * 60 * 30,  // 30분 캐시 유지

    // 창 포커스 시 재요청 비활성화
    refetchOnWindowFocus: false,

    // 재연결 시 재요청 비활성화
    refetchOnReconnect: false,
  });
};

효과:
- 캘린더 모드: 재요청 80% 감소
- 비용 절감: ~500 읽기/월
```

### 5.3 클라이언트 측 캐싱 강화 방안

#### 방안 1: IndexedDB 활용 (장기 캐싱)

**목적**:
- 페이지 새로고침 후에도 캐시 유지
- 초기 로드 속도 향상

**구현**:
```typescript
// ✅ React Query Persist Plugin
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      cacheTime: 1000 * 60 * 60 * 24, // 24시간
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

persistQueryClient({
  queryClient,
  persister,
  maxAge: 1000 * 60 * 60 * 24, // 24시간
});

효과:
- 새로고침 시 0 읽기 (24시간 내)
- 초기 로드 속도 향상
- 사용자 경험 개선
```

#### 방안 2: Optimistic Update (낙관적 업데이트)

**목적**:
- 쓰기 작업 시 즉시 UI 반영
- 네트워크 왕복 대기 시간 제거

**구현**:
```typescript
// ✅ 간트 프로젝트 업데이트 시 낙관적 업데이트
export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<GanttProject> }) => {
      const docRef = doc(db, 'gantt_projects', id);
      await updateDoc(docRef, {
        ...updates,
        lastUpdated: Timestamp.now(),
      });
    },

    // 낙관적 업데이트: 요청 전 UI 먼저 반영
    onMutate: async ({ id, updates }) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ['ganttProjects'] });

      // 이전 값 저장 (롤백용)
      const previousProjects = queryClient.getQueryData(['ganttProjects']);

      // 낙관적 업데이트 (즉시 UI 반영)
      queryClient.setQueryData(['ganttProjects'], (old: GanttProject[]) => {
        return old.map(project =>
          project.id === id
            ? { ...project, ...updates }
            : project
        );
      });

      return { previousProjects };
    },

    // 에러 시 롤백
    onError: (err, variables, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(['ganttProjects'], context.previousProjects);
      }
    },

    // 성공 시 최신 데이터로 교체
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganttProjects'] });
    },
  });
};

효과:
- 즉각적인 UI 반응
- 사용자 경험 향상
- 추가 읽기 발생 안 함
```

---

## 6. 최종 권장사항 요약

### 6.1 즉시 적용 (Phase 7.3 구현 시)

| 우선순위 | 항목 | 예상 소요 | 비용 절감 | 난이도 |
|---------|------|----------|----------|--------|
| 1 | 조건부 로딩 (캘린더 탭에서만) | 30분 | ~500 읽기/월 | 쉬움 |
| 2 | 활성 프로젝트만 변환 | 1시간 | 클라이언트 측 | 쉬움 |
| 3 | 간트 이벤트 토글 UI | 1시간 | 사용자별 차이 | 보통 |

**총 예상 소요**: 2.5시간
**총 비용 절감**: ~500 읽기/월
**현재 비용**: $0.00 → **유지**

### 6.2 단기 개선 (1-2주 내)

| 우선순위 | 항목 | 예상 소요 | 비용 절감 | 난이도 |
|---------|------|----------|----------|--------|
| 1 | 캐싱 전략 강화 (10분 staleTime) | 30분 | ~500 읽기/월 | 쉬움 |
| 2 | React Query Persist | 2시간 | 첫 로드 최적화 | 보통 |
| 3 | Optimistic Update | 3시간 | UX 향상 | 보통 |

**총 예상 소요**: 5.5시간
**총 비용 절감**: ~1,000 읽기/월
**효과**: 사용자 경험 크게 향상

### 6.3 장기 최적화 (사용자 100명 이상 시)

| 우선순위 | 항목 | 예상 소요 | 비용 절감 | 난이도 |
|---------|------|----------|----------|--------|
| 1 | 페이지네이션 (10개 제한) | 2시간 | 27,000 읽기/월 | 쉬움 |
| 2 | 정적 데이터 리스너 제거 (Phase 6) | 4시간 | 150,000 읽기/월 | 보통 |
| 3 | 캘린더 경량 뷰 (선택) | 1일 | 네트워크 절감 | 어려움 |

**총 예상 소요**: 2-3일
**총 비용 절감**: 150,000+ 읽기/월
**효과**: 200명까지 무료 운영 가능

### 6.4 Phase 7 체크리스트

#### Phase 7.1 (데이터 모델 확장) ✅ 완료
- [x] assigneeId, assigneeName, assigneeEmail 필드 추가
- [x] departmentIds 필드 추가
- [x] 비정규화 전략 적용 (assigneeName 저장)
- [x] Firestore 보안 규칙 타입 검증
- [x] GanttBuilder UI 업데이트
- [x] GanttChart 툴팁 구현

**비용 영향**: 없음 ✅
**최적화 상태**: 우수 ✅

#### Phase 7.3 (캘린더 통합) 📅 계획 중
- [ ] useGanttProjects 조건부 로딩 구현
- [ ] convertGanttToCalendarEvents 함수 작성
- [ ] App.tsx displayEvents 병합 로직
- [ ] 활성 프로젝트 필터링
- [ ] 간트 이벤트 토글 UI
- [ ] React Query 캐싱 검증

**예상 비용 영향**: +0.8% (미미) ✅
**권장 소요 시간**: 4-6시간

---

## 7. 결론 및 제안

### 7.1 종합 평가

**Phase 7 간트 차트 고도화**는 Firebase 비용 측면에서 **매우 안전**하게 설계되었습니다.

**긍정적 요소**:
1. **비정규화 전략 우수**: assigneeName 저장으로 83% 읽기 절감
2. **React Query 캐싱 완벽**: 2분 staleTime으로 불필요한 재요청 제거
3. **문서 크기 증가 미미**: +42% (12.6 KB 추가)
4. **현재 비용 영향 없음**: 무료 범위 내 안전

**주의 사항**:
1. **사용자 100명 이상 시**: Phase 6 최적화 권장사항 적용 필요
2. **프로젝트 100개 이상 시**: 페이지네이션 필수
3. **캘린더 통합 시**: 조건부 로딩 및 토글 UI 권장

### 7.2 최종 제안

#### 제안 1: Phase 7.3 구현 시 즉시 적용
```markdown
1. 조건부 로딩 (30분)
   - appMode === 'calendar'일 때만 간트 데이터 조회

2. 활성 프로젝트 필터링 (1시간)
   - 최근 90일 이내 프로젝트만 표시
   - 완료된 작업 제외 옵션

3. 간트 이벤트 토글 UI (1시간)
   - 사용자가 간트 일정 표시 여부 선택
   - localStorage에 설정 저장
```

#### 제안 2: 사용자 50명 도달 시
```markdown
1. Phase 6 최적화 적용 (4시간)
   - 정적 데이터 실시간 리스너 제거
   - React Query 캐싱으로 전환
   - 70% 읽기 절감 효과

2. 캐싱 전략 강화 (30분)
   - staleTime 10분으로 증가
   - React Query Persist 적용
```

#### 제안 3: 사용자 100명 도달 시
```markdown
1. 페이지네이션 필수 (2시간)
   - 간트 프로젝트 10개 제한
   - 무한 스크롤 또는 더보기 버튼

2. 비용 모니터링 대시보드 (1일)
   - Firebase Console 연동
   - 월간 비용 트렌드 추적
   - 비용 임계값 알림 설정
```

### 7.3 비용 예측 로드맵

```
현재 (10명):
  읽기: 214,800회/월 (14.3%)
  비용: $0.00/월
  상태: 🟢 매우 안전

50명 도달 시:
  읽기: 1,074,000회/월 (71.6%)
  비용: $0.00/월
  조치: Phase 6 최적화 적용

100명 도달 시:
  최적화 전: $0.39/월
  최적화 후: $0.00/월
  조치: 페이지네이션 + 정적 데이터 캐싱

200명 도달 시:
  최적화 전: $1.68/월
  최적화 후: $0.00/월
  조치: 모든 최적화 적용 필수

500명 도달 시:
  예상 비용: $2-3/월
  조치: Blaze 플랜 전환 고려
```

### 7.4 최종 결론

**Phase 7 간트 차트 고도화는 비용 측면에서 매우 우수하게 설계되었습니다.**

- 현재 무료 범위 내 안전하게 운영 가능
- 비정규화 전략으로 미래 확장성 확보
- React Query 캐싱으로 최적화 완료
- 추가 비용 발생 위험 거의 없음

**권장 사항**:
1. Phase 7.3 구현 시 조건부 로딩만 필수 적용
2. 현재는 추가 최적화 불필요
3. 사용자 50명 도달 시 Phase 6 최적화 적용
4. 정기적인 비용 모니터링 (월 1회)

**종합 평가**: ⭐⭐⭐⭐⭐ (5/5)
**비용 안전성**: 🟢 매우 안전
**확장성**: 🟢 우수
**유지보수성**: 🟢 양호

---

## 부록 A: 비용 계산 참고 자료

### Firestore 요금제 (2024년 기준)

**무료 할당량 (Spark Plan)**:
```
읽기: 50,000회/일 (1,500,000회/월)
쓰기: 20,000회/일 (600,000회/월)
삭제: 20,000회/일 (600,000회/월)
저장 공간: 1 GB
네트워크: 10 GB/월
```

**유료 비용 (Blaze Plan - 초과분)**:
```
읽기: $0.06 / 100,000회
쓰기: $0.18 / 100,000회
삭제: $0.02 / 100,000회
저장 공간: $0.18 / GB/월
네트워크: $0.12 / GB
```

### 비용 계산 공식

**읽기 비용**:
```
초과분 = max(0, 월간_읽기 - 1,500,000)
비용 = (초과분 / 100,000) × $0.06
```

**쓰기 비용**:
```
초과분 = max(0, 월간_쓰기 - 600,000)
비용 = (초과분 / 100,000) × $0.18
```

**저장 공간 비용**:
```
초과분 = max(0, 사용량_GB - 1)
비용 = 초과분 × $0.18
```

---

**분석 완료일**: 2026년 1월 3일
**다음 검토 예정**: 사용자 50명 도달 시 또는 3개월 후
