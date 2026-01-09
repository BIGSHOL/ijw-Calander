# Unified Student DB 리팩토링 완료 보고서
날짜: 2026년 1월 7일

## 1. 개요
본 프로젝트는 **Timetable(시간표)** 모듈과 **Attendance(출석부)** 모듈에서 개별적으로 관리되던 학생 데이터를 **Unified Student Database (`students` 컬렉션)**로 통합하는 대규모 리팩토링 작업입니다. 이를 통해 데이터 일관성을 확보하고 관리 효율성을 높였습니다.

## 2. 주요 변경 사항

### A. 데이터베이스 및 타입 (Foundation)
- **UnifiedStudent 인터페이스**: 학생 데이터 표준 모델 정의 (`id`, `name`, `status`, `teacherIds` 등).
- **Hooks**: `useStudents` (Timetable용) 및 `useAttendanceStudents` (Attendance용) 훅이 이제 동일한 `students` 컬렉션을 바라봅니다.
- **Metadata**: 생성일(`createdAt`), 수정일(`updatedAt`), 상태(`status`) 필드가 표준화되었습니다.

### B. 시간표 (Timetable) 모듈
- **참조 구조 전환**: `TimetableClass` 문서 내에 학생 데이터를 통째로 저장하던 방식(`studentList`)에서, 학생 ID만 저장(`studentIds`)하고 실제 데이터는 실시간으로 조인하는 방식으로 변경되었습니다.
- **컴포넌트 수정**: `TimetableManager`, `ClassCard`(수학/영어) 등이 `studentIds`와 데이터 맵(`studentMap`)을 사용하여 렌더링되도록 수정되었습니다.
- **Drag & Drop**: 학생 이동 시 객체 복사가 아닌 ID 이동으로 로직이 변경되었습니다.

### C. 출석부 (Attendance) 모듈
- **데이터 소스 변경**: 기존 `attendance_students` 컬렉션 사용을 중단하고 `students` 통합 컬렉션을 사용하도록 `useAttendance` 훅을 재작성했습니다.
- **데이터 호환성**: 기존 출석부 기능(출석 기록, 메모 등)이 새로운 통합 학생 ID 체계 위에서도 작동하도록 인터페이스를 맞췄습니다.

## 3. 검증 및 주의사항 (Verification & Notes)

### ✅ 확인 필요 사항
1.  **데이터 마이그레이션 확인**: `migrateStudents.ts` 스크립트 실행 후 Firestore `students` 컬렉션에 학생 데이터가 정상적으로 생성되었는지 확인해주세요.
2.  **연동 확인**: 시간표에서 학생 이름 변경 시 출석부에도 즉시 반영되는지 확인해주세요 (데이터 통합 확인).
3.  **기존 데이터**: `attendance_students`에 있던 과거 데이터는 `students`로 자동 이관되지 않았으므로, 필요시 별도 마이그레이션이 필요할 수 있습니다. (현재 스코프에서는 신규 통합 DB 기준 작동)

## 4. 결론
이번 리팩토링을 통해 학생 데이터의 "단일 진실 공급원(Single Source of Truth)"이 구축되었습니다. 향후 상담 관리(Consultation) 연동이나 성적 관리 등 확장 기능 구현 시 데이터 파편화 문제 없이 원활한 확장이 가능합니다.
