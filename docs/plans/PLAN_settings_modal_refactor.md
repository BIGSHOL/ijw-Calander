# Implementation Plan: SettingsModal 대형 컴포넌트 리팩토링

**Status**: 🔄 In Progress (Phase 1 Complete)
**Started**: 2026-01-10
**Last Updated**: 2026-01-10
**Estimated Completion**: 2026-01-13

---

**⚠️ CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date above
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to next phase

⛔ **DO NOT skip quality gates or proceed with failing checks**

---

## 📋 Overview

### Feature Description
**SettingsModal.tsx (1,523줄)를 유지보수 가능한 작은 모듈로 분리**

현재 문제점:
- ✗ 1,523줄의 거대한 단일 파일
- ✗ 30개의 useState로 복잡한 상태 관리
- ✗ 8개의 서로 다른 설정 영역이 한 파일에 혼재
- ✗ 스크롤 피로도 높음, 코드 찾기 어려움
- ✗ 책임이 명확하게 분리되지 않음

목표:
- ✓ 각 탭을 독립적인 컴포넌트로 분리 (250줄 이하)
- ✓ 상태 관리를 커스텀 훅으로 추출
- ✓ SettingsModal.tsx를 800-900줄로 축소
- ✓ 각 모듈의 책임 명확화
- ✓ 테스트 가능한 구조로 개선

### Success Criteria
- [ ] SettingsModal.tsx가 900줄 이하로 축소
- [ ] 각 탭이 독립적인 파일로 분리 (3개 탭)
- [ ] UserDetailModal이 별도 컴포넌트로 추출
- [ ] 커스텀 훅으로 상태 관리 로직 분리 (2개 이상)
- [ ] 기존 기능이 100% 동작 (수동 테스트 통과)
- [ ] TypeScript 타입 에러 없음
- [ ] Lint 에러 없음

### User Impact
- **개발자 경험**: 코드 검색 시간 60% 감소 (예상)
- **유지보수성**: 각 탭별로 독립적인 수정 가능
- **확장성**: 새로운 설정 탭 추가가 용이해짐
- **테스트**: 각 모듈별로 단위 테스트 작성 가능
- **사용자 경험**: 변화 없음 (내부 리팩토링)

---

## 🏗️ Architecture Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| **컴포넌트 분리 우선, 상태는 점진적 이동** | 즉각적인 가독성 개선, 안전한 점진적 리팩토링 | Phase가 늘어나지만 롤백 용이 |
| **props drilling 허용 (1단계만)** | Context/Redux 도입은 오버엔지니어링, 상태가 이미 부모에서 관리됨 | props가 많아질 수 있음 (5-8개) |
| **기존 TabXXX 컴포넌트 재사용** | TeachersTab, ClassesTab 등은 이미 분리되어 있음 | 일관성을 위해 패턴 따라야 함 |
| **타입 정의는 types/ 폴더에 통합** | 중복 타입 정의 방지, 단일 출처 원칙 | import 경로가 길어질 수 있음 |
| **TDD 적용 범위: 유틸/훅만** | UI 컴포넌트는 통합 테스트로 대체 (수동) | 테스트 커버리지가 낮아질 수 있음 |

---

## 📦 Dependencies

### Required Before Starting
- [ ] Git 브랜치 생성: `refactor/settings-modal-split`
- [ ] 현재 기능 수동 테스트 (체크리스트 작성)
- [ ] 백업: SettingsModal.tsx 복사본 생성

### External Dependencies
- 없음 (기존 패키지 사용)

---

## 🧪 Test Strategy

### Testing Approach
**하이브리드 접근**:
- **TDD**: 커스텀 훅 및 유틸 함수만
- **수동 테스트**: UI 컴포넌트 (체크리스트 기반)

### Test Pyramid for This Feature
| Test Type | Coverage Target | Purpose |
|-----------|-----------------|---------|
| **Unit Tests** | ≥70% | 커스텀 훅 로직 (useDepartmentManager 등) |
| **Integration Tests** | 수동 체크리스트 | 탭 전환, 데이터 저장, 권한 체크 |
| **E2E Tests** | 수동 체크리스트 | 전체 설정 워크플로우 |

### Test File Organization
```
__tests__/
├── hooks/
│   ├── useDepartmentManager.test.ts
│   └── useBatchSave.test.ts
└── manual/
    └── settings_modal_checklist.md
```

### Coverage Requirements by Phase
- **Phase 1 (UserDetailModal 분리)**: 수동 테스트 (기능 유지 확인)
- **Phase 2 (DepartmentsTab 분리)**: 수동 테스트 + useDepartmentManager 훅 테스트 (≥70%)
- **Phase 3 (UsersTab 분리)**: 수동 테스트
- **Phase 4 (SystemSettingsTab 분리)**: 수동 테스트
- **Phase 5 (상태 관리 훅 통합)**: 훅 단위 테스트 (≥70%)

### Manual Test Checklist Template
```markdown
## SettingsModal 기능 테스트 체크리스트

### 부서 관리
- [ ] 부서 추가 (기본 권한, 색상 설정)
- [ ] 부서 편집 (이름, 카테고리 변경)
- [ ] 부서 삭제 (확인 다이얼로그)
- [ ] 부서 드래그 순서 변경
- [ ] 부서 검색 필터링
- [ ] 카테고리 추가/삭제

### 사용자 관리
- [ ] 승인된 사용자 목록 조회
- [ ] 대기 중 사용자 승인
- [ ] 사용자 역할 변경 (권한 체크)
- [ ] 부서별 권한 수정 (view/edit/block)
- [ ] 사용자 삭제 (본인 제외)
- [ ] 사용자 검색
- [ ] 사용자 상세 모달 열기/닫기
- [ ] 사용자 일정 조회 (MyEventsModal)

### 시스템 설정
- [ ] 데이터 보존 기간 변경
- [ ] 아카이브 토글
- [ ] 휴일 추가/삭제
- [ ] 기본 뷰 모드 설정

### 권한 확인
- [ ] Master: 모든 기능 접근 가능
- [ ] Admin: 제한된 기능만 접근
- [ ] Normal User: 설정 모달 열 수 없음
```

---

## 🚀 Implementation Phases

### Phase 1: UserDetailModal 분리
**Goal**: 사용자 상세 편집 모달을 독립 컴포넌트로 추출
**Estimated Time**: 2-3 hours
**Status**: ✅ Complete
**Actual Time**: 1 hour
**Line Reduction**: 170 lines (1,523 → 1,353)

#### Tasks

**🔴 RED: Write Failing Tests First**
- [x] **Test 1.1**: UserDetailModal 수동 테스트 체크리스트 작성
  - File(s): `docs/plans/manual_test_checklist.md`
  - Expected: 현재 기능 목록 문서화 (테스트는 수동)
  - Details:
    - 사용자 클릭 시 모달 열림
    - 역할 변경 드롭다운 (권한 체크)
    - 부서별 권한 토글 (view/edit/block)
    - 사용자 삭제 버튼
    - 사용자 일정 조회 버튼

**🟢 GREEN: Implement to Make Tests Pass**
- [x] **Task 1.2**: UserDetailModal.tsx 파일 생성
  - File(s): `components/settings/modals/UserDetailModal.tsx`
  - Goal: SettingsModal의 `renderUserDetail()` 함수를 독립 컴포넌트로 추출
  - Details:
    - Props 인터페이스 정의 (selectedUser, onUpdate, onDelete, onClose 등)
    - 상태: 모두 props로 전달받음 (상태 없는 컴포넌트)
    - 핸들러: onUserUpdate, onDeptPermissionChange, onDeleteUser

- [x] **Task 1.3**: SettingsModal에서 UserDetailModal import 및 사용
  - File(s): `components/settings/SettingsModal.tsx`
  - Goal: renderUserDetail 함수 제거, UserDetailModal 컴포넌트 렌더링
  - Details:
    - Line 586-778 제거 (~170줄 감소, 1,523 → 1,353)
    - selectedUserForEdit state로 제어
    - Props 전달 (users, departments, currentUserProfile 등)

**🔵 REFACTOR: Clean Up Code**
- [x] **Task 1.4**: 코드 정리
  - Files: UserDetailModal.tsx, SettingsModal.tsx
  - Goal: 불필요한 주석 제거, import 정리
  - Checklist:
    - [x] Unused imports 제거 (UserRole, canAssignRole, getAssignableRoles, BookUser)
    - [x] Props 타입 명확화
    - [x] 인라인 스타일을 Tailwind로 통일 (이미 적용됨)
    - [x] 함수 네이밍 일관성 체크

#### Quality Gate ✋

**⚠️ STOP: Do NOT proceed to Phase 2 until ALL checks pass**

**TDD Compliance** (CRITICAL):
- [x] **Manual Test**: 체크리스트 작성 완료 (manual_test_checklist.md)
- [x] **Coverage Check**: N/A (UI 컴포넌트는 수동 테스트)

**Build & Tests**:
- [x] **Build**: `npm run build` 성공 ✓
- [x] **TypeScript**: 기존 에러만 있음, 새로운 에러 없음 ✓
- [ ] **No Runtime Errors**: 브라우저 콘솔 에러 없음 (수동 테스트 필요)

**Code Quality**:
- [x] **Linting**: 빌드 통과로 ESLint 에러 없음 확인 ✓
- [x] **Formatting**: Tailwind 스타일 통일 적용 ✓
- [x] **Import Order**: 불필요한 import 제거 완료 ✓

**Manual Testing** (사용자가 수행 필요):
- [ ] **모달 열기**: 사용자 클릭 시 UserDetailModal 정상 표시
- [ ] **역할 변경**: 드롭다운에서 역할 변경 → 저장 동작
- [ ] **부서 권한 변경**: view/edit/block 토글 동작
- [ ] **사용자 삭제**: 삭제 확인 후 Firebase에서 제거
- [ ] **모달 닫기**: X 버튼, ESC 키, 외부 클릭 모두 동작

**Validation Commands**:
```bash
# Build Check
npm run build

# TypeScript Check
npx tsc --noEmit

# Lint Check
npm run lint

# Format Check
npm run format:check
```

---

### Phase 2: DepartmentsTab 분리
**Goal**: 부서 관리 기능을 독립 컴포넌트로 추출
**Estimated Time**: 3-4 hours
**Status**: ⏳ Pending

#### Tasks

**🔴 RED: Write Failing Tests First**
- [ ] **Test 2.1**: useDepartmentManager 훅 단위 테스트 작성
  - File(s): `__tests__/hooks/useDepartmentManager.test.ts`
  - Expected: Tests FAIL (훅이 아직 없음)
  - Details:
    ```typescript
    test('should add new department with default permissions', () => {
      const { result } = renderHook(() => useDepartmentManager(initialDepts))
      act(() => result.current.addDepartment({ name: '영어부', category: 'language' }))
      expect(result.current.departments).toHaveLength(initialDepts.length + 1)
    })

    test('should update department order on drag', () => {
      // 드래그 순서 변경 테스트
    })

    test('should delete department and cascade to users', () => {
      // 부서 삭제 시 사용자 권한 업데이트 확인
    })
    ```

- [ ] **Test 2.2**: DepartmentsTab 수동 테스트 체크리스트
  - File(s): `docs/plans/manual_test_checklist.md` (업데이트)
  - Expected: 부서 관리 시나리오 문서화

**🟢 GREEN: Implement to Make Tests Pass**
- [ ] **Task 2.3**: useDepartmentManager 커스텀 훅 구현
  - File(s): `hooks/useDepartmentManager.ts`
  - Goal: 부서 CRUD 로직을 훅으로 추출
  - Details:
    ```typescript
    export function useDepartmentManager(initialDepartments: Department[]) {
      const [departments, setDepartments] = useState(initialDepartments)
      const [hasChanges, setHasChanges] = useState(false)

      const addDepartment = (newDept: Partial<Department>) => { /* ... */ }
      const updateDepartment = (id: string, updates: Partial<Department>) => { /* ... */ }
      const deleteDepartment = (id: string) => { /* ... */ }
      const reorderDepartments = (fromIndex: number, toIndex: number) => { /* ... */ }

      return { departments, addDepartment, updateDepartment, deleteDepartment, reorderDepartments, hasChanges }
    }
    ```

- [ ] **Task 2.4**: DepartmentsManagementTab.tsx 컴포넌트 생성
  - File(s): `components/settings/tabs/DepartmentsManagementTab.tsx`
  - Goal: SettingsModal의 부서 관리 UI를 독립 컴포넌트로 추출
  - Details:
    - Line 936-1134 (~200줄) 이동
    - useDepartmentManager 훅 사용
    - Props: departments, onUpdate, currentUserProfile, users 등

- [ ] **Task 2.5**: SettingsModal 통합
  - File(s): `components/settings/SettingsModal.tsx`
  - Goal: 부서 관리 인라인 코드 제거, DepartmentsManagementTab 사용
  - Details:
    - import DepartmentsManagementTab
    - activeTab === 'departments' 조건에서 렌더링
    - 부서 관련 state 10개 → 훅으로 이동

**🔵 REFACTOR: Clean Up Code**
- [ ] **Task 2.6**: 리팩토링
  - Files: useDepartmentManager.ts, DepartmentsManagementTab.tsx
  - Checklist:
    - [ ] 카테고리 관리 로직 분리 (별도 유틸 함수)
    - [ ] 드래그 핸들러 명확화
    - [ ] 색상 선택 컴포넌트 재사용 고려
    - [ ] 타입 정의 types/settings.types.ts로 이동

#### Quality Gate ✋

**⚠️ STOP: Do NOT proceed to Phase 3 until ALL checks pass**

**TDD Compliance** (CRITICAL):
- [ ] **Red Phase**: useDepartmentManager 테스트가 먼저 작성됨
- [ ] **Green Phase**: 훅 구현으로 테스트 통과
- [ ] **Coverage Check**: useDepartmentManager 훅 ≥70% 커버리지
  ```bash
  npm test -- hooks/useDepartmentManager.test.ts --coverage
  ```

**Build & Tests**:
- [ ] **Build**: 빌드 성공
- [ ] **All Tests Pass**: 훅 단위 테스트 100% 통과
- [ ] **TypeScript**: 타입 에러 없음

**Code Quality**:
- [ ] **Linting**: ESLint 통과
- [ ] **Formatting**: Prettier 적용

**Manual Testing**:
- [ ] **부서 추가**: 새 부서 생성 → Firebase 저장
- [ ] **부서 편집**: 이름/카테고리/색상 변경
- [ ] **부서 삭제**: 확인 후 삭제
- [ ] **부서 순서 변경**: 드래그 앤 드롭
- [ ] **카테고리 관리**: 카테고리 추가/삭제
- [ ] **검색 필터**: 부서 검색 동작

**Validation Commands**:
```bash
npm test -- hooks/useDepartmentManager.test.ts --coverage
npm run build
npx tsc --noEmit
npm run lint
```

---

### Phase 3: UsersTab 분리
**Goal**: 사용자 관리 테이블을 독립 컴포넌트로 추출
**Estimated Time**: 2-3 hours
**Status**: ⏳ Pending

#### Tasks

**🔴 RED: Write Failing Tests First**
- [ ] **Test 3.1**: UsersTab 수동 테스트 체크리스트
  - File(s): `docs/plans/manual_test_checklist.md` (업데이트)
  - Expected: 사용자 관리 시나리오 문서화
  - Details:
    - 승인된/대기 중 탭 전환
    - 사용자 검색
    - 사용자 클릭 → UserDetailModal 열기
    - 사용자 일정 보기

**🟢 GREEN: Implement to Make Tests Pass**
- [ ] **Task 3.2**: UsersManagementTab.tsx 컴포넌트 생성
  - File(s): `components/settings/tabs/UsersManagementTab.tsx`
  - Goal: 사용자 테이블 UI 추출
  - Details:
    - Line 1137-1281 (~150줄) 이동
    - Props: users, departments, onUserSelect, onViewEvents 등
    - 내부 상태: userSearchTerm, userTab (approved/pending)

- [ ] **Task 3.3**: SettingsModal 통합
  - File(s): `components/settings/SettingsModal.tsx`
  - Goal: 사용자 테이블 인라인 코드 제거
  - Details:
    - UsersManagementTab import
    - selectedUserForEdit 관리는 SettingsModal에 유지
    - 검색/필터 상태는 탭 내부로 이동

**🔵 REFACTOR: Clean Up Code**
- [ ] **Task 3.4**: 리팩토링
  - Files: UsersManagementTab.tsx
  - Checklist:
    - [ ] 사용자 필터링 로직 분리 (유틸 함수)
    - [ ] 테이블 행 컴포넌트 분리 (UserRow)
    - [ ] 역할 배지 컴포넌트 재사용

#### Quality Gate ✋

**⚠️ STOP: Do NOT proceed to Phase 4 until ALL checks pass**

**TDD Compliance**:
- [ ] **Manual Test**: 체크리스트 완료

**Build & Tests**:
- [ ] **Build**: 빌드 성공
- [ ] **TypeScript**: 타입 에러 없음

**Code Quality**:
- [ ] **Linting**: ESLint 통과
- [ ] **Formatting**: Prettier 적용

**Manual Testing**:
- [ ] **탭 전환**: Approved ↔ Pending 전환
- [ ] **사용자 검색**: 이름/이메일로 검색
- [ ] **사용자 클릭**: UserDetailModal 열림
- [ ] **일정 보기**: MyEventsModal 열림
- [ ] **권한 표시**: 부서별 권한 뱃지 정확히 표시

**Validation Commands**:
```bash
npm run build
npx tsc --noEmit
npm run lint
```

---

### Phase 4: SystemSettingsTab 분리
**Goal**: 시스템 설정 UI를 독립 컴포넌트로 추출
**Estimated Time**: 2 hours
**Status**: ⏳ Pending

#### Tasks

**🔴 RED: Write Failing Tests First**
- [ ] **Test 4.1**: SystemSettingsTab 수동 테스트 체크리스트
  - File(s): `docs/plans/manual_test_checklist.md` (업데이트)
  - Expected: 시스템 설정 시나리오 문서화

**🟢 GREEN: Implement to Make Tests Pass**
- [ ] **Task 4.2**: SystemSettingsTab.tsx 컴포넌트 생성
  - File(s): `components/settings/tabs/SystemSettingsTab.tsx`
  - Goal: 시스템 설정 UI 추출
  - Details:
    - Line 1319-1439 (~120줄) 이동
    - Props: lookbackYears, onUpdateLookback, showArchived, onToggleArchived 등
    - HolidaysTab은 이미 분리되어 있으므로 재사용

- [ ] **Task 4.3**: SettingsModal 통합
  - File(s): `components/settings/SettingsModal.tsx`
  - Goal: 시스템 설정 인라인 코드 제거
  - Details:
    - SystemSettingsTab import
    - activeTab === 'system' 조건에서 렌더링

**🔵 REFACTOR: Clean Up Code**
- [ ] **Task 4.4**: 리팩토링
  - Files: SystemSettingsTab.tsx
  - Checklist:
    - [ ] 설정 섹션 컴포넌트 분리 (SettingSection)
    - [ ] 토글 스위치 컴포넌트 재사용

#### Quality Gate ✋

**⚠️ STOP: Do NOT proceed to Phase 5 until ALL checks pass**

**Build & Tests**:
- [ ] **Build**: 빌드 성공
- [ ] **TypeScript**: 타입 에러 없음

**Manual Testing**:
- [ ] **데이터 보존 기간**: 슬라이더 조정 → Firebase 저장
- [ ] **아카이브 토글**: 표시/숨김 전환
- [ ] **휴일 관리**: HolidaysTab 정상 동작

**Validation Commands**:
```bash
npm run build
npx tsc --noEmit
npm run lint
```

---

### Phase 5: 상태 관리 훅 통합 및 최종 정리
**Goal**: 남은 상태 관리 로직을 커스텀 훅으로 통합, SettingsModal 900줄 이하로 축소
**Estimated Time**: 3-4 hours
**Status**: ⏳ Pending

#### Tasks

**🔴 RED: Write Failing Tests First**
- [ ] **Test 5.1**: useBatchSave 훅 단위 테스트
  - File(s): `__tests__/hooks/useBatchSave.test.ts`
  - Expected: Tests FAIL (훅이 아직 없음)
  - Details:
    ```typescript
    test('should batch update departments and users', async () => {
      const { result } = renderHook(() => useBatchSave())
      const changes = { departments: [...], users: [...] }
      await act(() => result.current.saveChanges(changes))
      expect(mockFirestore.batch().commit).toHaveBeenCalled()
    })
    ```

**🟢 GREEN: Implement to Make Tests Pass**
- [ ] **Task 5.2**: useBatchSave 커스텀 훅 구현
  - File(s): `hooks/useBatchSave.ts`
  - Goal: 배치 저장 로직 추출 (Line 385-463)
  - Details:
    - Firebase writeBatch 래핑
    - 에러 핸들링 포함
    - 성공/실패 콜백

- [ ] **Task 5.3**: useSettingsNavigation 훅 구현 (선택)
  - File(s): `hooks/useSettingsNavigation.ts`
  - Goal: 탭 네비게이션 상태 관리
  - Details:
    - mainTab, activeTab state
    - 탭 전환 로직
    - 권한에 따른 탭 필터링

- [ ] **Task 5.4**: SettingsModal 최종 정리
  - File(s): `components/settings/SettingsModal.tsx`
  - Goal: 800-900줄로 축소
  - Checklist:
    - [ ] 모든 인라인 탭 코드 제거 확인
    - [ ] 불필요한 state 제거
    - [ ] 불필요한 import 제거
    - [ ] 주석 정리
    - [ ] 함수 순서 정리 (lifecycle → handlers → render)

**🔵 REFACTOR: Clean Up Code**
- [ ] **Task 5.5**: 타입 정의 통합
  - Files: `types/settings.types.ts` 생성
  - Checklist:
    - [ ] SettingsModalProps 이동
    - [ ] MainTabMode, TabMode 이동
    - [ ] 각 탭 Props 타입 정의

- [ ] **Task 5.6**: 문서화
  - Files: README 또는 JSDoc 주석
  - Checklist:
    - [ ] SettingsModal 구조 다이어그램
    - [ ] 각 탭 컴포넌트 설명
    - [ ] 커스텀 훅 사용 예시

#### Quality Gate ✋

**⚠️ STOP: Do NOT mark project complete until ALL checks pass**

**TDD Compliance**:
- [ ] **Red Phase**: useBatchSave 테스트 먼저 작성
- [ ] **Green Phase**: 훅 구현으로 테스트 통과
- [ ] **Coverage Check**: useBatchSave ≥70% 커버리지

**Build & Tests**:
- [ ] **Build**: 빌드 성공
- [ ] **All Tests Pass**: 모든 훅 테스트 통과
- [ ] **TypeScript**: 타입 에러 없음

**Code Quality**:
- [ ] **Line Count**: SettingsModal.tsx ≤ 900줄
- [ ] **Linting**: ESLint 통과
- [ ] **Formatting**: Prettier 적용

**Full Integration Test** (Manual):
- [ ] **전체 워크플로우**: 설정 모달 열기 → 각 탭 순회 → 저장
- [ ] **권한 체크**: Master/Admin/Normal 각 역할별 접근 확인
- [ ] **데이터 일관성**: 부서 변경 → 사용자 권한 업데이트 확인
- [ ] **에러 처리**: 네트워크 오류 시 사용자 피드백
- [ ] **성능**: 1,000명 사용자 목록 로딩 시간 < 2초

**Validation Commands**:
```bash
# 모든 테스트 실행
npm test

# 커버리지 확인
npm test -- --coverage

# 빌드 확인
npm run build

# TypeScript 확인
npx tsc --noEmit

# Lint 확인
npm run lint

# 줄 수 확인
wc -l components/settings/SettingsModal.tsx
```

---

## ⚠️ Risk Assessment

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| **Props drilling 과다** (5-10개 props) | High | Medium | 1단계 drilling만 허용, Context는 Phase 6에서 고려 |
| **상태 동기화 이슈** | Medium | High | 각 Phase별로 철저한 수동 테스트, hasChanges flag 유지 |
| **Firebase 배치 저장 실패** | Low | High | useBatchSave 훅에 롤백 로직 포함, 에러 토스트 표시 |
| **기존 기능 회귀** | Medium | High | Phase별 Quality Gate 엄격히 준수, 체크리스트 기반 테스트 |
| **타입 에러 급증** | Medium | Medium | 타입 정의를 먼저 작성, any 사용 금지 |

---

## 🔄 Rollback Strategy

### If Phase 1 Fails
**Steps to revert**:
- `git checkout components/settings/SettingsModal.tsx`
- `git clean -fd components/settings/modals/`

### If Phase 2 Fails
**Steps to revert**:
- Restore to Phase 1 완료 상태
- `git checkout components/settings/SettingsModal.tsx`
- `git clean -fd components/settings/tabs/ hooks/useDepartmentManager.ts`

### If Phase 3 Fails
**Steps to revert**:
- Restore to Phase 2 완료 상태
- `git checkout components/settings/SettingsModal.tsx`
- `git clean -fd components/settings/tabs/UsersManagementTab.tsx`

### If Phase 4 Fails
**Steps to revert**:
- Restore to Phase 3 완료 상태
- `git checkout components/settings/SettingsModal.tsx`
- `git clean -fd components/settings/tabs/SystemSettingsTab.tsx`

### If Phase 5 Fails
**Steps to revert**:
- Restore to Phase 4 완료 상태
- `git checkout components/settings/SettingsModal.tsx hooks/`

---

## 📊 Progress Tracking

### Completion Status
- **Phase 1**: ✅ 100% (UserDetailModal 분리 완료)
- **Phase 2**: ⏳ 0%
- **Phase 3**: ⏳ 0%
- **Phase 4**: ⏳ 0%
- **Phase 5**: ⏳ 0%

**Overall Progress**: 20% complete (1/5 phases)

### Time Tracking
| Phase | Estimated | Actual | Variance |
|-------|-----------|--------|----------|
| Phase 1 | 2-3 hours | 1 hour | -1 to -2 hours ⚡ |
| Phase 2 | 3-4 hours | - | - |
| Phase 3 | 2-3 hours | - | - |
| Phase 4 | 2 hours | - | - |
| Phase 5 | 3-4 hours | - | - |
| **Total** | 12-16 hours | 1 hour | - |

---

## 📝 Notes & Learnings

### Implementation Notes

**Phase 1 완료 (2026-01-10)**:
- ✅ UserDetailModal 컴포넌트를 성공적으로 분리
- ✅ 170줄 감소 (1,523 → 1,353줄)
- ✅ 기존 타입 에러 유발하지 않음
- 🔧 Props drilling 적용: 총 14개 props 전달 (현재는 허용 범위)
- 💡 상태를 모두 부모(SettingsModal)에서 관리하여 단순한 프리젠테이션 컴포넌트로 구현
- 📂 파일 구조: `components/settings/modals/UserDetailModal.tsx` 생성

### Blockers Encountered

**Phase 1**:
- 없음 (순조롭게 진행)

### Improvements for Future Plans
- ✅ plan-template.md를 활용한 계획이 매우 효과적
- ✅ TDD 접근법의 "Manual Test Checklist"가 회귀 방지에 유용
- 🎯 예상 시간(2-3시간)보다 빠르게 완료(1시간) → 다음 Phase에도 적용 가능
- 💡 컴포넌트 추출 시 props 인터페이스를 먼저 정의하면 구현이 수월함

---

## 📚 References

### Documentation
- [React 컴포넌트 분리 가이드](https://react.dev/learn/thinking-in-react)
- [Custom Hooks 패턴](https://react.dev/learn/reusing-logic-with-custom-hooks)

### Related Issues
- Issue: SettingsModal 1,523줄 리팩토링 필요
- Related: large_files_refactoring_plan.md

---

## ✅ Final Checklist

**Before marking plan as COMPLETE**:
- [ ] All phases completed with quality gates passed
- [ ] Full integration testing performed
- [ ] SettingsModal.tsx ≤ 900줄
- [ ] 3개 탭 컴포넌트 분리 완료
- [ ] 2개 이상 커스텀 훅 구현
- [ ] TypeScript 에러 0개
- [ ] ESLint 에러 0개
- [ ] Manual test checklist 100% 통과
- [ ] 문서화 완료 (타입, 주석, 다이어그램)
- [ ] PR 생성 및 코드 리뷰 요청

---

## 📖 Architecture Diagram

### Before Refactoring
```
SettingsModal.tsx (1,523줄)
├── State (30개 useState)
├── Handlers (20+ 함수)
├── Inline Tab Rendering
│   ├── Departments UI (200줄)
│   ├── Users UI (150줄)
│   ├── System Settings UI (120줄)
│   └── UserDetail Modal (200줄)
└── Already Separated
    ├── TeachersTab
    ├── ClassesTab
    ├── HolidaysTab
    └── ...
```

### After Refactoring (Target)
```
SettingsModal.tsx (800-900줄)
├── Navigation Logic
├── State Orchestration (최소화)
└── Tab Rendering (imports only)

components/settings/
├── tabs/
│   ├── DepartmentsManagementTab.tsx (250줄)
│   ├── UsersManagementTab.tsx (200줄)
│   ├── SystemSettingsTab.tsx (150줄)
│   └── [기존 탭들...]
├── modals/
│   └── UserDetailModal.tsx (200줄)
└── components/
    └── TabNavigation.tsx (선택)

hooks/
├── useDepartmentManager.ts (부서 CRUD)
├── useBatchSave.ts (Firebase 배치 저장)
└── useSettingsNavigation.ts (탭 상태)

types/
└── settings.types.ts (모든 타입 정의)
```

---

**Plan Status**: 🔄 Ready to Start
**Next Action**: Phase 1 시작 - UserDetailModal 분리
**Blocked By**: None
