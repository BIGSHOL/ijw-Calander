# Z-Index 총괄 분석 보고서

## 📋 목차
1. [요약](#요약)
2. [탭 그룹별 Z-Index 현황](#탭-그룹별-z-index-현황)
3. [Z-Index 레이어 구조](#z-index-레이어-구조)
4. [충돌 및 문제점](#충돌-및-문제점)
5. [권장사항](#권장사항)

---

## 요약

### 전체 통계
- **분석 대상 파일**: 135개
- **주요 z-index 범위**: 10 ~ 99,999
- **z-index 레이어**: 10개 주요 레벨

### 주요 발견사항
1. ✅ **표준화**: 대부분의 모달이 `z-[9998]` 표준을 따름
2. ⚠️ **비일관성**: 일부 컴포넌트가 비표준 값 사용 (z-50, z-[100], z-[200])
3. ⚠️ **중복**: 동일 레벨에서 여러 값 사용 (모달: 50, 9998, 9999, 100, 200)
4. ⚠️ **극단값**: ProfileDropdown이 z-[99999] 사용 (과도하게 높음)

---

## 탭 그룹별 Z-Index 현황

### 1. 홈 (Home)
#### Dashboard
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| ConsultationDashboard (모달) | z-50 | 상담 상세 모달 |
| StaffSelector | z-10 | Sticky 헤더 |
| StaffSelector (드롭다운) | z-50 | 드롭다운 메뉴 |

**분석**: 표준 범위 내에서 사용, 문제없음.

---

### 2. 일정 (Schedule)

#### Calendar
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| **모달** |
| EventModal | z-[9998] | 이벤트 모달 |
| BucketModal | z-[9998] | 버킷 모달 |
| CalendarSettingsModal | z-[9998] | 설정 모달 |
| SeminarEventModal | z-[9998] | 세미나 모달 |
| MyEventsModal | z-[9998] | 내 이벤트 모달 |
| **UI 컴포넌트** |
| CalendarBoard (헤더) | z-10, z-30 | Sticky 헤더 |
| CalendarBoard (드롭다운) | z-40, z-50 | 검색/필터 UI |
| CalendarFilterBar | z-30 | 네비게이션 바 |
| CalendarFilterPopover | z-10 | 필터 팝오버 |
| WeekBlock (툴팁) | z-[9999] | 호버 툴팁 |
| WeekBlock (이벤트) | z-20, z-50 | 이벤트 레이어 |
| HashtagCombobox | z-50 | 해시태그 드롭다운 |
| ParticipantSelector | z-50 | 참가자 드롭다운 |
| EventFormFields | z-50 | 폼 드롭다운 |
| CustomSelect | z-50 | 커스텀 셀렉트 |
| SeminarPanel | z-10 | 자동완성 |
| YearlyView | z-10 | 충돌 표시 |

**분석**:
- ✅ 모달은 일관되게 `z-[9998]` 사용
- ⚠️ WeekBlock 툴팁이 `z-[9999]` 사용 (매우 높음)
- ✅ UI 컴포넌트는 적절한 레이어링

#### Gantt
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| GanttSettingsModal | z-[9998] | 설정 모달 |
| GanttChart (헤더) | z-40 | Sticky 헤더 |
| GanttChart (바) | z-10, z-50 | 간트 바 |
| GanttChart (툴팁) | z-[9999] | 호버 툴팁 |
| GanttTemplateSelector | z-10 | 버튼 |

**분석**: Calendar와 동일한 패턴, 일관성 있음.

---

### 3. 수업 (Class)

#### Timetable
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| **모달** |
| TimetableSettingsModal | z-[9998] | 설정 모달 |
| WeekdayOrderModal | z-[9998] | 요일 순서 모달 |
| **English Timetable** |
| StudentModal | z-[9998] | 학생 모달 |
| ScenarioManagementModal | z-[9998], z-[9999] | 시나리오 모달 (이중 레이어) |
| ScenarioCompareModal | z-[9998] | 비교 모달 |
| SimulationStudentModal | z-[9998] | 시뮬레이션 모달 |
| LevelSettingsModal | z-[9998] | 레벨 설정 모달 |
| LevelUpConfirmModal | z-[9998] | 레벨업 확인 모달 |
| TeacherOrderModal | z-[9998] | 교사 순서 모달 |
| MoveSelectionModal | z-[9998] | 이동 선택 모달 |
| EnglishExportModal | z-[9998] | 내보내기 모달 |
| BackupHistoryModal | z-[9998] | 백업 이력 모달 |
| MoveConfirmBar | z-50 | 이동 확인 바 |
| BatchInputBar | z-50 | 일괄 입력 바 |
| **Math Timetable** |
| MathStudentModal | z-[9998] | 학생 모달 |
| MathIntegrationViewSettings | z-50 | 통합 뷰 설정 |
| ScenarioManagementModal | z-[9998], z-[9999] | 시나리오 모달 (이중 레이어) |
| MathClassTab (드롭다운) | z-20 | 드롭다운 |
| TimetableGrid (헤더) | z-20, z-30 | Sticky 헤더/열 |
| **Generic Timetable** |
| TimetableGrid (헤더) | z-10 | Sticky 헤더 |
| **공통** |
| IntegrationClassCard (툴팁) | z-50 | 툴팁 |
| IntegrationClassCard (드롭다운) | z-20 | 드롭다운 |
| TimetableNavBar | z-30 | 네비게이션 바 |

**분석**:
- ✅ 대부분의 모달이 `z-[9998]` 사용
- ⚠️ ScenarioManagementModal이 내부 다이얼로그로 `z-[9999]` 사용 (적절함)
- ✅ 그리드/테이블 sticky 요소가 z-10~30 범위 사용 (적절함)

#### Attendance
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| **모달** |
| AttendanceSettingsModal | z-[9998] | 설정 모달 |
| SessionSettingsModal | z-[9998] | 세션 설정 모달 |
| AttendanceMigrationModal | z-[9998] | 마이그레이션 모달 |
| AddStudentToAttendanceModal | z-[9998] | 학생 추가 모달 |
| StudentModal | z-[9998] | 학생 모달 |
| StudentListModal | z-[9998] | 학생 목록 모달 |
| SettlementModal | z-[9998] | 정산 모달 |
| SalarySettings | z-[200] | 급여 설정 모달 ⚠️ |
| **테이블** |
| Table (헤더) | z-[100] | Sticky 헤더 ⚠️ |
| Table (고정열) | z-[110] | Sticky 열 ⚠️ |
| StudentRow (고정열) | z-[90] | Sticky 열 |
| Table (컨텍스트 메뉴) | z-50 | 우클릭 메뉴 |
| **기타** |
| AttendanceNavBar | z-30 | 네비게이션 바 |
| SessionSelector | z-50 | 드롭다운 |
| SalarySettingsTab (헤더) | z-20 | Sticky 헤더 |
| SalarySettings (툴팁) | z-10 | 툴팁 |

**분석**:
- ⚠️ **중요**: Attendance Table이 비표준 z-index 사용
  - 헤더: z-[100] (표준보다 높음)
  - 고정열: z-[110] (중첩을 위해 헤더보다 높음)
  - 행: z-[90]
- ⚠️ SalarySettings 모달이 z-[200] 사용 (너무 높음)
- 이유: 출석부 테이블이 스크롤 가능하며 sticky 헤더/열을 가지므로 다른 UI 요소와 분리 필요

#### Daily Attendance
출석부와 동일한 컴포넌트 사용, z-index도 동일.

#### Classes
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| AddClassModal | z-[9998] | 수업 추가 모달 |
| EditClassModal | z-[9998] | 수업 편집 모달 |
| ClassDetailModal | z-[9998] | 수업 상세 모달 |
| ClassSettingsModal | z-[9998] | 수업 설정 모달 |
| EnrollmentDiagnosticModal | z-[9998] | 등록 진단 모달 |
| ClassManagementTab (드롭다운) | z-50 | 드롭다운 |

**분석**: 표준을 잘 따름.

#### Classroom
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| ClassroomGrid (고정열) | z-20, z-30 | Sticky 열/헤더 |
| ClassroomToolbar (드롭다운) | z-50 | 드롭다운 |
| TimetableManager (로딩) | z-50 | 로딩 스피너 |

**분석**: 모달 없음, UI 요소만 있어 적절함.

#### Classroom Assignment
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| ApplyConfirmModal | z-50 | 확인 모달 ⚠️ |
| AssignmentGrid (고정열) | z-20, z-30 | Sticky 열/헤더 |
| AssignmentToolbar (드롭다운) | z-50 | 드롭다운 |
| ClassroomAssignmentTab (토스트) | z-50 | 토스트 알림 |

**분석**:
- ⚠️ ApplyConfirmModal이 z-50 사용 (표준은 z-[9998])

---

### 4. 학생 (Student)

#### Students
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| **모달** |
| AddStudentModal | z-50 | 학생 추가 모달 ⚠️ |
| StudentDetailModal | z-[9998] | 학생 상세 모달 |
| AssignClassModal | z-50 | 수업 배정 모달 ⚠️ |
| WithdrawalModal | z-[70] | 자퇴 모달 ⚠️ |
| StudentMigrationModal | z-50 | 마이그레이션 모달 ⚠️ |
| StudentMergeModal | z-50 | 학생 병합 모달 ⚠️ |
| StudentDataCleanupModal | z-50 | 데이터 정리 모달 ⚠️ |
| DuplicateNamesViewModal | z-50 | 중복 이름 모달 ⚠️ |
| DeleteInvalidStudentsModal | z-50 | 유효하지 않은 학생 삭제 모달 ⚠️ |
| BulkEnglishNameUpdateModal | z-50 | 영어 이름 일괄 변경 모달 ⚠️ |
| AttendanceNumberMigrationModal | z-50 | 출석번호 마이그레이션 모달 ⚠️ |
| EnglishClassAssignmentModal | z-50 | 영어 수업 배정 모달 ⚠️ |
| **성적 관련 모달 (tabs/grades)** |
| LevelTestModal | z-[9998] | 레벨 테스트 모달 |
| GoalSettingModal | z-[9998] | 목표 설정 모달 |
| CommentModal | z-[9998] | 코멘트 모달 |
| **기타** |
| StudentsNavBar | z-30 | 네비게이션 바 |
| StudentsNavBar (드롭다운) | z-50 | 드롭다운 |
| AttendanceTab (툴팁) | z-10 | 툴팁 |

**분석**:
- ⚠️ **중요 문제**: StudentManagement 모달들이 대부분 z-50 사용
  - 표준인 z-[9998]이 아님
  - WithdrawalModal은 z-[70] (완전히 다른 값)
- ✅ 성적 관련 모달(tabs/grades)은 표준 z-[9998] 사용

#### Consultation (등록 상담)
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| RegistrationMigrationModal | z-50 | 마이그레이션 모달 ⚠️ |
| ConsultationForm | z-50 | 상담 폼 모달 ⚠️ |
| ConsultationManager (버튼) | z-40 | 플로팅 버튼 |
| ConsultationManager (바텀바) | z-50 | 바텀 네비게이션 |
| ConsultationManager (로딩) | z-50 | 로딩 스피너 |
| ConsultationManager (헤더) | z-20 | Sticky 헤더 |
| ConsultationTable (헤더) | z-10 | Sticky 헤더 |

**분석**:
- ⚠️ 모달들이 z-50 사용 (표준 아님)

#### Student Consultations (학생 상담)
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| AddConsultationModal | z-[9998] | 상담 추가 모달 |
| ConsultationDetailModal | z-[9998], z-[60] | 상담 상세 모달 (이중 레이어) |
| ConsultationMigrationModal | z-[9998] | 마이그레이션 모달 |
| ConsultationManagementTab | z-30 | 네비게이션 |
| ConsultationManagementTab (드롭다운) | z-50 | 드롭다운 |

**분석**:
- ✅ 표준 z-[9998] 사용
- ConsultationDetailModal이 내부 모달로 z-[60] 사용 (적절함)

#### Grades
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| ExamCreateModal | z-[9998] | 시험 생성 모달 |
| AddScoreModal | z-[9998] | 성적 추가 모달 |
| GradesManager (사이드바) | z-50 | 학생 상세 사이드바 |
| GradesManager (헤더) | z-10 | Sticky 헤더 |
| ScoreInputView (드롭다운) | z-10 | 자동완성 |

**분석**: 표준을 잘 따름.

---

### 5. 관리 (Admin)

#### Payment (전자 결재)
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| PaymentReport (헤더) | z-30 | Sticky 헤더 |
| EntryForm | z-50 | 입력 폼 모달 ⚠️ |

**분석**:
- ⚠️ EntryForm이 z-50 사용 (표준 아님)

#### Staff
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| StaffForm | z-50 | 직원 폼 모달 ⚠️ |
| StaffViewModal | z-[9998], z-[60] | 직원 보기 모달 (이중 레이어) |
| StaffLinkModal | z-[9998] | 직원 연결 모달 |

**분석**:
- ⚠️ StaffForm이 z-50 사용 (표준 아님)
- ✅ StaffViewModal은 표준 사용, 내부 모달은 z-[60]

#### Billing
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| BillingForm | z-50 | 청구 폼 모달 ⚠️ |
| BillingImportModal | z-[9998] | 가져오기 모달 |
| BillingManager (로딩) | z-50 | 로딩 스피너 |

**분석**:
- ⚠️ BillingForm이 z-50 사용 (표준 아님)
- ✅ BillingImportModal은 표준 사용

#### Resources
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| ResourceAddModal | z-[9998] | 자료 추가 모달 |

**분석**: 표준을 잘 따름.

---

### 6. 시스템 (System)

#### Role Management
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| RoleManagementPage (헤더) | z-20 | Sticky 헤더 |
| RolePermissionsTab (헤더) | z-30 | Sticky 헤더 |
| RolePermissionsTab (고정열) | z-10, z-20 | Sticky 열 |

**분석**: 모달 없음, 적절한 레이어링.

---

### 7. 공통 컴포넌트 (Common)

#### Navigation
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| Sidebar (버튼) | z-50 | 모바일 메뉴 버튼 |
| Sidebar (오버레이) | z-40 | 오버레이 |
| Sidebar (사이드바) | z-40 | 사이드바 |
| TabGroupDropdown | z-50 | 드롭다운 |

**분석**: 적절한 레이어링.

#### Header
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| CalendarFilterBar | z-30 | 네비게이션 바 |
| CalendarFilterPopover | z-10 | 필터 팝오버 |
| TimetableNavBar | z-30 | 네비게이션 바 |
| AttendanceNavBar | z-30 | 네비게이션 바 |
| StudentsNavBar | z-30 | 네비게이션 바 |
| ProfileDropdown (오버레이) | z-[99998] | 오버레이 ⚠️ |
| ProfileDropdown (드롭다운) | z-[99999] | 드롭다운 ⚠️ |
| PermissionViewModal | z-[9998], z-[9999] | 권한 보기 모달 |
| MemoDropdown | (값 없음) | 메모 드롭다운 |

**분석**:
- ⚠️ **심각한 문제**: ProfileDropdown이 z-[99999] 사용
  - 다른 모든 컴포넌트보다 훨씬 높음
  - 필요 이상으로 높은 값

#### Common UI Components
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| Modal | z-[9998] | 공통 모달 컴포넌트 |
| ExportImageModal | z-[200] | 이미지 내보내기 모달 ⚠️ |
| Table | z-10 | Sticky 헤더 (optional) |
| TabSubNavigation | z-20 | 서브 네비게이션 |
| GridDropdown | z-50 | 그리드 드롭다운 |
| SkipLink | z-50 | 접근성 스킵 링크 |
| RoleSimulationBanner | z-[9999] | 역할 시뮬레이션 배너 |
| ErrorBoundary | z-50 | 에러 경계 |

**분석**:
- ✅ Modal 공통 컴포넌트는 표준 z-[9998] 사용
- ⚠️ ExportImageModal이 z-[200] 사용 (너무 높음)
- ⚠️ RoleSimulationBanner가 z-[9999] 사용

#### Auth
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| LoginModal | z-[100] | 로그인 모달 ⚠️ |
| PendingApprovalOverlay | z-50 | 승인 대기 오버레이 |

**분석**:
- ⚠️ LoginModal이 z-[100] 사용 (표준 아님)

#### Task/Memo
| 컴포넌트 | Z-Index | 용도 |
|---------|---------|------|
| MemoDetailModal | z-[9998] | 메모 상세 모달 |
| MemoSendModal | z-[9998] | 메모 전송 모달 |

**분석**: 표준을 잘 따름.

---

## Z-Index 레이어 구조

### 권장 레이어 구조
```
[99999] ProfileDropdown (극단값) ⚠️
[9999]  최상위 툴팁/배너 (WeekBlock, Gantt, RoleSimulationBanner)
[9998]  표준 모달 (대부분의 모달)
[200]   특수 모달 (SalarySettings, ExportImageModal) ⚠️
[110]   출석부 고정열 (Attendance Table)
[100]   출석부 헤더 / 로그인 모달 ⚠️
[90]    출석부 행 (StudentRow)
[70]    특수 모달 (WithdrawalModal) ⚠️
[60]    내부 모달 (ConsultationDetailModal, StaffViewModal)
[50]    드롭다운/사이드바/일부 모달 ⚠️
[40]    사이드바 오버레이/간트 헤더
[30]    네비게이션 바/Sticky 헤더
[20]    서브 네비게이션/테이블 헤더
[10]    Sticky 요소/툴팁/자동완성
```

### 실제 사용 현황

#### 레벨 1: z-10 (Sticky 요소, 툴팁, 자동완성)
- 테이블 헤더 (Common/Table)
- 툴팁 (다수)
- 자동완성 드롭다운 (다수)
- Sticky 요소 (다수)

#### 레벨 2: z-20 (서브 네비게이션, 테이블 복잡 헤더)
- TabSubNavigation
- 그리드 고정 열
- 테이블 헤더 (일부)

#### 레벨 3: z-30 (네비게이션 바)
- CalendarFilterBar
- TimetableNavBar
- AttendanceNavBar
- StudentsNavBar
- 테이블 고정 헤더 (RolePermissionsTab)

#### 레벨 4: z-40 (사이드바 오버레이)
- Sidebar 오버레이
- 간트 차트 sticky 헤더
- CalendarBoard 필터 UI

#### 레벨 5: z-50 (드롭다운, 일부 모달)
**드롭다운 (적절한 사용)**:
- 각종 드롭다운 메뉴
- 컨텍스트 메뉴
- 자동완성
- 검색 결과

**모달 (비표준 사용 ⚠️)**:
- StudentManagement 관련 모달 (10개+)
- 등록 상담 관련 모달 (2개)
- Billing/Payment 모달 (3개)
- Staff 모달 (1개)
- Auth 모달 (1개)
- 기타 확인/설정 모달 (다수)

#### 레벨 6: z-[60] (내부 모달)
- ConsultationDetailModal (내부)
- StaffViewModal (내부)

#### 레벨 7: z-[70] (특수 모달)
- WithdrawalModal ⚠️

#### 레벨 8: z-[90] ~ z-[110] (출석부 테이블)
- z-[90]: StudentRow 고정열
- z-[100]: Table 헤더
- z-[110]: Table 고정열

#### 레벨 9: z-[200] (특수 모달)
- SalarySettings ⚠️
- ExportImageModal ⚠️

#### 레벨 10: z-[9998] (표준 모달)
**대부분의 모달이 사용하는 표준값**:
- Calendar 모달 (5개)
- Timetable 모달 (20개+)
- Attendance 모달 (7개)
- Classes 모달 (5개)
- Student Consultations 모달 (3개)
- Grades 모달 (2개)
- Billing 모달 (1개)
- Staff 모달 (2개)
- Resources 모달 (1개)
- Common 모달 (3개)
- Settings 모달 (2개)
- 기타 모달 (10개+)

#### 레벨 11: z-[9999] (최상위 UI)
- WeekBlock 툴팁
- Gantt 툴팁
- RoleSimulationBanner
- PermissionViewModal (내부)
- ScenarioManagementModal (내부 다이얼로그)

#### 레벨 12: z-[99998] ~ z-[99999] (ProfileDropdown)
- ProfileDropdown 오버레이: z-[99998] ⚠️
- ProfileDropdown 드롭다운: z-[99999] ⚠️

---

## 충돌 및 문제점

### 🔴 심각한 문제

#### 1. ProfileDropdown 극단값
**문제**: `z-[99999]` 사용
- **위치**: Header/ProfileDropdown.tsx
- **이유**: 다른 모든 UI보다 위에 표시하기 위함
- **문제점**:
  - 필요 이상으로 높은 값
  - 미래에 더 높은 우선순위가 필요한 UI 추가 시 곤란
  - 일관성 없음
- **권장**: `z-[10000]` 또는 `z-[9999]`로 낮춤

#### 2. 모달 z-index 비일관성
**문제**: 모달이 여러 z-index 사용
- **z-[9998]** (표준): 60개+ 모달
- **z-50** (비표준): 20개+ 모달
- **z-[200]**: 2개 모달 (SalarySettings, ExportImageModal)
- **z-[100]**: 1개 모달 (LoginModal)
- **z-[70]**: 1개 모달 (WithdrawalModal)

**영향**:
- z-50 모달이 z-[9998] 모달 아래에 가려질 수 있음
- 모달 위에 모달이 필요한 경우 예측 불가능

**권장**: 모든 최상위 모달을 `z-[9998]`로 통일

#### 3. 출석부 테이블 특수 z-index
**문제**: z-[90], z-[100], z-[110] 사용
- **위치**: Attendance/components/Table.tsx, StudentRow.tsx
- **이유**: Sticky 헤더 + Sticky 열 조합
- **문제점**:
  - z-[100]이 일부 모달(z-50)보다 높음
  - 출석부가 열린 상태에서 일부 모달이 가려질 수 있음
- **권장**:
  - 출석부 내부 레이어를 z-10, z-20, z-30으로 낮춤
  - 또는 모달 z-index를 모두 z-[9998]로 통일

### ⚠️ 중간 문제

#### 4. StudentManagement 모달 비표준
**문제**: 10개+ 모달이 z-50 사용
- AddStudentModal
- AssignClassModal
- StudentMigrationModal
- StudentMergeModal
- DuplicateNamesViewModal
- 기타 6개+

**영향**:
- 다른 모달(z-[9998]) 아래에 가려질 수 있음
- 모달 중첩 시 예측 불가능

**권장**: z-[9998]로 변경

#### 5. 특수 모달 과도한 z-index
**문제**: SalarySettings(z-[200]), ExportImageModal(z-[200])
- **이유**: 출석부 테이블(z-[100~110]) 위에 표시하기 위함
- **문제점**:
  - 표준 모달(z-[9998])로도 충분함
  - 불필요하게 복잡한 레이어 구조

**권장**: z-[9998]로 변경

#### 6. 중복 레이어
**문제**: 동일한 용도에 여러 z-index 사용
- 모달: z-50, z-[60], z-[70], z-[100], z-[200], z-[9998], z-[9999]
- 드롭다운: z-10, z-20, z-50
- Sticky 헤더: z-10, z-20, z-30

**영향**: 일관성 없음, 유지보수 어려움

**권장**: 용도별 표준 z-index 정의 및 준수

### ✅ 경미한 문제

#### 7. 툴팁 z-index 불일치
**문제**: z-10, z-[9999] 혼용
- **z-10**: 일반 툴팁 (SalarySettings, AttendanceTab)
- **z-[9999]**: 최상위 툴팁 (WeekBlock, Gantt)

**영향**:
- 일반 툴팁이 일부 UI에 가려질 수 있음
- 최상위 툴팁은 문제없음

**권장**:
- 일반 툴팁: z-50
- 최상위 툴팁 (항상 보여야 함): z-[9999]

#### 8. 내부 모달 레이어
**문제**: z-[60], z-[9999] 혼용
- **z-[60]**: ConsultationDetailModal, StaffViewModal
- **z-[9999]**: ScenarioManagementModal, PermissionViewModal

**영향**:
- z-[60]이 일부 UI에 가려질 수 있음 (출석부 테이블 z-[100])

**권장**:
- 내부 모달 최소값을 z-[100] 이상으로 상향
- 또는 z-[9999]로 통일

---

## 권장사항

### 1. 표준 Z-Index 체계 정의

```typescript
// z-index-constants.ts
export const Z_INDEX = {
  // 기본 레이어
  TOOLTIP: 10,
  STICKY_HEADER: 20,
  NAVIGATION: 30,
  DROPDOWN: 50,

  // 출석부 특수 레이어 (필요시)
  ATTENDANCE_ROW: 15,
  ATTENDANCE_HEADER: 25,
  ATTENDANCE_FIXED_COL: 35,

  // 모달 레이어
  SIDEBAR: 1000,
  MODAL_BACKDROP: 9997,
  MODAL: 9998,
  MODAL_INNER: 9999,

  // 최상위 레이어
  BANNER: 10000,
  PROFILE_DROPDOWN: 10001,
} as const;
```

### 2. 우선순위별 수정 계획

#### Phase 1: 심각한 문제 (즉시 수정)
1. **ProfileDropdown** z-index 낮추기: z-[99999] → z-[10001]
2. **모든 모달** z-index 통일: z-[9998]
   - StudentManagement 모달 (z-50 → z-[9998])
   - 등록 상담 모달 (z-50 → z-[9998])
   - Billing/Payment 모달 (z-50 → z-[9998])
   - 특수 모달 (z-[70], z-[100], z-[200] → z-[9998])

#### Phase 2: 중간 문제 (가능한 빨리)
3. **출석부 테이블** z-index 재조정
   - Option A: z-[90~110] → z-[15~35] (권장)
   - Option B: 현재 유지, 모달만 z-[9998]로 통일
4. **내부 모달** z-index 통일: z-[9999]
5. **RoleSimulationBanner** z-index 조정: z-[9999] → z-[10000]

#### Phase 3: 경미한 문제 (점진적 개선)
6. **툴팁** z-index 표준화
   - 일반 툴팁: z-50
   - 최상위 툴팁: z-[9999]
7. **드롭다운** z-index 통일: z-50
8. **Sticky 헤더** z-index 통일: z-20 (일반), z-30 (네비게이션)

### 3. 코드 작성 가이드라인

#### 모달 작성 시
```tsx
// ✅ 권장
<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[8vh] z-[9998]">

// ❌ 비권장
<div className="fixed inset-0 bg-black/50 z-50">
```

#### 드롭다운 작성 시
```tsx
// ✅ 권장
<div className="absolute z-50 mt-1 bg-white shadow-lg">

// ❌ 비권장
<div className="absolute z-10 bg-white">
```

#### Sticky 헤더 작성 시
```tsx
// ✅ 권장 (일반)
<thead className="sticky top-0 z-20 bg-white">

// ✅ 권장 (네비게이션)
<nav className="sticky top-0 z-30 bg-gray-100">

// ❌ 비권장
<thead className="sticky top-0 z-10">
```

### 4. 테스트 체크리스트

수정 후 다음 시나리오 테스트:

1. **모달 중첩**
   - [ ] 모달 A 열기 → 모달 B 열기 → B가 A 위에 표시됨
   - [ ] ProfileDropdown이 모든 모달 위에 표시됨

2. **출석부 + UI**
   - [ ] 출석부 열기 → 모달 열기 → 모달이 출석부 위에 표시됨
   - [ ] 출석부 스크롤 → Sticky 헤더/열이 정상 작동
   - [ ] 출석부 + 드롭다운 → 드롭다운이 정상 표시됨

3. **네비게이션 + 드롭다운**
   - [ ] 네비게이션 바가 콘텐츠 위에 표시됨
   - [ ] 드롭다운이 네비게이션 위에 표시됨
   - [ ] 드롭다운이 다른 콘텐츠 아래로 가려지지 않음

4. **툴팁**
   - [ ] 일반 툴팁이 정상 표시됨
   - [ ] 툴팁이 드롭다운에 가려지지 않음
   - [ ] WeekBlock/Gantt 툴팁이 모달 위에 표시됨

5. **RoleSimulationBanner**
   - [ ] 배너가 모든 UI 위에 표시됨
   - [ ] ProfileDropdown이 배너 위에 표시됨

### 5. 리팩토링 우선순위

#### 긴급 (이번 주 내)
- [ ] ProfileDropdown z-index 수정
- [ ] StudentManagement 모달 z-index 통일

#### 높음 (2주 내)
- [ ] 모든 모달 z-index 통일 (z-[9998])
- [ ] 출석부 테이블 z-index 재조정

#### 중간 (1개월 내)
- [ ] 내부 모달 z-index 통일
- [ ] RoleSimulationBanner z-index 조정
- [ ] 툴팁 z-index 표준화

#### 낮음 (점진적)
- [ ] z-index 상수 파일 작성
- [ ] 모든 컴포넌트에 상수 적용
- [ ] 문서화 업데이트

---

## 요약 및 다음 단계

### 핵심 발견
1. **표준 준수율**: 약 70% (60개+ 모달 중 45개가 z-[9998] 사용)
2. **주요 문제**: StudentManagement, 등록 상담, Billing 모달이 비표준 z-50 사용
3. **심각한 문제**: ProfileDropdown z-[99999], 출석부 테이블 z-[100~110]

### 즉시 조치 필요
1. ProfileDropdown z-index 낮추기 (z-[99999] → z-[10001])
2. z-50 모달들을 z-[9998]로 변경 (20개+)
3. 테스트: 모달 중첩, 출석부 + 모달

### 장기 개선
1. z-index 상수 파일 작성 및 적용
2. 출석부 테이블 z-index 재설계
3. 툴팁/드롭다운 표준화

---

**보고서 작성일**: 2026-02-03
**분석 범위**: 135개 파일, 200+ z-index 사용처
**권장 완료일**: Phase 1 (1주), Phase 2 (2주), Phase 3 (1개월)
