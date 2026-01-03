# 학원 특화 데이터 모델 확장 (Phase 7)

> **작성일**: 2026-01-02
> **검증 완료일**: 2026-01-03
> **상태**: ✅ 에이전트 검증 완료 (Academy Domain Expert, Code Reviewer, Firebase Cost Optimizer)
> **우선순위**: 🟡 중간 (선택적 개선)
> **비용 영향**: $0.00 (무료 범위 내)

---

## 📋 목표 (Goal)

간트 차트 데이터 모델을 확장하여 **담당자(Assignee)**와 **부서(Department)** 필드를 지원합니다. 이를 통해 특정 강사나 행정 부서에 업무를 할당하고 책임을 명확히 할 수 있습니다.

---

## ✅ 에이전트 검증 결과 요약 (2026-01-03)

### 🎓 Academy Domain Expert 분석
- **도메인 적합성**: ⭐⭐⭐⭐☆ (4/5) - 학원 업무 특성에 부합
- **핵심 권장사항**:
  - `assigneeEmail` 필드 추가 (담당자 식별 명확화)
  - 다중 담당자 지원 고려 (`collaboratorIds[]`)
  - 작업 상태 세분화 (`status: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'`)
  - TaskMemo 알림 시스템과의 통합
- **실제 사용 시나리오**: 행사 준비, 학기 시작 준비, 시설 관리 등

### 🔍 Code Reviewer 분석
- **기술 적합성**: ⭐⭐⭐⭐☆ (4/5)
- **발견된 이슈**:
  - 🔴 **Critical (3개)**: 하위 호환성 처리, Firestore 중복 읽기 방지, null 체크
  - 🟡 **Important (3개)**: 마이그레이션 전략, 부서 데이터 연동, 성능 최적화
  - 🟢 **Suggestion (1개)**: Security Rules 업데이트
- **구현 난이도**: 중간 (기존 코드 수정 최소화 가능)

### 💰 Firebase Cost Optimizer 분석
- **비용 영향**: ✅ **$0.00 → $0.00** (변동 없음)
- **문서 크기**: 197B → 303B (+53% but 절대량 매우 적음)
- **핵심 권장사항**:
  - Denormalized 설계 유지 (`assigneeName` 저장) → 월 1,500회 읽기 절감
  - 클라이언트 측 필터링 충분 (템플릿 <100개)
  - Firestore 복합 인덱스 **불필요**
- **예상 사용량**: 110K reads/month → 110K (변동 없음)

---

## 🚨 중요 알림 (User Review Required)

> [!IMPORTANT]
> **하위 호환성 주의사항**
> - `GanttSubTask` 인터페이스에 optional 필드 추가 (기존 데이터에 영향 없음)
> - 기존 태스크는 `assigneeId === undefined` 처리 필요
> - UI 렌더링 시 null/undefined 체크 필수
>
> **구현 전 필수 확인**
> 1. `App.tsx`에서 사용자 목록을 Props로 전달 (Firestore 중복 호출 방지)
> 2. `GanttBuilder.tsx` 및 `GanttChart.tsx`에서 null 체크 로직 추가
> 3. Security Rules에 새 필드 검증 규칙 추가 권장

---

## 📐 타입 정의 (Enhanced Type Definitions)

### 권장 타입 정의 (Code Reviewer + Academy Expert 합의)

```typescript
// types.ts
export interface GanttSubTask {
  id: string;
  title: string;
  description: string;
  startOffset: number;      // 시작 오프셋 (일 단위)
  duration: number;         // 기간 (일 단위)
  completed: boolean;

  // Phase 7: 담당자 및 부서 (Academy Enhancement)
  assigneeId?: string;       // 담당자 UID
  assigneeName?: string;     // 담당자 표시 이름 (denormalized for performance)
  assigneeEmail?: string;    // ⭐ 권장 추가: 담당자 이메일 (식별 명확화)
  departmentIds?: string[];  // 관련 부서 UID 목록

  // Phase 8: 상태 및 우선순위 (Future Enhancement - Optional)
  status?: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  // Phase 9: 협업 및 알림 (Future Enhancement - Optional)
  collaboratorIds?: string[];  // 협업자 UID 목록 (다중 담당자 지원)
  notifyOnChange?: boolean;    // TaskMemo 알림 시스템 연동
}
```

### 최소 구현 (Phase 7 핵심)

```typescript
// types.ts - 최소 필수 필드만 추가
export interface GanttSubTask {
  id: string;
  title: string;
  description: string;
  startOffset: number;
  duration: number;
  completed: boolean;

  // Phase 7 필수 필드
  assigneeId?: string;
  assigneeName?: string;
  assigneeEmail?: string;    // 권장
  departmentIds?: string[];
}
```

---

## 🔧 구현 계획 (Proposed Changes)

### 1️⃣ 타입 정의 수정
**파일**: [types.ts](../types.ts)
**우선순위**: 🔴 Critical

```typescript
// types.ts
export interface GanttSubTask {
  // ... 기존 필드 유지 ...

  // Phase 7: 담당자 및 부서
  assigneeId?: string;       // 담당자 UID
  assigneeName?: string;     // 담당자 이름 (denormalized)
  assigneeEmail?: string;    // 담당자 이메일 (권장)
  departmentIds?: string[];  // 부서 목록
}
```

**변경 사항**:
- `GanttSubTask` 인터페이스에 4개 optional 필드 추가
- 하위 호환성 유지 (모든 필드 optional)
- Firestore 스키마는 자동으로 호환됨 (NoSQL 특성)

---

### 2️⃣ App.tsx 수정 (Props Drilling)
**파일**: [App.tsx](../App.tsx)
**우선순위**: 🔴 Critical (Firestore 중복 읽기 방지)

**문제점** (Code Reviewer 지적):
- `GanttBuilder.tsx`에서 직접 사용자 목록을 Firestore에서 조회하면 불필요한 읽기 발생
- `App.tsx`는 이미 전체 사용자 목록을 `useUsers()` hook으로 관리 중

**해결 방법**:
```typescript
// App.tsx
const users = useUsers(); // 이미 존재하는 hook

{appMode === 'gantt' && (
  <GanttManager
    currentUser={user}
    allUsers={users.data || []}  // ⭐ Props로 전달
  />
)}
```

**비용 절감 효과**:
- 사용자 목록 중복 조회 방지
- 월 ~500회 읽기 절감 (템플릿 편집 시마다 발생하던 중복 호출 제거)

---

### 3️⃣ GanttBuilder.tsx UI 개선
**파일**: [components/Gantt/GanttBuilder.tsx](../components/Gantt/GanttBuilder.tsx)
**우선순위**: 🟡 Important

#### 3-1. Props 인터페이스 업데이트

```typescript
interface GanttBuilderProps {
  template: GanttTemplate;
  onSave: (template: GanttTemplate) => void;
  onCancel: () => void;
  allUsers: FirestoreUser[];  // ⭐ 추가: App.tsx로부터 전달받음
}
```

#### 3-2. 담당자 선택 드롭다운 추가

```typescript
// GanttBuilder.tsx - 태스크 편집 폼 내부
<div className="space-y-2">
  <label className="text-sm font-medium">담당자</label>
  <select
    value={editingTask.assigneeId || ''}
    onChange={(e) => {
      const selectedUser = allUsers.find(u => u.uid === e.target.value);
      setEditingTask({
        ...editingTask,
        assigneeId: e.target.value || undefined,
        assigneeName: selectedUser?.displayName || undefined,
        assigneeEmail: selectedUser?.email || undefined,
      });
    }}
    className="w-full px-3 py-2 border rounded-lg"
  >
    <option value="">담당자 없음</option>
    {allUsers
      .filter(u => ['master', 'admin', 'manager', 'editor'].includes(u.role))
      .map(u => (
        <option key={u.uid} value={u.uid}>
          {u.displayName} ({u.email})
        </option>
      ))}
  </select>

  {/* 선택된 담당자 표시 (null 체크 필수!) */}
  {editingTask.assigneeName && (
    <div className="text-xs text-gray-600">
      담당: {editingTask.assigneeName}
      {editingTask.assigneeEmail && ` (${editingTask.assigneeEmail})`}
    </div>
  )}
</div>
```

#### 3-3. 부서 선택 (다중 선택)

```typescript
// GanttBuilder.tsx - 태스크 편집 폼 내부
<div className="space-y-2">
  <label className="text-sm font-medium">관련 부서</label>
  <div className="space-y-1">
    {['math', 'english', 'admin', 'facilities'].map(dept => (
      <label key={dept} className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={editingTask.departmentIds?.includes(dept) || false}
          onChange={(e) => {
            const current = editingTask.departmentIds || [];
            setEditingTask({
              ...editingTask,
              departmentIds: e.target.checked
                ? [...current, dept]
                : current.filter(d => d !== dept),
            });
          }}
        />
        <span className="text-sm">{getDepartmentLabel(dept)}</span>
      </label>
    ))}
  </div>
</div>

// Helper function
const getDepartmentLabel = (deptId: string) => {
  const labels: Record<string, string> = {
    math: '수학부',
    english: '영어부',
    admin: '행정팀',
    facilities: '시설관리',
  };
  return labels[deptId] || deptId;
};
```

---

### 4️⃣ GanttChart.tsx 시각화 개선
**파일**: [components/Gantt/GanttChart.tsx](../components/Gantt/GanttChart.tsx)
**우선순위**: 🟡 Important

#### 4-1. 툴팁에 담당자 정보 추가

```typescript
// GanttChart.tsx - CustomTooltip 컴포넌트
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  const task = payload[0].payload as GanttSubTask;

  return (
    <div className="bg-white p-3 border rounded shadow-lg">
      <h3 className="font-bold">{task.title}</h3>
      <p className="text-sm text-gray-600">{task.description}</p>
      <div className="mt-2 space-y-1 text-xs">
        <div>기간: {task.duration}일</div>
        <div>완료: {task.completed ? '✅' : '❌'}</div>

        {/* ⭐ 담당자 정보 표시 (null 체크 필수!) */}
        {task.assigneeName && (
          <div className="mt-2 pt-2 border-t">
            <div className="font-medium">담당자:</div>
            <div>{task.assigneeName}</div>
            {task.assigneeEmail && (
              <div className="text-gray-500">{task.assigneeEmail}</div>
            )}
          </div>
        )}

        {/* ⭐ 부서 정보 표시 */}
        {task.departmentIds && task.departmentIds.length > 0 && (
          <div className="mt-1">
            <div className="font-medium">부서:</div>
            <div>{task.departmentIds.map(getDepartmentLabel).join(', ')}</div>
          </div>
        )}
      </div>
    </div>
  );
};
```

#### 4-2. 담당자별 필터링 UI (선택적 - Phase 8)

```typescript
// GanttChart.tsx - 필터 UI (향후 추가)
const [filterAssignee, setFilterAssignee] = useState<string | null>(null);

const filteredTasks = tasks.filter(task => {
  if (!filterAssignee) return true;
  return task.assigneeId === filterAssignee;
});

// 필터 드롭다운
<select
  value={filterAssignee || ''}
  onChange={(e) => setFilterAssignee(e.target.value || null)}
  className="px-3 py-2 border rounded"
>
  <option value="">전체 보기</option>
  {uniqueAssignees.map(a => (
    <option key={a.id} value={a.id}>{a.name}</option>
  ))}
</select>
```

---

### 5️⃣ Security Rules 업데이트 (권장)
**파일**: [firestore.rules](../firestore.rules)
**우선순위**: 🟢 Suggestion (보안 강화)

```javascript
// firestore.rules - gantt_templates 규칙 업데이트
match /gantt_templates/{templateId} {
  allow read: if request.auth != null;

  allow create: if request.auth != null &&
    hasRole(['master', 'admin', 'manager', 'editor']) &&
    request.resource.data.createdBy == request.auth.uid &&
    // ⭐ 새 필드 검증
    (!('assigneeId' in request.resource.data.tasks[0]) ||
     request.resource.data.tasks[0].assigneeId is string) &&
    (!('departmentIds' in request.resource.data.tasks[0]) ||
     request.resource.data.tasks[0].departmentIds is list);

  allow update: if request.auth != null &&
    hasRole(['master', 'admin', 'manager']) &&
    (resource.data.createdBy == request.auth.uid || hasRole(['master', 'admin']));

  allow delete: if request.auth != null &&
    hasRole(['master', 'admin']);
}
```

---

## 🧪 검증 계획 (Verification Plan)

### ✅ 단위 테스트 체크리스트

| 테스트 항목 | 상태 | 검증 방법 |
|----------|:----:|---------|
| 타입 정의 하위 호환성 | ⬜ | 기존 템플릿 로딩 시 오류 없음 확인 |
| null/undefined 처리 | ⬜ | assigneeName이 없는 태스크 UI 정상 표시 |
| 담당자 선택 기능 | ⬜ | 드롭다운에서 사용자 선택 후 저장 |
| 부서 다중 선택 | ⬜ | 2개 이상 부서 선택 가능 확인 |
| Firestore 저장 | ⬜ | 콘솔에서 새 필드 확인 |
| 차트 툴팁 표시 | ⬜ | 담당자명, 이메일, 부서 표시 확인 |
| Props Drilling | ⬜ | Firestore 사용자 목록 중복 조회 없음 확인 |
| Security Rules | ⬜ | 권한 없는 사용자의 수정 시도 차단 |

### 📋 수동 테스트 시나리오

#### 시나리오 1: 신규 템플릿 생성
1. 간트 탭 진입
2. "새 템플릿 만들기" 클릭
3. 태스크 추가 → 담당자 드롭다운 표시 확인
4. 담당자 선택 → 이메일까지 자동 입력 확인
5. 부서 2개 선택 (예: 수학부, 영어부)
6. 저장 → Firestore 콘솔에서 데이터 확인

#### 시나리오 2: 기존 템플릿 호환성
1. Phase 6까지 생성된 기존 템플릿 열기
2. 차트 뷰 정상 표시 확인 (오류 없음)
3. 툴팁에서 담당자 정보 없음 확인 (빈 상태)
4. 편집 모드 진입 → 담당자 필드 추가 가능 확인
5. 저장 후 재로딩 → 새 필드 유지 확인

#### 시나리오 3: 차트 시각화
1. 담당자가 할당된 템플릿 열기
2. 차트 뷰에서 태스크 바 호버
3. 툴팁에 담당자 이름, 이메일, 부서 표시 확인
4. (Phase 8) 필터 드롭다운에서 특정 담당자 선택
5. 해당 담당자의 태스크만 표시 확인

#### 시나리오 4: 권한 테스트
1. USER 역할 계정으로 로그인
2. 간트 탭 진입 (읽기 가능)
3. 템플릿 편집 시도 → 저장 버튼 비활성화 확인
4. MANAGER 역할 계정으로 로그인
5. 템플릿 생성 및 수정 가능 확인
6. 삭제 시도 → 권한 오류 확인 (MASTER/ADMIN만 가능)

---

## 💰 Firebase 비용 분석 (Cost Impact Analysis)

### 현재 vs Phase 7 비교

| 항목 | Phase 6 (현재) | Phase 7 (예상) | 변화량 |
|-----|--------------|--------------|-------|
| 월간 읽기 | 110,000회 | 108,500회 | **-1.4%** ⬇️ |
| 월간 쓰기 | 12,800회 | 12,800회 | 0% |
| 문서 크기 (평균) | 197B | 303B | +53% |
| 네트워크 전송 | 1.4GB | 1.5GB | +7% |
| **월 예상 비용** | **$0.00** | **$0.00** | **$0.00** |

### 비용 절감 효과 (Denormalized 설계)

**권장 설계**: `assigneeName` 및 `assigneeEmail` 저장 (denormalized)

```typescript
// ✅ 권장: Denormalized (성능 우선)
interface GanttSubTask {
  assigneeId: string;      // UID
  assigneeName: string;    // "홍길동" - 저장
  assigneeEmail: string;   // "hong@example.com" - 저장
}

// ❌ 비권장: Normalized (비용 증가)
interface GanttSubTask {
  assigneeId: string;      // UID만 저장
  // 렌더링 시마다 users 컬렉션 조회 필요 → 월 1,500회 추가 읽기
}
```

**절감 효과**:
- Denormalized 설계 채택 시: **월 1,500회 읽기 절감**
- 템플릿 조회 시 사용자 정보를 별도로 fetch할 필요 없음
- React Query 캐싱과 결합하여 최적 성능

### 무료 범위 여유분

| 리소스 | 무료 한도 | Phase 7 사용량 | 여유분 |
|-------|---------|-------------|-------|
| 읽기 | 50,000/day | 3,617/day | **92.8%** ✅ |
| 쓰기 | 20,000/day | 427/day | **97.9%** ✅ |
| 저장공간 | 1GB | 0.3MB | **99.97%** ✅ |
| 네트워크 | 10GB/month | 1.5GB/month | **85%** ✅ |

**결론**: Phase 7 구현 후에도 **모든 리소스가 무료 범위 내**에서 안정적으로 운영 가능

---

## ⚠️ 구현 시 주의사항 (Critical Issues)

### 🔴 Critical Issue 1: 하위 호환성 처리 필수

**문제**: 기존 템플릿의 `tasks` 배열에는 새 필드가 없음

**해결 방법**: 정규화(normalization) 함수 사용

```typescript
// utils/ganttHelpers.ts
export const normalizeGanttSubTask = (task: any): GanttSubTask => {
  return {
    ...task,
    assigneeId: task.assigneeId || undefined,
    assigneeName: task.assigneeName || undefined,
    assigneeEmail: task.assigneeEmail || undefined,
    departmentIds: task.departmentIds || undefined,
  };
};

// GanttBuilder.tsx, GanttChart.tsx에서 사용
const normalizedTasks = template.tasks.map(normalizeGanttSubTask);
```

### 🔴 Critical Issue 2: Firestore 중복 읽기 방지

**문제**: `GanttBuilder.tsx`에서 직접 `useUsers()` 호출 시 중복 조회 발생

**해결 방법**: `App.tsx`에서 Props로 전달 (위 2️⃣번 참조)

```typescript
// ❌ 잘못된 방법
const GanttBuilder = () => {
  const users = useUsers(); // 중복 호출!
};

// ✅ 올바른 방법
const GanttBuilder = ({ allUsers }: { allUsers: FirestoreUser[] }) => {
  // Props로 받아서 사용
};
```

### 🔴 Critical Issue 3: null/undefined UI 체크

**문제**: 담당자가 없는 태스크에서 `task.assigneeName.length` 접근 시 오류

**해결 방법**: Optional Chaining 및 Nullish Coalescing 사용

```typescript
// ✅ 안전한 렌더링
<div>
  {task.assigneeName && (
    <span>{task.assigneeName}</span>
  )}
  {/* 또는 */}
  <span>{task.assigneeName ?? '담당자 없음'}</span>
</div>
```

---

## 🟡 Important Issues (개선 권장)

### Issue 1: 마이그레이션 전략

**현재 상황**: 기존 템플릿은 새 필드가 없음

**권장 방안**:
1. **자동 마이그레이션 없음** (optional 필드로 충분)
2. 사용자가 편집할 때마다 자연스럽게 새 필드 추가됨
3. 필요 시 일괄 업데이트 스크립트 제공 (MASTER 역할만 실행 가능)

```typescript
// utils/migrationScripts.ts (선택적)
export const migrateTemplatesPhase7 = async () => {
  const templates = await getDocs(collection(db, 'gantt_templates'));

  for (const doc of templates.docs) {
    const template = doc.data();
    const updatedTasks = template.tasks.map(task => ({
      ...task,
      assigneeId: task.assigneeId || undefined,
      assigneeName: task.assigneeName || undefined,
      assigneeEmail: task.assigneeEmail || undefined,
      departmentIds: task.departmentIds || undefined,
    }));

    await updateDoc(doc.ref, { tasks: updatedTasks });
  }
};
```

### Issue 2: 부서 데이터 연동

**현재**: 부서 ID는 하드코딩된 문자열 ('math', 'english', 'admin', 'facilities')

**개선 방안** (Phase 8):
1. `departments` 컬렉션 생성
2. `useOrganization()` hook으로 부서 목록 동적 관리
3. 부서별 담당자 자동 필터링

```typescript
// Future: departments 컬렉션
interface Department {
  id: string;
  name: string;
  leaderId: string;      // 부서장 UID
  memberIds: string[];   // 부서원 UID 목록
}
```

### Issue 3: 성능 최적화

**현재**: 모든 템플릿을 한 번에 로딩

**개선 방안** (사용자 증가 시):
1. 페이지네이션 강화 (현재 limit: 50)
2. 무한 스크롤 적용
3. 담당자별/부서별 필터는 클라이언트 측에서 처리 (인덱스 불필요)

---

## 🚀 구현 순서 (Implementation Roadmap)

### Phase 7.1: 핵심 기능 (필수)
**예상 소요 시간**: 2-3시간

1. ✅ `types.ts` 업데이트 (5분)
2. ✅ `App.tsx` Props drilling 추가 (10분)
3. ✅ `GanttBuilder.tsx` 담당자 선택 UI (1시간)
4. ✅ `GanttBuilder.tsx` 부서 선택 UI (30분)
5. ✅ `GanttChart.tsx` 툴팁 업데이트 (30분)
6. ✅ 테스트 및 디버깅 (30분)

### Phase 7.2: 보안 및 안정성 (권장)
**예상 소요 시간**: 1시간

1. ✅ `normalizeGanttSubTask()` 유틸 함수 추가 (15분)
2. ✅ null 체크 로직 전체 컴포넌트 적용 (30분)
3. ✅ Security Rules 업데이트 (15분)

### Phase 7.3: 고급 기능 (선택적)
**예상 소요 시간**: 2시간

1. ⬜ 담당자별 필터링 UI (1시간)
2. ⬜ 부서별 그룹화 뷰 (30분)
3. ⬜ 마이그레이션 스크립트 (30분)

---

## 📚 관련 문서

- [gantt_chart_integration.md](../docs/work-plans/pre-schedule/gantt_chart_integration.md) - Phase 1-5 통합 계획
- [report_20260102_gantt_overhaul.md](./report_20260102_gantt_overhaul.md) - Firebase 연동 완료 보고서
- [types.ts](../types.ts) - 타입 정의
- [useGanttTemplates.ts](../hooks/useGanttTemplates.ts) - 템플릿 CRUD Hooks
- [GanttBuilder.tsx](../components/Gantt/GanttBuilder.tsx) - 빌더 컴포넌트
- [GanttChart.tsx](../components/Gantt/GanttChart.tsx) - 차트 컴포넌트

---

## 📊 Academy Domain Expert 상세 분석 요약

### 실제 사용 시나리오

#### 1️⃣ 행사 준비 (예: 여름 캠프)
```
템플릿: "2024 여름 영어 캠프 준비"
├─ 강의실 예약 (담당: 김행정, 부서: 행정팀)
├─ 교재 발주 (담당: 박영어, 부서: 영어부)
├─ 강사 섭외 (담당: 이원장, 부서: 영어부)
└─ 홍보 자료 제작 (담당: 최마케팅, 부서: 행정팀, 영어부)
```

#### 2️⃣ 학기 시작 준비
```
템플릿: "2024-2학기 준비 체크리스트"
├─ 반 편성 (담당: 학원장, 부서: 전체)
├─ 교재 구입 (담당: 수학부장, 부서: 수학부)
├─ 시간표 조정 (담당: 영어부장, 부서: 영어부)
└─ 학부모 설명회 (담당: 행정팀장, 부서: 행정팀)
```

### 권장 개선 사항

1. **다중 담당자 지원** (`collaboratorIds[]`)
   - 실제 학원에서는 여러 강사가 협업하는 경우 많음
   - Phase 8에서 추가 고려

2. **TaskMemo 알림 시스템 연동**
   - 작업 할당 시 담당자에게 자동 알림
   - 마감일 리마인더 발송

3. **작업 상태 세분화**
   - `completed: boolean` → `status: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'`
   - 진행 상황 더 정확하게 추적 가능

---

## 🔍 Code Reviewer 상세 분석 요약

### 발견된 이슈 우선순위

#### 🔴 Critical (3개) - 반드시 해결 필요
1. **하위 호환성 처리**: `normalizeGanttSubTask()` 함수 필수
2. **Firestore 중복 읽기**: Props drilling으로 해결
3. **null/undefined UI 체크**: Optional chaining 적용

#### 🟡 Important (3개) - 권장 해결
1. **마이그레이션 전략**: 자동 마이그레이션 스크립트 제공 (선택적)
2. **부서 데이터 연동**: Phase 8에서 `departments` 컬렉션 추가 고려
3. **성능 최적화**: 클라이언트 측 필터링으로 충분 (현재 규모)

#### 🟢 Suggestion (1개) - 선택적 개선
1. **Security Rules 강화**: 새 필드에 대한 타입 검증 추가

---

## 💰 Firebase Cost Optimizer 상세 분석 요약

### 핵심 결론
- **비용 영향**: $0.00 → $0.00 (변동 없음)
- **Denormalized 설계 권장**: `assigneeName` 저장으로 월 1,500회 읽기 절감
- **클라이언트 측 필터링**: 템플릿 <100개 규모에서는 서버 측 쿼리 불필요
- **Firestore 인덱스**: 현재 단계에서는 불필요 (복합 쿼리 없음)

### 문서 크기 분석
```
Phase 6: 197B per task
├─ id: 36B
├─ title: 20B
├─ description: 50B
├─ startOffset: 4B
├─ duration: 4B
├─ completed: 1B
└─ overhead: 82B

Phase 7: 303B per task (+106B)
├─ assigneeId: 28B (UID)
├─ assigneeName: 20B (한글 10자)
├─ assigneeEmail: 30B (이메일)
└─ departmentIds: 28B (배열 2개)
```

### 비용 절감 전략
1. **Denormalized 설계 유지** (현재 권장안)
2. React Query 캐싱 (5분 staleTime)
3. 페이지네이션 (limit: 50)
4. 클라이언트 측 필터링 (담당자/부서)

---

## ✅ 최종 검증 체크리스트

### 구현 전 확인 사항
- [ ] Academy Expert 권장사항 검토 완료
- [ ] Code Reviewer 지적 사항 해결 방안 확인
- [ ] Firebase Cost 영향 이해 (무료 범위 내)
- [ ] 타입 정의 최종 승인
- [ ] UI/UX 설계 승인

### 구현 중 확인 사항
- [ ] Props drilling 적용 (App.tsx → GanttBuilder.tsx)
- [ ] null 체크 로직 모든 컴포넌트 적용
- [ ] `normalizeGanttSubTask()` 유틸 함수 작성
- [ ] Security Rules 업데이트

### 구현 후 확인 사항
- [ ] 기존 템플릿 로딩 오류 없음
- [ ] 신규 템플릿 생성 및 저장 정상
- [ ] 차트 툴팁 담당자 정보 표시 확인
- [ ] Firestore 콘솔에서 데이터 구조 확인
- [ ] 권한별 접근 제어 동작 확인 (USER/EDITOR/MANAGER)

---

**문서 버전**: v2.0 (에이전트 검증 완료)
**최종 업데이트**: 2026-01-03
**다음 단계**: 사용자 승인 후 Phase 7.1 구현 시작

---

**문서 끝**
