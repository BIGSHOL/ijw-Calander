# 📈 테스트 커버리지 증가 계획

**작성일**: 2026-02-07  
**목표**: 전체 커버리지 60% → 80% 달성  
**예상 기간**: 2주 (Phase별 순차 진행)

---

## 📊 현재 상태 분석

### 커버리지 현황 (2026-02-07)

| 영역 | Statements | Branches | Functions | Lines | 상태 |
|------|------------|----------|-----------|-------|------|
| **전체** | 60.63% | 65.31% | 61.61% | 60.98% | ⚠️ |
| `utils/` | 93.13% | 91.16% | 98.96% | 92.5% | ✅ |
| `hooks/` | 47.79% | 41.31% | 44.51% | 49.07% | ⚠️ |
| 루트 파일 | 18.75% | 60.58% | 26.08% | 19.48% | ❌ |

### 테스트 파일 현황

#### 현재 작성된 테스트 (19개)

**utils/ (14개)** ✅
- `attendanceNumberGenerator.test.ts`
- `converters.test.ts`
- `dateUtils.test.ts`
- `encryption.test.ts`
- `formValidation.test.ts`
- `ganttHelpers.test.ts`
- `ganttToCalendar.test.ts`
- `localStorage.test.ts`
- `roleHelpers.test.ts`
- `staffHelpers.test.ts`
- `studentUtils.test.ts`
- `styleUtils.test.ts`
- `teacherUtils.test.ts`
- `testHelpers.tsx`

**hooks/ (5개)** ⚠️
- `useAttendance.test.ts`
- `useClasses.test.ts`
- `useConsultations.test.ts`
- `useGlobalSearch.test.ts`
- `useStudents.test.ts`

**components/ (0개)** ❌
- 테스트 없음

---

## 🎯 목표 커버리지

| 영역 | 현재 | 목표 | 증가량 |
|------|------|------|--------|
| Statements | 60.63% | 80% | +19.37% |
| Branches | 65.31% | 80% | +14.69% |
| Functions | 61.61% | 80% | +18.39% |
| Lines | 60.98% | 80% | +19.02% |

---

## 📅 Phase별 실행 계획

### Phase 1: Hooks 테스트 확장 (47개 추가)
**예상 기간**: 3-4일  
**목표**: hooks 커버리지 48% → 80%

#### 우선순위 1 (핵심 훅) - 15개

| 훅 | 크기 | 복잡도 | 우선순위 |
|----|------|--------|---------|
| `useAuth.ts` | 6KB | 높음 | 🔴 필수 |
| `usePermissions.ts` | 6KB | 높음 | 🔴 필수 |
| `useTabPermissions.ts` | 6KB | 높음 | 🔴 필수 |
| `useStaff.ts` | 8KB | 중간 | 🔴 필수 |
| `useEnrollments.ts` | 10KB | 중간 | 🔴 필수 |
| `useForm.ts` | 4KB | 낮음 | 🟡 권장 |
| `useFocusTrap.ts` | 3KB | 낮음 | 🟡 권장 |
| `useAppState.ts` | 15KB | 높음 | 🟡 권장 |
| `useBilling.ts` | 6KB | 중간 | 🟡 권장 |
| `useExams.ts` | 5KB | 중간 | 🟡 권장 |
| `useStudentGrades.ts` | 7KB | 중간 | 🟡 권장 |
| `useClassDetail.ts` | 8KB | 중간 | 🟡 권장 |
| `useSessionPeriods.ts` | 6KB | 중간 | 🟢 선택 |
| `useRoleHelpers.ts` | 2KB | 낮음 | 🟢 선택 |
| `useTabHistory.ts` | 3KB | 낮음 | 🟢 선택 |

#### 우선순위 2 (데이터 훅) - 16개

| 훅 | 크기 | 설명 |
|----|------|------|
| `useClassMutations.ts` | 22KB | 반 CRUD 작업 |
| `useEventCrud.ts` | 14KB | 이벤트 CRUD |
| `useStudentConsultations.ts` | 13KB | 학생 상담 |
| `useConsultationStats.ts` | 23KB | 상담 통계 |
| `useWithdrawalStats.ts` | 14KB | 퇴원 통계 |
| `useStudentFilters.ts` | 17KB | 학생 필터링 |
| `useGradeProfile.ts` | 17KB | 성적 프로필 |
| `useDailyAttendance.ts` | 10KB | 일일 출석 |
| `useVisibleAttendanceStudents.ts` | 8KB | 출석 학생 표시 |
| `useEmbedData.ts` | 10KB | 임베드 데이터 |
| `useEmbedTokens.ts` | 7KB | 임베드 토큰 |
| `useEnglishClassUpdater.ts` | 34KB | 영어 반 업데이트 |
| `useGanttProjects.ts` | 3KB | 간트 프로젝트 |
| `useGanttTemplates.ts` | 7KB | 간트 템플릿 |
| `useResources.ts` | 4KB | 리소스 |
| `useTaskMemos.ts` | 4KB | 작업 메모 |

#### 우선순위 3 (나머지) - 16개

- `useArchivedEvents.ts`
- `useBatchAttendanceUpdate.ts`
- `useBucketItems.ts`
- `useClassStats.ts`
- `useConsultationDrafts.ts`
- `useConsultationMutations.ts`
- `useExamSeries.ts`
- `useExamsByDate.ts`
- `useFirebaseQueries.ts`
- `useGanttCategories.ts`
- `useGanttDepartments.ts`
- `useGradePromotion.ts`
- `useRoleSimulation.tsx`
- `useStaffLeaves.ts`
- `useStudentBilling.ts`
- `useWithdrawalFilters.ts`

---

### Phase 2: 핵심 컴포넌트 테스트 (신규)
**예상 기간**: 5-7일  
**목표**: 핵심 컴포넌트 80% 커버리지

#### 우선순위 1 (공통 컴포넌트)

| 폴더 | 컴포넌트 수 | 테스트 대상 |
|------|------------|------------|
| `Common/` | 25개 | Modal, Button, Input, Dropdown, Toast 등 |
| `Header/` | 8개 | ProfileDropdown, MemoDropdown, NavBar 등 |
| `Navigation/` | 4개 | Sidebar, TabNavigation |
| `Auth/` | 2개 | LoginModal |

#### 우선순위 2 (기능 컴포넌트)

| 폴더 | 컴포넌트 수 | 테스트 대상 |
|------|------------|------------|
| `StudentManagement/` | 25개 | StudentList, StudentCard, StudentModal |
| `Attendance/` | 17개 | AttendanceTable, AddStudentModal |
| `Dashboard/` | 18개 | KPICard, Charts |

#### 우선순위 3 (복잡한 컴포넌트)

| 폴더 | 컴포넌트 수 | 테스트 대상 |
|------|------------|------------|
| `Timetable/` | 59개 | TimetableGrid, TimetableCell |
| `Calendar/` | 17개 | CalendarBoard, EventCard |
| `Gantt/` | 7개 | GanttChart, ProjectBar |

---

### Phase 3: 통합 테스트
**예상 기간**: 2-3일  
**목표**: 주요 사용자 흐름 테스트

#### 테스트 시나리오

1. **인증 흐름**
   - 로그인 → 권한 확인 → 탭 접근

2. **학생 등록 흐름**
   - 상담 등록 → 재원생 전환 → 반 배정

3. **출석 체크 흐름**
   - 학생 선택 → 출석 체크 → 급여 계산

4. **시간표 수정 흐름**
   - 학생 이동 → 시뮬레이션 → 저장

---

## 🛠️ 테스트 작성 가이드

### 테스트 파일 구조

```
tests/
├── hooks/
│   ├── useAuth.test.ts          # 새로 작성
│   ├── usePermissions.test.ts   # 새로 작성
│   └── ...
├── components/
│   ├── Common/
│   │   ├── Modal.test.tsx       # 새로 작성
│   │   └── Button.test.tsx      # 새로 작성
│   ├── StudentManagement/
│   │   └── StudentCard.test.tsx # 새로 작성
│   └── ...
├── integration/                  # 새 폴더
│   ├── auth-flow.test.ts
│   └── student-registration.test.ts
├── mocks/
│   ├── firebase.ts              # Firebase 모의 객체
│   └── handlers.ts              # API 모의 핸들러
└── setup.ts
```

### Mock 설정 예시

```typescript
// tests/mocks/firebase.ts
export const mockFirestore = {
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
};

export const mockAuth = {
  currentUser: { uid: 'test-uid', email: 'test@example.com' },
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
};
```

### 훅 테스트 템플릿

```typescript
// tests/hooks/useAuth.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from '../../hooks/useAuth';

// Mock Firebase
vi.mock('../../firebaseConfig', () => ({
  auth: mockAuth,
  db: mockFirestore,
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('로그인 상태를 정확히 반환해야 함', async () => {
    const { result } = renderHook(() => useAuth());
    
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  it('로그아웃 시 상태가 초기화되어야 함', async () => {
    const { result } = renderHook(() => useAuth());
    
    await act(async () => {
      await result.current.logout();
    });
    
    expect(result.current.isAuthenticated).toBe(false);
  });
});
```

### 컴포넌트 테스트 템플릿

```typescript
// tests/components/Common/Modal.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Modal } from '../../../components/Common/Modal';

describe('Modal', () => {
  it('isOpen이 true일 때 표시되어야 함', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <div>Modal Content</div>
      </Modal>
    );
    
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('X 버튼 클릭 시 onClose가 호출되어야 함', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div>Modal Content</div>
      </Modal>
    );
    
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('ESC 키 입력 시 onClose가 호출되어야 함', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div>Modal Content</div>
      </Modal>
    );
    
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
```

---

## 📋 실행 체크리스트

### Phase 1: Hooks 테스트

- [ ] `useAuth.test.ts` 작성
- [ ] `usePermissions.test.ts` 작성
- [ ] `useTabPermissions.test.ts` 작성
- [ ] `useStaff.test.ts` 작성
- [ ] `useEnrollments.test.ts` 작성
- [ ] `useForm.test.ts` 작성
- [ ] `useFocusTrap.test.ts` 작성
- [ ] `useAppState.test.ts` 작성
- [ ] `useBilling.test.ts` 작성
- [ ] `useExams.test.ts` 작성
- [ ] 커버리지 확인 (목표: hooks 80%)

### Phase 2: 컴포넌트 테스트

- [ ] `tests/components/` 폴더 구조 생성
- [ ] Mock 설정 (`tests/mocks/`) 확장
- [ ] `Modal.test.tsx` 작성
- [ ] `Button.test.tsx` 작성
- [ ] `StudentCard.test.tsx` 작성
- [ ] `AttendanceTable.test.tsx` 작성
- [ ] 커버리지 확인 (목표: 전체 75%)

### Phase 3: 통합 테스트

- [ ] `tests/integration/` 폴더 생성
- [ ] `auth-flow.test.ts` 작성
- [ ] `student-registration.test.ts` 작성
- [ ] 커버리지 확인 (목표: 전체 80%)

---

## 🏃 실행 명령어

```bash
# 전체 테스트 실행
npm run test

# 특정 파일 테스트
npm run test -- useAuth.test.ts

# 커버리지 확인
npm run test:coverage

# UI 모드로 테스트
npm run test:ui

# 특정 폴더만 테스트
npm run test -- tests/hooks/

# Watch 모드
npm run test -- --watch
```

---

## 📈 예상 결과

| 단계 | 완료 후 커버리지 |
|------|-----------------|
| 현재 | 60.63% |
| Phase 1 완료 | ~70% |
| Phase 2 완료 | ~78% |
| Phase 3 완료 | **80%+** ✅ |

---

## ⚠️ 주의사항

1. **Firebase Mock**: 모든 Firebase 호출은 Mock 처리 필요
2. **React Query**: QueryClient Provider 래핑 필요
3. **비동기 작업**: `waitFor`, `act` 적절히 사용
4. **정리 작업**: `beforeEach`에서 mock 초기화

---

**마지막 업데이트**: 2026-02-07  
**작성자**: Claude Code Assistant
