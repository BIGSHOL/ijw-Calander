# Unified Student DB 리팩토링 진행 상황 보고서
날짜: 2026년 1월 7일

## 1. 개요
기존의 각 수업 문서(`TimetableClass`)에 내장된 학생 데이터(`studentList`)를 중앙화된 `students` 컬렉션의 참조(`studentIds`)로 변경하는 대규모 리팩토링 작업을 진행 중입니다.

## 2. 완료된 작업 (Completed)

### 1단계: 기반 작업 (Foundation)
- **데이터 구조 정의**: `UnifiedStudent` 인터페이스 정의 및 Firestore, Typescript 타입 업데이트 완료.
- **보안 규칙**: `students` 컬렉션에 대한 보안 규칙(`firestore.rules`) 추가 완료.
- **데이터 훅**: 학생 데이터를 조회하고 관리(CRUD)하는 `useStudents` 훅 구현 완료.

### 2단계: 데이터 마이그레이션 (Migration)
- **마이그레이션 스크립트**: 기존 수업 목록에서 학생 데이터를 추출하여 중복을 제거하고 `students` 컬렉션으로 이관하는 `migrateStudents.ts` 작성 및 실행 완료.
- **데이터 연결**: 각 수업 문서에 `studentIds` 필드를 생성하고, 마이그레이션된 학생 ID를 매핑하는 `linkStudentsToClasses.ts` 스크립트 실행 완료.

### 3단계: 시간표 컴포넌트 리팩토링 (Timetable Components)
- **`useClassOperations` 훅**: 학생 추가/삭제/퇴원/복구 로직을 `studentList` 직접 수정 방식에서 `studentIds` 관리 및 `UnifiedStudent` 업데이트 방식으로 변경 완료.
- **`TimetableManager`**: 전체 학생 데이터를 로드(`useStudents`)하고 이를 `studentMap` 형태로 변환하여 하위 컴포넌트에 주입하는 로직 구현 완료.
- **조회 컴포넌트 수정**:
  - `TimetableGrid` (수학): `studentMap`을 받아 `ClassCard`에 전달하도록 수정.
  - `EnglishTimetable` (영어): `studentMap`을 받아 `EnglishClassTab` 및 하위 컴포넌트에 전달하도록 수정.
  - `ClassCard` (수학/영어): 내장된 `studentList` 대신 `studentIds`와 `studentMap`을 사용하여 학생 정보를 표시하도록 수정 완료.
  - 관련 문법 오류 및 중복 코드 정리 완료.

## 3. 진행 중인 작업 (In Progress)

- **드래그 앤 드롭(Drag & Drop) 로직 리팩토링**:
  - 현재 `useStudentDragDrop`(수학) 및 `useEnglishChanges`(영어) 훅을 분석 중입니다.
  - 기존에는 객체 자체를 이동시켰으나, 이제는 `studentIds` 배열 내의 ID만 이동하도록 로직을 변경해야 합니다.

## 4. 향후 계획 (Next Steps)

1.  **드래그 앤 드롭 로직 완료**: UI상의 이동이 실제 `studentIds` 업데이트로 반영되도록 로직 수정.
2.  **학생 상세/추가 모달 수정**: 학생 검색 및 기존 학생 추가 기능(ID 참조) 구현.
3.  **출석부(Attendance) 모듈 리팩토링**: 출석 데이터가 `UnifiedStudent`와 연동되도록 수정.
4.  **통합 테스트**: 전체 기능 정상 동작 확인.
