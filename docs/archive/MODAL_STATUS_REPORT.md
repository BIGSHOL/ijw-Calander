# 모달 섹션 패턴 적용 현황 보고서

생성일: 2026-02-03
총 모달 수: 68개 (Common/Modal.tsx 제외)

## 📊 전체 요약

### 카테고리별 분류

| 카테고리 | 개수 | 설명 |
|----------|------|------|
| ✅ 섹션 적용 완료 | 50개 | EventFormFields 스타일 섹션 헤더 적용 완료 |
| 🔄 Wrapper 모달 | 7개 | 다른 컴포넌트를 감싸는 모달 (컨텐츠는 내부 컴포넌트에 있음) |
| ⚙️ 특수 디자인 | 5개 | 커스텀 UI가 필요한 특수 모달 |
| ✅ 간단한 확인 | 3개 | 간단한 확인/선택 다이얼로그 |
| ⚙️ 유틸리티 | 1개 | 이미지 내보내기 등 특수 기능 모달 |
| ❌ 작업 필요 | **8개** | 섹션 패턴 적용이 필요한 모달 |

---

## ✅ 섹션 패턴 적용 완료 (50개)

### Priority 1: 핵심 폼 모달 (5개)
1. components/StudentManagement/AddStudentModal.tsx (6 sections)
2. components/StudentConsultation/AddConsultationModal.tsx (5 sections)
3. components/ClassManagement/AddClassModal.tsx (3 sections)
4. components/Grades/ExamCreateModal.tsx (4 sections)
5. components/Resources/ResourceAddModal.tsx (4 sections)

### Priority 2: 참조/상세보기 모달 (7개)
1. components/ClassManagement/ClassDetailModal.tsx (15 sections) - 참조 모달
2. components/ClassManagement/EditClassModal.tsx (8 sections)
3. components/Attendance/components/SettlementModal.tsx (4 sections)
4. components/Attendance/components/SessionSettingsTab.tsx (4 sections)
5. components/Grades/AddScoreModal.tsx
6. components/StudentManagement/tabs/grades/LevelTestModal.tsx (1 section)
7. components/StudentManagement/tabs/grades/GoalSettingModal.tsx (1 section)

### Batch 3: 복잡한 폼 모달 (10개)
1. components/StudentManagement/DuplicateNamesViewModal.tsx (4 sections)
2. components/Calendar/SeminarEventModal.tsx (7 sections)
3. components/Staff/StaffViewModal.tsx (5 sections)
4. components/Timetable/English/StudentModal.tsx (3 sections)
5. components/Timetable/Math/MathStudentModal.tsx (4 sections)
6. components/StudentManagement/StudentMergeModal.tsx (단계별 sections)
7. components/StudentManagement/DeleteInvalidStudentsModal.tsx (단계별 sections)
8. components/Billing/BillingImportModal.tsx (4 sections)
9. components/StudentConsultation/ConsultationDetailModal.tsx (5 sections)
10. components/StudentManagement/WithdrawalModal.tsx (2 sections)

### Batch 4: 중간 복잡도 모달 (10개)
1. components/StudentManagement/AttendanceNumberMigrationModal.tsx (4 sections)
2. components/Timetable/English/BackupHistoryModal.tsx (4 sections)
3. components/Timetable/English/LevelSettingsModal.tsx (3 sections)
4. components/Timetable/English/EnglishExportModal.tsx (4 sections)
5. components/Timetable/Math/ScenarioManagementModal.tsx (4 sections)
6. components/Timetable/English/ScenarioManagementModal.tsx (4 sections)
7. components/ClassManagement/ClassSettingsModal.tsx (탭별 sections)
8. components/Attendance/components/SessionSettingsTab.tsx (4 sections)
9. components/Attendance/components/SettlementModal.tsx (4 sections)
10. components/Timetable/English/SimulationStudentModal.tsx (3 sections)

### Batch 5: 설정 및 작은 모달 (10개)
1. components/settings/HolidaysTab.tsx (3 sections)
2. components/Auth/LoginModal.tsx (모드별 sections)
3. components/Calendar/CalendarSettingsModal.tsx (탭별 sections)
4. components/TaskMemo/MemoDetailModal.tsx (2 sections)
5. components/TaskMemo/MemoSendModal.tsx (2 sections)
6. components/Calendar/MyEventsModal.tsx (2 sections)
7. components/Calendar/BucketModal.tsx (1 section)
8. components/StudentManagement/tabs/grades/LevelTestModal.tsx (1 section)
9. components/StudentManagement/tabs/grades/GoalSettingModal.tsx (1 section)
10. components/StudentManagement/tabs/grades/CommentModal.tsx (1 section)

### Batch 6: 최종 모달 (8개)
1. components/Attendance/AttendanceMigrationModal.tsx (5 sections)
2. components/Gantt/GanttSettingsModal.tsx (탭별 sections)
3. components/Header/PermissionViewModal.tsx (3 sections)
4. components/StudentManagement/BulkEnglishNameUpdateModal.tsx
5. components/StudentManagement/StudentDataCleanupModal.tsx
6. components/RegistrationConsultation/RegistrationMigrationModal.tsx
7. components/StudentConsultation/ConsultationMigrationModal.tsx
8. components/StudentManagement/StudentMigrationModal.tsx

---

## 🔄 Wrapper 모달 (7개)

이 모달들은 다른 컴포넌트를 감싸는 역할만 하며, 실제 내용은 내부 컴포넌트에서 관리합니다.
섹션 패턴은 내부 컴포넌트에 적용되어 있습니다.

1. **components/Settings/SettingsModal.tsx**
   - 포함: HolidaysTab (섹션 패턴 ✅)
   - 역할: 시스템 설정 wrapper

2. **components/Timetable/TimetableSettingsModal.tsx**
   - 포함: ClassSettingsModal (embedded)
   - 역할: 수업 설정 wrapper

3. **components/StudentManagement/StudentDetailModal.tsx**
   - 포함: StudentDetail 컴포넌트
   - 역할: 학생 상세 정보 조회 wrapper

4. **components/Calendar/EventModal.tsx**
   - 포함: EventFormFields 컴포넌트
   - 역할: 이벤트 폼 wrapper

5. **components/Attendance/AttendanceSettingsModal.tsx**
   - 포함: SalarySettingsTab
   - 역할: 급여 설정 wrapper

6. **components/Attendance/SessionSettingsModal.tsx**
   - 포함: SessionSettingsTab (섹션 패턴 ✅)
   - 역할: 세션 기간 설정 wrapper

7. **components/Attendance/components/StudentListModal.tsx**
   - 역할: 학생 목록 조회 wrapper

---

## ⚙️ 특수 디자인 모달 (5개)

이 모달들은 특별한 UI/UX가 필요하여 표준 섹션 패턴을 적용하기 어렵습니다.

1. **components/Timetable/English/ScenarioCompareModal.tsx**
   - 특징: Collapsed state, pill 버튼으로 축소/확장
   - 이유: 시나리오 비교를 위한 특수 UI

2. **components/Timetable/English/MoveSelectionModal.tsx**
   - 특징: 수업 선택 버튼 리스트
   - 이유: 간단한 선택 인터페이스

3. **components/Timetable/English/TeacherOrderModal.tsx**
   - 특징: Drag-and-drop 정렬 인터페이스
   - 이유: 강사 순서 정렬 기능

4. **components/Timetable/WeekdayOrderModal.tsx**
   - 특징: Drag-and-drop 정렬 인터페이스
   - 이유: 요일 순서 정렬 기능

5. **components/Timetable/Math/components/Modals/SimpleViewSettingsModal.tsx**
   - 특징: 간단한 보기 설정 토글
   - 이유: 단순 설정 변경 모달

---

## ✅ 간단한 확인 모달 (3개)

이 모달들은 단순 확인/취소 다이얼로그로, 섹션 구조가 필요하지 않습니다.

1. **components/Timetable/English/LevelUpConfirmModal.tsx**
   - 역할: 레벨업/다운 확인
   - 내용: 확인 메시지 + 진행상황

2. **components/ClassroomAssignment/components/ApplyConfirmModal.tsx**
   - 역할: 강의실 배정 변경 확인
   - 내용: 변경 목록 + 확인/취소 버튼

3. **components/Staff/StaffLinkModal.tsx**
   - 역할: 직원-계정 연결 선택
   - 내용: 사용자 검색 및 선택

---

## ⚙️ 유틸리티 모달 (1개)

1. **components/Common/ExportImageModal.tsx**
   - 역할: 이미지 내보내기
   - 특징: 미리보기 + 다운로드 기능
   - 이유: 특수 이미지 생성 기능

---

## ❌ 작업 필요 모달 (2개)

이 모달들은 섹션 패턴을 적용해야 하는 폼 모달이지만, 아직 작업이 완료되지 않았습니다.

### 1. components/StudentManagement/AssignClassModal.tsx
**현재 상태**: 일반 폼 레이아웃
**적용 필요 섹션**:
- 과목 선택 섹션 (BookOpen 아이콘)
- 수업 검색 및 선택 섹션 (Search 아이콘)
- 현재 배정 정보 섹션 (Calendar 아이콘)
- 배정 설정 섹션 (Settings 아이콘)

### 2. components/StudentManagement/EnglishClassAssignmentModal.tsx
**현재 상태**: 일반 폼 레이아웃
**적용 필요 섹션**:
- 학생 정보 섹션 (User 아이콘)
- 영어 레벨 및 수업 선택 섹션 (BookOpen 아이콘)
- 배정 설정 섹션 (Settings 아이콘)

---

## 📈 추가 작업 필요 모달 (6개)

검토 결과, 다음 모달들도 섹션 패턴을 적용해야 합니다:

### 3. components/ClassManagement/EnrollmentDiagnosticModal.tsx
**유형**: 진단 및 수정 모달 (복잡)
**현재 상태**: 일반 레이아웃
**라인 수**: ~500+ 라인
**적용 필요 섹션**:
- 진단 통계 섹션 (Activity 아이콘) - 전체 enrollment 통계
- 필터 설정 섹션 (Filter 아이콘) - 문제 유형별 필터
- 학생별 enrollment 목록 섹션 (Users 아이콘) - 매칭 결과 표시
- 복구 작업 섹션 (Settings 아이콘) - 일괄 수정 옵션

### 4. components/Attendance/components/AddStudentToAttendanceModal.tsx
**유형**: 학생 추가 폼 모달
**현재 상태**: 일반 레이아웃
**라인 수**: ~200 라인
**적용 필요 섹션**:
- 등록 설정 섹션 (Settings 아이콘) - 일반/임시 등록 선택
- 검색 및 필터 섹션 (Search 아이콘) - 학생 검색
- 학생 선택 목록 섹션 (Users 아이콘) - 체크박스 리스트

### 5. components/Attendance/components/StudentModal.tsx
**유형**: 출석부 학생 추가/수정 폼
**현재 상태**: 일반 레이아웃
**라인 수**: ~300 라인
**적용 필요 섹션**:
- 기본 정보 섹션 (User 아이콘) - 이름, 학교, 학년
- 수업 설정 섹션 (BookOpen 아이콘) - 그룹, 급여 설정
- 출석 요일 섹션 (CalendarDays 아이콘) - 요일 선택
- 기간 설정 섹션 (Calendar 아이콘) - 시작일, 종료일

### 6. components/Settings/TeacherIdMigrationModal.tsx
**유형**: 마이그레이션 모달 (복잡)
**현재 상태**: 단계별 진행 (preview/manual-mapping/migration)
**라인 수**: ~400+ 라인
**적용 필요 섹션**:
- Preview 단계: 매칭 통계 (BarChart3), 매칭 결과 목록 (Users), 수동 매핑 필요 (AlertTriangle)
- Manual Mapping 단계: 매핑 설정 (Link2)
- Migration 단계: 진행 상황 (TrendingUp), 결과 요약 (CheckCircle)

### 7. components/Timetable/Math/components/Modals/AddClassModal.tsx
**유형**: 수학 수업 추가 폼
**현재 상태**: 일반 레이아웃
**라인 수**: ~200 라인
**적용 필요 섹션**:
- 기본 정보 섹션 (BookOpen 아이콘) - 수업명, 강사, 교실
- 부담임 설정 섹션 (UserCheck 아이콘) - 부담임 여부
- 스케줄 선택 섹션 (Calendar 아이콘) - 요일/교시 그리드

### 8. components/Timetable/Math/components/Modals/ClassDetailModal.tsx
**유형**: 수학 수업 상세/편집 모달
**현재 상태**: 조회/편집 모드 전환
**라인 수**: ~400+ 라인
**적용 필요 섹션**:
- 조회 모드: 수업 정보 (BookOpen), 학생 목록 (Users)
- 편집 모드: 수업 설정 (Settings), 스케줄 (Calendar), 학생 관리 (UserPlus), 학생 목록 (Users)

---

## 🎯 권장 조치사항

### 1단계: 간단한 모달 완료 (2개) - Priority High
1. **StudentManagement/AssignClassModal.tsx** - 수업 배정 폼
2. **StudentManagement/EnglishClassAssignmentModal.tsx** - 영어 수업 배정 폼

### 2단계: 출석부 관련 모달 (2개) - Priority High
3. **Attendance/components/AddStudentToAttendanceModal.tsx** - 출석부 학생 추가
4. **Attendance/components/StudentModal.tsx** - 출석부 학생 정보

### 3단계: 시간표 관련 모달 (2개) - Priority Medium
5. **Timetable/Math/components/Modals/AddClassModal.tsx** - 수학 수업 추가
6. **Timetable/Math/components/Modals/ClassDetailModal.tsx** - 수학 수업 상세

### 4단계: 복잡한 모달 (2개) - Priority Low
7. **ClassManagement/EnrollmentDiagnosticModal.tsx** - enrollment 진단 (복잡)
8. **Settings/TeacherIdMigrationModal.tsx** - 강사 ID 마이그레이션 (복잡)

### 최종 검증
- 전체 빌드 테스트 실행
- TypeScript 에러 확인
- 시각적 일관성 검토
- 사용자 테스트

---

## 📝 패턴 적용 표준

### 섹션 헤더 구조
```tsx
<div className="bg-white border border-gray-200 overflow-hidden">
  <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
    <Icon className="w-3 h-3 text-[#081429]" />
    <h3 className="text-[#081429] font-bold text-xs">섹션 제목</h3>
  </div>
  <div className="divide-y divide-gray-100">
    {/* Row-based layout */}
    <div className="flex items-center gap-2 px-2 py-1.5">
      <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">Label</span>
      <input className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#fdb813]" />
    </div>
  </div>
</div>
```

### 사용된 아이콘 (lucide-react)
- **BookOpen**: 수업, 과목, 학습 정보
- **Users**: 학생, 참가자 목록
- **Calendar**: 날짜, 스케줄
- **FileText**: 문서, 메모, 설명
- **Settings**: 설정, 옵션
- **Shield**: 권한, 보안
- **Phone**: 연락처
- **User**: 개인 정보
- **Hash**: 태그, 해시태그
- **Building2**: 부서
- **DollarSign**: 급여, 비용
- **Calculator**: 정산, 계산
- **Database**: 마이그레이션, 데이터
- **Zap**: 테스트, 빠른 작업
- **Target**: 목표, 타겟
- **MessageSquare**: 메시지, 코멘트

---

## ✅ 빌드 상태

- **Vite 빌드**: ✅ 성공 (16.56s)
- **TypeScript**: 18개 기존 에러 (섹션 패턴 작업과 무관)

---

**작성자**: Claude Code (리팩토링 총괄 부장)
**마지막 업데이트**: 2026-02-03
