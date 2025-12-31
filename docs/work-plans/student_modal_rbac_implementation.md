# 학생 관리 모달 수정 및 RBAC 구현 결과 보고

## 1. 개요
최근 작업에서는 `StudentModal.tsx`의 치명적인 구문 오류와 로직 결함을 수정하고, 시스템 전체에 걸쳐 세부적인 역할 기반 권한 제어(RBAC)를 적용했습니다. 특히 권한 없는 사용자가 페이지 진입 시 데이터가 잠깐 노출되는 "플래시" 현상을 해결했습니다.

## 2. 주요 구현 내용

### A. 학생 관리 모달 (`StudentModal.tsx`) 개선
- **구문 오류 수정**: JSX 구조 파손 및 브라켓 불일치 문제를 해결하여 빌드 안정성 확보.
- **로직 리팩토링**: 
    - `handleUpdateStudent`: 개별 필드 업데이트 대신 `Partial<TimetableStudent>` 객체를 받아 업데이트하도록 개선하여 성능과 가독성 향상.
    - **상태 관리 최적화**: `isDirty` 상태와 `isDirtyRef`를 활용하여 데이터 수정 중 실시간 DB 동기화로 인한 충돌 방지.
- **사용자 경험(UX) 강화**:
    - **신입/퇴원/대기 상태 상호 배제**: 한 학생이 여러 상태를 동시에 가질 수 없도록 로직 수정.
    - **밑줄 강조 보호**: 밑줄이 있는 학생은 퇴원 처리 전 확인 로직 추가.
    - **모달 너비 확장**: `max-w-xl`로 확장하여 한글/영어 이름 병기 시 레이아웃 깨짐 방지.

### B. 역할 기반 권한 제어 (RBAC) 구현
- **세부 권한 ID 도입**: `types.ts`에 다음 권한 추가:
    - `settings.teachers.view/edit`, `settings.classes.view/edit`, `settings.roles.manage`
    - `timetable.math.view/edit`, `timetable.english.view/edit`, `timetable.integrated.view`
- **UI 게이팅 (Gating)**:
    - **시스템 설정**: 권한에 따라 '강사 관리', '수업 관리', '역할 권한' 탭을 동적으로 숨김 처리.
    - **시간표**: 과목별(수합/영어) 접근 권한에 따라 탭 노출 제어 및 '수업 추가' 버튼 노출 제한.
    - **학생 관리**: `StudentModal` 내의 모든 편집 기능(추가, 수정, 삭제, 일괄 작업)을 `timetable.english.edit` 권한으로 보호.

### C. 보안 및 안정성
- **플래시 노출 방지**: `App.tsx`에서 `isTabPermissionLoading` 상태를 전역적으로 관리하여, 권한 확인이 완료될 때까지 메인 컨텐츠 렌더링을 차단하고 로딩 화면을 표시.
- **린트 오류 해결**: `CalendarBoard` 및 `EventModal`에서 발생하던 `currentUser` 및 `initialDepartmentIds` 관련 prop 타입 오류 수정.

## 3. 파일 변경 사항
- `d:\ijw-calander\types.ts`: 권한 ID 정의 및 기본값 업데이트.
- `d:\ijw-calander\App.tsx`: 로딩/리다이렉션 로직 및 시간표 바 게이팅.
- `d:\ijw-calander\components\SettingsModal.tsx`: 시스템 설정 하위 탭 접근 제어.
- `d:\ijw-calander\components\Timetable\TimetableManager.tsx`: 시간표 과목/뷰 접근 제어.
- `d:\ijw-calander\components\Timetable\English\StudentModal.tsx`: 로직 전면 리팩토링 및 권한 적용.

## 4. 향후 계획
- **과목별 세부 권한 확장**: 현재 영어 중심의 권한을 수학 및 다른 과목에도 동일한 수준으로 적용 예정.
- **권한 관리 UI 개선**: `RolePermissionsTab.tsx`에서 새로운 권한들에 대한 설명 툴팁 추가 검토.
