# 역할 기반 권한 제어 (RBAC) 점검 및 구현 결과 보고

> **구현 상태**: **완료** (2025-12-31)
> 상세 구현 결과는 [학생 관리 모달 수정 및 RBAC 구현 결과 보고](file:///d:/ijw-calander/docs/work-plans/student_modal_rbac_implementation.md)를 참조하십시오.

## 목표
모든 주요 기능에 대해 포괄적인 역할 기반 권한 제어(RBAC) 시스템을 구현하여, 사용자가 권한이 있는 데이터만 접근하고 수정할 수 있도록 합니다. 특히 "권한 없는 컨텐츠의 일시적 노출(flash)" 문제를 해결하고 시스템 설정 및 시간표 기능에 대한 세부 권한을 구현합니다.

## 제안된 변경 사항

### 1. 앱 수준: 리다이렉션 및 플래시 방지 [MODIFY] [App.tsx](file:///d:/ijw-calander/App.tsx)
- **플래시 해결**: `userProfile`과 `isTabPermissionLoading`이 로드될 때까지 로딩 상태를 정확히 유지하여 메인 컨텐츠가 렌더링되지 않도록 합니다.
- **리다이렉션**: 초기 로드 시 탭 리다이렉션을 처리하는 `useEffect`를 더 견고하게 개선합니다.
- **린트 오류 수정**: `CalendarBoard`의 누락된 `currentUser` prop과 `EventModal`의 `initialDepartmentIds` 관련 오류를 해결합니다.

### 2. 시스템 설정: 하위 탭 게이팅 [MODIFY] [SettingsModal.tsx](file:///d:/ijw-calander/SettingsModal.tsx)
- **권한 점검**: 각 하위 탭에 대한 세부 권한을 확인합니다:
  - **부서 관리**: `system.departments.view`/`edit` 확인.
  - **강사 관리**: `system.teachers.view`/`edit` 확인.
  - **수업 관리**: `system.classes.view`/`edit` 확인.
- **UI 게이팅**: 이 권한들에 기반하여 하위 탭 버튼을 숨기거나 보여줍니다.

### 3. 시간표: 기능 접근 제어 [MODIFY] [TimetableManager.tsx](file:///d:/ijw-calander/components/Timetable/TimetableManager.tsx)
- **과목 접근**: 역할/권한에 따라 '수학' 또는 '영어' 과목에 대한 접근을 제한하는 로직을 구현합니다.
- **뷰 접근**: 필요한 경우 특정 뷰 타입(강사별, 강의실별, 통합)에 대한 접근을 제한합니다.
- **데이터 수정**: 추가/수정/삭제 버튼이 권한에 의해 제어되도록 합니다.

### 4. 권한 설정 [MODIFY] [RolePermissionsTab.tsx](file:///d:/ijw-calander/components/settings/RolePermissionsTab.tsx)
- **새 토글 추가**:
  - 강사 관리 권한 토글 추가.
  - 수업 관리 권한 토글 추가.
  - 시간표 과목/뷰 접근 권한 토글 추가.
- **그룹 레이블**: 업데이트된 명확한 그룹 레이블을 사용합니다.

### 5. 타입 및 상수 [MODIFY] [types.ts](file:///d:/ijw-calander/types.ts)
- **새 권한 ID 정의**: `timetable.math_access`, `timetable.english_access`, `system.teachers.manage` 등의 ID를 추가합니다.

## 검증 계획

### 수동 검증
- 다양한 역할(Admin, Manager, Editor, User)로 로그인하여 다음을 확인합니다:
  - '연간 일정'이 깜빡이지 않고 리다이렉션이 조용히 일어나는지 확인.
  - 시스템 설정에서 권한이 있는 하위 탭만 표시되는지 확인.
  - 시간표에서 권한이 있는 과목과 뷰만 표시되는지 확인.
  - 추가/수정/삭제 버튼이 권한에 따라 올바르게 작동하는지 확인.
