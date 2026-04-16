# 에이와 인재원 학원 관리 시스템 — 전체 기능 상세 보고서

**작성일**: 2026-04-14
**시스템 버전**: v2026.04.14
**운영 URL**: https://ijw-calander.web.app
**테스트 URL**: https://ijw-calander-dev.web.app

---

## 서론

에이와 인재원 학원 관리 시스템은 학원 운영에 필요한 모든 기능을 하나의 웹 플랫폼에서 통합 관리할 수 있도록 설계된 엔터프라이즈급 관리 시스템이다. 이 시스템은 33개의 주요 메뉴, 100개 이상의 세부 권한, 40개 이상의 Firestore 컬렉션, 100개가 넘는 커스텀 React 훅으로 구성되어 있으며, 수학·영어·과학·국어 등 다양한 과목의 시간표 관리부터 학생 등록, 출결 관리, 성적 관리, 수강료 계산, 상담 녹음 AI 분석, 외부 시스템(메이크에듀, 구글 캘린더, Edutrix) 연동까지 학원 운영의 모든 영역을 포괄한다.

본 보고서는 이 시스템의 전체 기능을 빠짐없이 정리하여, 새로 합류하는 개발자나 관리자가 시스템을 전반적으로 이해할 수 있도록 하는 것을 목적으로 한다. 각 기능의 세부 동작, 관련 파일, 연관 관계, 그리고 현재 개발 중이거나 미완성된 부분까지 상세히 기술한다.

---

## 1. 시스템 아키텍처 개요

### 1.1 기술 스택

프론트엔드는 **React 18 + TypeScript**를 기반으로 하며, 빌드 도구로는 **Vite**를 사용한다. Vite의 강력한 번들 분할 기능을 활용하여 초기 로딩 시간을 최소화하고, 탭별로 컴포넌트를 동적 import하여 필요한 코드만 로드하는 구조다. 스타일링은 **Tailwind CSS**를 메인으로 사용하되, 복잡한 인터랙션이나 CSS 우선순위 문제를 해결해야 할 때는 인라인 스타일을 병행한다. 상태 관리는 서버 데이터의 경우 **React Query (TanStack Query)**를 사용하여 30분 staleTime으로 캐싱하며, 시뮬레이션 모드나 권한 같은 전역 상태는 **Context API**로 관리한다.

백엔드는 **Firebase** 생태계를 전면적으로 활용한다. **Firestore**는 메인 데이터베이스로 40개 이상의 컬렉션을 관리하며, **Firebase Auth**는 구글 로그인과 이메일/비밀번호 로그인을 지원한다. **Cloud Functions**는 `asia-northeast3` (서울) 리전에 배포되어 있으며 Gen1 기반으로 동작한다. 메이크에듀 크롤링, 상담 AI 분석, 학년 일괄 진급 같은 복잡한 서버 사이드 작업을 처리한다. API 키(Claude, AssemblyAI, MakeEdu 로그인 정보)는 **Firebase Secret Manager**에 안전하게 보관된다. 배포는 **Firebase Hosting**을 사용하며 prod(`ijw-calander.web.app`)와 dev(`ijw-calander-dev.web.app`) 두 사이트로 분리 운영한다. 두 사이트는 동일한 Firestore DB를 공유하므로 코드는 분리되지만 데이터는 통합된 채 운영된다.

AI 통합 측면에서는 **Claude API (Anthropic)**를 활용하여 상담 녹음과 회의 녹음으로부터 자동 보고서를 생성하고, **AssemblyAI**로 음성인식 및 화자 구분을 수행한다. 추가로 **Google GenAI**를 일부 부가 기능에 활용한다. 크롤링 영역에서는 **Puppeteer + @sparticuz/chromium**을 Cloud Functions에 탑재하여 메이크에듀의 봇 탐지(NO_REJECT)를 우회하는 헤드리스 브라우저 로그인을 구현했다.

데이터 처리 도구로는 **jsPDF와 html2canvas**를 PDF 생성에, **xlsx** 라이브러리를 엑셀 import/export에, **date-fns**를 KST 기반 날짜 처리에, **Recharts**를 차트 시각화에 사용한다.

### 1.2 핵심 구성 요소

사용자가 웹사이트에 접속하면 먼저 `App.tsx`가 마운트된다. 이 컴포넌트는 다음과 같은 역할을 수행한다. 첫째, URL에 특정 쿼리 파라미터가 있으면 임베드 모드로 전환하여 `EmbedRouter`를 통해 공개 공유 페이지를 렌더링한다. 둘째, Firebase Auth로 현재 사용자를 확인하고, 프로필이 없으면 로그인 모달을 표시한다. 셋째, 승인 대기 상태(`user` 역할)인 경우 `PendingApprovalOverlay`를 표시한다. 넷째, 승인된 사용자는 정식 UI로 진입하여 좌측 사이드바, 상단 헤더, 메인 탭 콘텐츠, 모달 매니저, 전역 챗봇을 볼 수 있다.

좌측 사이드바(`Sidebar.tsx`)는 8개 그룹 33개 탭을 표시하며, 사용자 권한에 따라 접근 가능한 탭만 필터링된다. 상단 헤더(`AppHeader.tsx`)는 현재 선택된 탭에 따라 과목 필터, 부서 필터, 날짜 선택자 등 탭별 맞춤 필터를 보여준다. 메인 콘텐츠 영역(`TabContent.tsx`)은 현재 탭 이름을 받아 해당 컴포넌트를 렌더링하는 라우터 역할을 한다. 모든 모달(로그인, 권한 조회, 설정, 캘린더 이벤트 등)은 `ModalManager.tsx`에서 중앙 관리된다. 전역 챗봇은 `chatbot.access` 권한이 있는 사용자에게만 표시되는 AI 어시스턴트다.

### 1.3 주요 Firestore 컬렉션

데이터는 40개 이상의 Firestore 컬렉션에 분산 저장된다. 가장 중요한 컬렉션들을 그룹별로 정리하면 다음과 같다.

**수업 관련 컬렉션**에는 `classes`(수업/반 정보 — 과목, 교사, 스케줄, 강의실), `students/{id}/enrollments`(학생별 수강 정보 subcollection), `classroom`(강의실 목록), `attendance`(출석부 기록), `timetable_sessions`(세션별 시간표), `math_scenarios`와 `english_simulation_scenarios`(시뮬레이션 시나리오 저장소)가 있다.

**학생 관련 컬렉션**에는 `students`(학생 기본 정보), `shuttle_students`(셔틀버스 탑승 학생), `consultations`(등록 상담), `student_consultations`(재원생 상담), `consultation_reports`(AI 생성 상담 보고서), `grades`(성적 기록), `contracts`(계약서 관리)가 있다.

**교재 및 시험 관련**으로는 `textbook_catalog`(교재 카탈로그), `textbook_billings`(교재 수납 내역), `textbook_requests`(교재 요청), `exams`(시험 정보), `exam_series`(시험 시리즈), `homework`(숙제 관리)가 있다.

**재무 및 직원 관련**으로는 `billing`(수납 내역), `payroll`(급여 관리), `expenses`(지출 내역), `staff`(직원 프로필), `staff_leaves`(직원 휴무), `staffIndex`(직원 인덱스)가 있다.

**일정 및 이벤트 관련**으로는 `events`(캘린더 이벤트), `archived_events`(보관된 이벤트), `bucket_items`(버킷 아이템), `holidays`(공휴일), `gantt_projects`(간트 프로젝트), `gantt_templates`(간트 템플릿)가 있다.

**AI 및 미디어 관련**으로는 `consultation_reports`(상담 AI 보고서), `meeting_reports`(회의 AI 보고서)가 있으며, 녹음 파일 자체는 Firebase Storage에 저장된다.

**커뮤니케이션 관련**으로는 `notices`(공지사항), `parent_links`(학부모 링크), `parent_messages`(학부모 메시지), `notifications`(알림 이력)이 있다.

**설정 및 시스템 관련**으로는 `settings/permissions_config`(권한 설정), `settings/math_config`(수학 시간표 설정), `settings/english_config`(영어 시간표 설정), `resources`(자료실 파일), `departments`(부서 정보)가 있다.

---

## 2. 권한 및 인증 체계

권한 시스템은 이 프로젝트의 근간을 이루는 가장 중요한 요소 중 하나이다. 8단계 역할 계층과 100개 이상의 세부 권한으로 구성되어 있으며, 각 사용자에게 적절한 수준의 접근을 제공한다.

### 2.1 역할 계층

최상위에는 **master** 역할이 있으며, 이는 시스템의 모든 권한을 가진 최고 관리자다. Master는 다른 역할로 시뮬레이션할 수 있는 특별한 기능을 가지고 있어, 예를 들어 "수학선생님 권한으로 로그인했을 때 어떤 화면이 보이는지" 미리 확인할 수 있다. 시뮬레이션 상태는 화면 상단에 주황색 배너로 표시된다.

그 다음은 **admin**으로, 권한 변경(`users.change_permissions`)과 역할 관리(`roles.*`)를 제외한 거의 모든 권한을 가진다. 일반적인 학원 관리자가 이 역할을 맡는다.

**manager**는 직원 관리, 급여, 역할 관리 등 민감한 영역을 제외한 대부분의 기능에 접근할 수 있다. 중간 관리자 포지션에 적합하다.

과목별 팀장 역할로는 **math_lead**(수학팀장)와 **english_lead**(영어팀장)가 있으며, 자기 과목 영역 전체와 일부 관리 기능을 담당한다. 일반 교사 역할은 **math_teacher**와 **english_teacher**로, 자기 과목의 수업/출석/학생 조회 권한만 가진다.

최하위에는 **user** 역할이 있으며, 이는 가입 후 승인 대기 상태의 사용자다. 기본 로그인과 조회만 가능하다.

레거시 호환을 위해 `teacher`, `staff`, `editor`, `senior_staff`, `viewer` 같은 구버전 역할도 일부 유지되고 있다.

### 2.2 권한 ID 체계

권한 ID는 `[도메인].[리소스].[액션]` 형식을 따른다. 주요 도메인을 살펴보면 다음과 같다.

**시간표 관련 권한**으로는 `timetable.math.view/edit/simulation`이 있어 수학 시간표 조회/수정/시뮬레이션을 각각 제어한다. 영어는 `timetable.english.view/edit/simulation/backup.view/backup.restore`로 백업 기능까지 세분화되어 있으며, 과학과 국어는 view/edit만 있다. 통합뷰는 별도로 `timetable.integrated.view`가 있다.

**학생 관련 권한**으로는 기본적인 `students.view/edit/delete`와 `students.manage_class_history`(수강 이력 관리), `students.edit_enrollment_dates`(등록일 편집), `students.migration`(마이그레이션), `students.duplicate_check`(중복 검사), `students.cleanup`(데이터 정리) 같은 전문 권한이 있다.

**출석 관련 권한**은 과목별로 세분화되어 있다. `attendance.manage_math/english/science/korean`처럼 자기 담당 과목만 수정할 수 있도록 제한할 수 있다. `attendance.edit_all`은 모든 과목을 관리할 수 있는 상위 권한이다.

**이벤트 관련 권한**으로는 `events.create`, `events.manage_own`(본인 이벤트만), `events.manage_others`(타인 이벤트도), `events.drag_move`(드래그 이동), `events.attendance`(출석 이벤트), `events.bucket`(버킷 관리)이 있다.

**기타 도메인**으로는 `departments.*`, `users.*`, `system.*`, `gantt.*`, `classes.*`, `classroom.*`, `consultation.*`, `student_consultations.*`, `grades.*`, `billing.*`, `withdrawal.*`, `resources.*`, `roles.*`, `daily_attendance.*`, `homework.*`, `exams.*`, `textbooks.*`, `contracts.*`, `reports.*`, `notices.*`, `parent_portal.*`, `notifications.*`, `payment.*`, `analytics.*`, `payroll.*`, `shuttle.*`, `marketing.*`, `recording.*`, `meeting.*`, `staff.*`, `timetable_distribution.*`, `chatbot.*`, `tuition.*`, `expenses.*` 등 도메인별로 수많은 권한이 정의되어 있다.

### 2.3 인증 흐름

사용자가 로그인하면 Firebase Auth가 Google 또는 이메일/비밀번호로 인증을 수행한다. 인증이 성공하면 `staff` 컬렉션에서 해당 사용자의 프로필을 조회한다. 프로필이 없거나 승인 대기 상태면 `PendingApprovalOverlay`가 표시되어 관리자 승인을 기다려야 한다. 승인된 사용자는 역할과 권한이 확인되고, 이를 기반으로 `accessibleTabs` 배열이 계산되어 사이드바에 표시될 탭이 결정된다. Master 계정의 경우 추가로 역할 시뮬레이션 기능이 활성화된다.

### 2.4 권한 관리 UI

**RoleManagementPage**는 관리자가 각 역할의 권한을 ON/OFF할 수 있는 화면이다. 100개 이상의 권한을 체크박스로 관리하며, 변경 사항은 `settings/permissions_config` 문서에 저장된다. **TabPermissionConfig**는 탭별로 어떤 역할이 접근할 수 있는지 설정하는 기능이다. **PermissionViewModal**은 현재 로그인한 사용자가 자신의 권한을 조회할 수 있는 모달이다.

---

## 3. 전체 메뉴 — 8개 그룹, 33개 탭

### 3.1 홈 그룹

**대시보드** (`dashboard`) 탭은 로그인 후 가장 먼저 마주하는 화면으로, 역할에 따라 다른 위젯이 표시된다. Master와 Admin에게는 전체 학원의 KPI 카드(재원생/신입/퇴원/매출)가 보이며, Manager는 담당 부서의 현황을, Teacher는 본인이 담당하는 수업과 학생 목록을 볼 수 있다. 공통으로 오늘 일정, 최근 활동 로그, 자주 사용하는 탭의 바로가기도 제공된다.

**공지사항** (`notices`) 탭은 학원 내부 공지사항을 CRUD로 관리한다. 중요 공지는 상단에 pin할 수 있으며, 각 사용자의 읽음 상태가 추적된다.

### 3.2 일정 그룹

**연간 일정** (`calendar`) 탭은 이 시스템의 핵심 기능 중 하나로, 학원의 모든 이벤트를 관리한다. 가장 독특한 기능은 **3단 달력 뷰**로, 현재·1년 전·2년 전 달력을 동시에 표시하여 과거 같은 시기의 이벤트와 비교할 수 있다. 뷰 모드는 월간/주간/일일/리스트 4가지를 지원하며, 이벤트를 드래그앤드롭으로 다른 날짜로 이동시킬 수 있다. **버킷 시스템**은 임시로 이벤트를 보관할 수 있는 공간으로, 아직 확정되지 않은 일정을 모아둘 때 유용하다. 필터는 부서별(수학/영어/과학/국어 등), 카테고리별(시험/이벤트/휴무 등), 즐겨찾기, 보관 포함/제외 등 다양하게 제공된다. **Google Calendar와의 양방향 동기화**도 지원하여, 외부에서 일정을 추가해도 시스템에 자동 반영된다. 관련 Hook으로는 `useEventCrud`, `useArchivedEvents`, `useBucketItems`, `useHolidays`가 있다.

**간트 차트** (`gantt`) 탭은 프로젝트 단위 작업 관리 도구다. 학원의 장기 프로젝트(신학기 오픈 준비, 교재 개편 등)를 시각적으로 관리할 수 있으며, 반복 작업을 위한 템플릿 시스템을 갖추고 있다. `useGanttProjects`, `useGanttCategories`, `useGanttDepartments`, `useGanttTemplates` 훅으로 데이터를 관리한다.

### 3.3 수업 그룹 — 가장 복잡한 영역

**시간표** (`timetable`) 탭은 이 시스템에서 가장 복잡하고 중요한 기능이다. 상단 드롭다운에서 과목을 선택할 수 있으며, 수학/고등수학/영어/과학/국어/셔틀버스/전체 중 하나를 고를 수 있다. 과목 옆에는 **뷰 선택 드롭다운**이 있어 같은 과목 내에서도 여러 표시 방식을 선택할 수 있다.

각 과목의 기본뷰는 최근 정리되었다. 수학은 **엑셀(강사)**이 기본뷰이며, 엑셀(요일)/강의실뷰/통합뷰는 "개발중" 카테고리로 분리되어 있다. 고등수학은 **엑셀(요일)**이 기본뷰이고 나머지는 개발중이다. 영어는 **엑셀**이 기본뷰이고 통합뷰/강사/강의실이 개발중이다. 이 드롭다운은 `createPortal`로 body에 직접 렌더링되어 테이블의 `overflow` 속성에 가려지지 않는다. 과목을 전환하면 자동으로 해당 과목의 기본뷰로 진입한다.

수학 시간표는 `components/Timetable/Math/` 폴더에 집중되어 있다. 핵심 컴포넌트는 `TimetableHeader.tsx`(상단 통계/필터/모드 토글), `TimetableGrid.tsx`(교사/강의실/엑셀 뷰 본체), `ClassCard.tsx`(개별 수업 카드 — 학생 리스트 표시), `MathClassTab.tsx`(통합뷰 — 수업 단위 카드 레이아웃)이다.

시간표의 주요 기능을 나열하면 다음과 같다.

첫째, **조회/수정 모드 토글**이 있어 의도치 않은 수정을 방지한다. 수정 모드에서만 드래그나 삭제가 가능하다.

둘째, **학생 통계 배지**가 상단 헤더에 표시된다. 재원(현재 등록 학생, 녹색), 신입(30일 이내 등록, 반이동 제외, 핑크), 예정(대기+퇴원예정, 앰버), 퇴원(30일 이내 퇴원, 회색) 4가지 카테고리로 구분되며, 각 배지를 클릭하면 상세 학생 목록 드롭다운이 나타난다. 통계 계산 로직은 최근 개선되어, 한 학생이 여러 반에 등록된 경우 "먼저 발견된 반 기준"이 아니라 "활성 상태 우선" 로직을 사용한다. 또한 기준일은 `getWeekReferenceDate` 함수로 계산되어, 이번 주는 오늘, 과거 주는 해당 주 일요일, 미래 주는 해당 주 월요일을 기준으로 한다.

셋째, **드래그 앤 드롭 학생 이동**이 핵심 인터랙션이다. 학생을 다른 반으로 드래그하면 이전 위치의 학생은 취소선과 회색 배경으로 표시되고, 이동한 위치에는 보라색 배경이 적용된다. 여러 건의 이동을 대기 상태로 모아두었다가 저장 버튼을 눌러 일괄 반영할 수 있다. 저장 시 Firestore에서는 기존 enrollment 문서의 endDate를 어제 날짜로 설정하고, 새 enrollment 문서를 새 classId로 생성하는 "분리 저장" 방식을 사용한다. 이를 통해 반이동의 흔적을 데이터에 남긴다. 최근에 `React.memo` 비교 함수 수정과 인라인 스타일 강제 적용을 통해 취소선이 제대로 표시되지 않던 버그를 해결했다.

넷째, **엑셀 모드 전용 키보드 단축키**가 있다. 셀을 클릭하면 선택되고, Shift+클릭이나 Ctrl+클릭으로 다중 선택이 가능하다. Ctrl+C/X/V로 학생을 복사·잘라내기·붙여넣기할 수 있으며, Del 키로 선택한 학생을 보류 삭제 목록에 추가할 수 있다(저장 시 실행). Ctrl+Z는 마지막 작업을 취소하며, 시뮬레이션 모드에서는 시뮬레이션의 Undo를 호출한다. Tab/Enter로 셀 간 이동이 가능하고, 자동완성 하이라이트 기능으로 다른 반에 같은 학생이 있으면 빨간색으로 표시된다.

다섯째, **필터 시스템**이 풍부하다. 강의실 필터(본원/바른/고등), 학교별 필터(초/중/고등학교명), 학년별 필터, 셔틀탑승 필터(메이크에듀 연동 데이터 기반, 노란색 배지), 출석 필터(지각/결석 — `useWeeklyAbsentStudents` 훅으로 주간 데이터 조회) 등이 제공된다. **병합 셀 기능**은 합반 수업을 하나의 셀로 통합 표시할 수 있게 해준다.

여섯째, **시나리오 시뮬레이션**은 최근 대폭 강화되었다. `SimulationContext.tsx`에서 관리하는 메모리 기반 편집 환경으로, 실시간 데이터와 분리되어 안전하게 "학기 시뮬레이션"을 수행할 수 있다. 진입 시 실시간 데이터를 메모리로 복사하고, 주황색 헤더와 "SIMULATION" 펄스 배지가 표시된다. 편집 가능한 작업은 학생 이동, 수업 추가/삭제, 반 이름 변경(레벨업), 학생 추가/제거 등이다. **Undo/Redo**가 Ctrl+Z/Y로 작동하며 최대 20단계의 히스토리를 유지한다. **충돌 감지** 기능은 시뮬레이션 편집 중 실시간 데이터가 변경되면 이를 감지하여 반영 시 사용자에게 선택지를 제공한다. 반영 모드는 3가지(덮어쓰기/병합/취소)이며, 반영 전 자동으로 백업이 생성된다. 시나리오는 `math_scenarios` 컬렉션에 저장되고, 저장된 시나리오를 불러와서 다시 편집할 수도 있다. 영어 시뮬레이션은 이에 더해 시나리오 비교(`ScenarioCompareModal`) 기능까지 갖추고 있지만, 수학에는 아직 시나리오 비교 기능이 없다.

영어 시간표는 `components/Timetable/English/` 폴더에 있으며 `EnglishTimetable.tsx`가 메인이다. 통합뷰(`EnglishClassTab`), 엑셀뷰, 강사뷰, 강의실뷰 4가지를 지원하며, 시뮬레이션은 수학과 동일한 수준으로 완성되어 있다. 추가로 `timetable.english.backup.view/restore` 권한이 있어 백업 조회와 복원이 가능하다. 진도 보고서(`en_reports` 테이블)를 연동하여 각 반의 최근 진도를 툴팁으로 표시한다.

셔틀 시간표는 `components/Timetable/Shuttle/ShuttleTimetable.tsx`에서 관리된다. **메이크에듀 동기화 버튼**을 누르면 Cloud Function이 실행되어 셔틀 탑승 학생 목록을 업데이트한다. 최근 개편된 로직은 학생 목록 페이지가 아닌 **상세수납 페이지(`/pay/payUnionDeList.do`)**를 Puppeteer로 접속하여, 수업명에 "셔틀"/"스쿨버스"/"통학버스"가 포함된 수납 항목의 학생명을 추출한다. 월별 로직은 특별히 신경 써서 설계되었다. 매월 1일부터 10일까지는 전월과 당월을 모두 조회(중복 제거)하고, 11일부터는 당월만 조회한다. `fromYm` 입력값을 전월로 변경하여 조회 범위를 자동으로 조정한다. 셔틀 시간표 자체는 시간대(14/16/18/20/22시) × 요일(월~금) 그리드로 표시되며, 학생별로 본원/바른학습관 위치를 자동 판정하고 같은 날 두 위치를 오가는 이동 학생도 자동 감지한다. 필터는 등원/하원/본원(수학)/본원(영어)/바른학습관/강의실이동으로 다중 선택이 가능하다. 크롤링 함수의 실행 시간은 약 85초이며, 클라이언트 측 `httpsCallable` 타임아웃을 300초로 설정하여 시간초과를 방지했다.

**통합 시간표**(`AllSubjectsTimetable.tsx`)는 모든 과목을 하나의 그리드에 표시하여 교사 간 스케줄 충돌을 확인할 수 있다. 과목별로 다른 색상으로 구분되며 이미지로 내보내기가 가능하다.

시간표 관련 훅은 매우 많다. `useSubjectClassStudents`(과목별 반-학생 매핑의 핵심 훅), `useMathClassStudents`(수학 전용 래퍼), `useTimetableClasses`(수업 조회), `useClassOperations`(학생 등록/퇴원/반이동 CRUD), `useStudentDragDrop`(드래그 상태와 pending moves 관리), `useWeeklyAbsentStudents`(주간 결석 학생), `useShuttleNames`(셔틀 탑승 학생 이름 Set), `useTimetableLog`(변경 이력 기록) 등이 있다.

**출석부** (`attendance`) 탭은 `AttendanceManager.tsx`에서 관리되며, 월간/세션 기반 출석부를 제공한다. 과목별로 분리되어 있으며(수학/영어), 세션 기반으로 수업 빈도(매주/격주 등)에 따라 자동 배치된다. 주요 모달로는 `AttendanceMigrationModal`(학년 진급 시 출석 이관), `AttendanceSettingsModal`(설정), `SessionSettingsModal`(세션 관리), `SettlementModal`(정산 계산), `AddStudentToAttendanceModal`(학생 추가)이 있다. 훅으로는 `useAttendance`, `useSessionPeriods`, `useBatchAttendanceUpdate`(배치 업데이트), `useVisibleAttendanceStudents`(표시 학생 필터)가 있다.

**출결 관리** (`daily-attendance`) 탭은 일일 단위로 지각/조퇴/결석을 마킹하는 화면이다. 수업 리포트(`reports`, `en_reports` 테이블)와 연동되며, SMS 자동 발송과 연결할 수 있다.

**수업 관리** (`classes`) 탭은 수업(반)의 CRUD 기능을 제공한다. 수업 추가 시 교사/교재/강의실을 배정하고, 상세 모달에서 학생 추가 시 소속 뱃지(SubjectBadges)가 표시된다. 병합 수업(합반) 설정도 여기서 관리된다. 훅은 `useClasses`, `useClassMutations`, `useClassDetail`, `useClassStats`, `useClassTextbookMap`을 사용한다.

**강의실** (`classroom`)과 **강의실 배정** (`classroom-assignment`) 탭은 물리적 강의실 목록을 관리하고, 슬롯별로 강의실을 자동 배정하며 충돌을 감지한다.

**숙제 관리** (`homework`) 탭은 학생별 숙제 부여, 확인, 채점 기능을 제공한다. `useHomework` 훅을 사용한다.

**시험 관리** (`exams`) 탭은 시험 일정 관리와 시험 시리즈(중간고사/기말고사 묶음) 관리를 담당한다. 훅은 `useExams`, `useExamSeries`, `useExamsByDate`이다.

**교재 관리** (`textbooks`) 탭은 `TextbooksTab.tsx`에서 관리된다. 4가지 뷰(교재 목록/교재 요청/수납 내역/요청 내역)를 탭으로 전환할 수 있다. 교재 목록은 과목/학년/난이도별로 분류되며, 가격 수정이 가능하다. 최근 추가된 **가격 변동 이력** 기능이 특히 유용하다. 테이블에 "수정일" 컬럼이 있고, 클릭하면 fixed 위치의 팝업으로 변동 이력이 표시된다. 최근 2건만 기본 표시되고 그 이상이면 "이전 이력 N건 더보기" 버튼이 나타난다. `priceHistory` 배열에 모든 변동 이력이 누적 저장되며, 레거시 데이터(`previousPrice`, `lastPriceUpdatedAt`)와도 호환된다. 교재 요청 기능은 학생별로 필요한 교재를 요청 생성하고, 승인/주문/완료 워크플로우를 관리한다. 수납 내역에서는 월별 교재비 정산 현황을 확인하고, 학생 매칭이 자동으로 이루어지며(UserCheck 아이콘), 30건/페이지 페이지네이션이 적용되어 있다. 훅은 `useTextbooks`, `useTextbookRequests`를 사용한다.

### 3.4 학생 그룹

**학생 관리** (`students`) 탭은 이 시스템의 가장 방문이 잦은 화면 중 하나다. `StudentManagementTab.tsx`가 메인이며, 화면은 좌측 학생 리스트와 우측 상세 정보로 나뉜다. 좌측에서는 학교/학년/반/상태별로 필터링할 수 있고, 이름/등록일/출석률로 정렬하며 검색도 가능하다. 학생 상태는 재원(Active), 대기(Pending), 예정(Scheduled), 퇴원(Withdrawn)으로 구분되어 색상으로 표시된다.

우측 상세 정보는 7개 탭으로 구성된다.

**1번 기본정보 탭** (`BasicInfoTab.tsx`)은 이름, 영어이름, 성별, 학교, 학년, 졸업연도 같은 기본 정보와 원생/보호자/기타 연락처, 주소, 생년월일, 닉네임, 이메일을 표시한다. 알림 설정(SMS/푸시/알림톡)과 수납 설정(청구일/할인)도 여기서 관리된다. 최근에 추가된 **등하원 정보** 섹션은 등원 시간(09:00~23:00, 30분 단위)과 하원 시간(10:00~23:00)을 선택할 수 있게 하며, "셔틀탑승/자가등원/부모픽업/도보/지각잦음/일찍하원/늦은하원/차량이동" 같은 특이사항 태그를 여러 개 선택할 수 있다. 이 정보는 시간표의 학생 툴팁에도 표시된다. 폼 초기화 시 `arrivalTime`, `departureTime`, `transportTags` 필드가 누락되어 수정 모드에서 값이 안 뜨던 버그가 최근 수정되었다.

**2번 수강 기록 탭**은 반별 수강 이력을 연표 형식으로 표시한다. 입학일, 종료일, 월별 출석/결석/지각 통계를 볼 수 있다.

**3번 수납 내역 탭**은 월별 수납 기록과 미납 현황, 할인 적용 내역을 표시한다.

**4번 상담 내역 탭**은 등록 상담과 학생 상담을 통합하여 시간순으로 보여주며, 녹음 파일 링크와 AI 생성 보고서도 연결된다.

**5번 수강 과목 탭**은 현재 등록된 모든 수업을 나열하고, 각 수업에 과목별 소속 뱃지가 표시된다.

**6번 성적 탭**은 시험별 성적 기록을 표시하고 평균과 등수를 시각화하며, 학년별 성적 추이를 차트로 보여준다.

**7번 교재 탭**은 월별로 받은 교재 목록과 미청구 교재를 표시한다.

주요 모달로는 `AddStudentModal`(학생 추가), `AssignClassModal`(수강 배정 — 수업 상세 페이지에서도 소속 뱃지 표시), `StudentMigrationModal`(학년 일괄 진급), `StudentMergeModal`(중복 학생 병합), `DuplicateNamesViewModal`(중복명 조회), `MakeEduSyncModal`(메이크에듀 학생 DB 연동), `GodeungMakeEduSyncModal`(고등부 전용 연동), `StudentDataCleanupModal`(고아 enrollment 정리)이 있다.

핵심 훅은 다음과 같다. `useStudents`는 전체 학생 목록을 조회하고, `useStudentFilters`는 필터링 로직을 관리하며, `useStudentBilling`/`useStudentConsultations`/`useStudentGrades`/`useStudentReports`/`useStudentTextbooks`는 각 탭의 데이터를 제공한다. `useGradePromotion`은 학년 진급 로직을 처리하고, `useEnrollmentIntegrity`는 하루에 한 번 자동으로 고아 enrollment를 검출하여 데이터 무결성을 유지한다.

**등록 상담** (`consultation`) 탭은 `ConsultationManager.tsx`에서 관리되는 신규 문의/상담 관리 화면이다. 가장 인상적인 기능은 **음성 녹음 상담**으로, `useConsultationRecording` 훅을 통해 웹 MediaRecorder로 녹음을 진행하고 Firebase Storage에 업로드한다. 업로드된 녹음 파일은 AssemblyAI로 전송되어 음성인식과 화자 구분이 이루어지며, 생성된 transcript는 Claude API(Sonnet 모델)로 보내져 자동 보고서가 생성된다. 보고서에는 학생/학부모의 요구사항, 상담 포인트, 액션 아이템이 포함된다. 상담을 진행하다가 정식 학생 등록으로 전환할 수 있으며, 임시저장(`useConsultationDrafts`)도 지원된다. 통계 훅(`useConsultationStats`)으로 월별 상담 건수와 전환율을 확인할 수 있다.

**학생 상담** (`student-consultations`) 탭은 재원생 상담을 관리하는 별도 화면이다. 학부모 상담 이력도 기록할 수 있으며, 학생 상세 페이지의 "상담 내역 탭"과 연동된다.

**성적 관리** (`grades`) 탭은 `GradesManager.tsx`에서 관리되며 시험별 성적 입력과 학생별/반별 성적 조회를 제공한다. 서브 모달로는 `CommentModal`(성적 코멘트 작성), `GoalSettingModal`(목표 점수 설정), `LevelTestModal`(수준 평가)이 있다.

**퇴원 관리** (`withdrawal`) 탭은 퇴원생을 기간/반/사유별로 조회할 수 있게 해준다. 퇴원 처리 시 `endDate`와 `withdrawalDate`를 모두 **전날 날짜**로 설정하는데, 이는 "오늘부터 바로 퇴원 처리"를 의미하며 같은 날 통계에서 퇴원생으로 집계된다. 복구 처리는 `withdrawal.reactivate` 권한이 필요하며 `WithdrawalStudentDetail.tsx` 상세 모달에서 수행할 수 있다. 훅은 `useWithdrawalFilters`, `useWithdrawalStats`를 사용한다.

**계약 관리** (`contracts`) 탭은 정식 계약서를 관리한다. `useContracts` 훅을 사용한다.

**학습 리포트** (`reports`) 탭은 학생별 학습 리포트를 생성하고 PDF로 출력한다. 학부모 전송과도 연동된다.

### 3.5 관리 그룹

**수강료 현황** (`payment`) 탭은 월별 수강료 현황과 반별 매출 리포트를 제공하며 엑셀 출력을 지원한다.

**직원 관리** (`staff`) 탭은 `StaffManager.tsx`에서 관리되며 직원의 이름, 연락처, 담당과목(수학/고등수학/영어/과학/국어), 소속을 CRUD한다. 역할과 권한도 여기서 설정한다. 직원 삭제 시 Firebase Auth 계정과 `staffIndex`를 완전히 삭제하는 로직이 구현되어 있다. 훅은 `useStaff`, `useStaffLeaves`(휴무 관리)를 사용한다.

**수납 관리** (`billing`) 탭은 수납 내역을 입력/수정/삭제하며 `useExcelImport` 훅으로 엑셀 일괄 import가 가능하다. 학생별 미납 조회도 여기서 할 수 있다.

**자료실** (`resources`) 탭은 Firebase Storage 기반의 파일 업로드/다운로드 시스템이다. 폴더별 분류와 권한별 접근 제어가 가능하며 `useResources` 훅을 사용한다.

**역할 관리** (`role-management`) 탭은 역할별 권한을 ON/OFF하는 화면이다. 100개 이상의 권한을 체크박스로 관리하며 설정은 `settings/permissions_config`에 저장된다. 탭별 접근 역할도 여기서 지정할 수 있다.

**급여 관리** (`payroll`) 탭은 월별 직원 급여를 시급과 출석 기반으로 자동 계산하며, 수당과 공제를 관리하고 급여명세서를 PDF로 출력한다.

**매출 분석** (`analytics`) 탭은 학원별 매출 트렌드와 학생 유입/이탈 분석, 과목별 매출 비중, 반별 수익성 분석을 제공한다. Recharts 라이브러리로 차트를 시각화한다.

**수강료 계산** (`tuition-calculator`) 탭은 복잡한 수강료 계산을 지원하는 전용 모듈이다. 세션 관리자는 수업 빈도와 기간을 설정하고, 휴일 관리자는 결석일을 자동으로 제외한다. 할인 정책(형제할인/장학/프로모션)을 설정할 수 있고, 추가 요금(교재/특별반)을 관리하며 청구서를 자동 생성한다. 관련 훅이 매우 많다. `useTuitionSessions`, `useTuitionHolidays`, `useTuitionDiscounts`, `useTuitionExtras`, `useTuitionInvoices`, `useTuitionCourses`가 있다.

**회의록** (`meeting-minutes`) 탭은 회의 녹음을 AI로 요약하는 기능을 제공한다. `useMeetingRecording` 훅이 녹음을 담당하고, 서버에서 AssemblyAI와 Claude API를 거쳐 자동 보고서가 생성된다.

**지출 관리** (`expenses`) 탭은 지출 내역을 기록하고 카테고리별로 분류하며 월별 리포트를 제공한다. `useExpenses` 훅을 사용한다.

### 3.6 소통 그룹

**학부모 소통** (`parent-portal`) 탭은 학부모용 링크를 발급하고 메시지를 주고받는 기능을 제공한다. `useParentLinks`와 `useParentMessages` 훅을 사용한다. 현재 초기 단계이며, 링크 발급과 기본 메시지 기능만 동작한다.

**알림 발송** (`sms-notifications`) 탭은 SMS, 카카오톡, 푸시 알림을 발송한다. 템플릿을 관리할 수 있으며 `useNotifications`와 `usePushNotification`(FCM) 훅을 사용한다.

### 3.7 마케팅 그룹

**마케팅** (`marketing`) 탭은 광고 캠페인을 관리한다. `useMarketing` 훅이 있지만 세부 기능은 아직 미검증 상태다.

**셔틀 관리** (`shuttle`) 탭은 셔틀 버스 노선을 관리한다. 시간표의 셔틀 뷰와는 별개의 기능으로, 버스 라우팅과 차량 관리에 초점을 맞춘다. `useShuttle` 훅을 사용한다.

**시간표 배포** (`timetable-distribution`) 탭은 시간표를 이미지나 PDF로 학부모에게 일괄 배포하는 기능이다. 수동 생성은 동작하지만 자동 배포는 아직 미검증이다.

### 3.8 지원 그룹

**도움말** (`help`) 탭은 각 기능의 사용법을 안내하는 내부 문서 페이지다.

**로그보기** (`logs`) 탭은 시스템 로그와 변경 이력을 조회한다.

---

## 4. 시뮬레이션 모드 상세

시뮬레이션 모드는 영어와 수학 시간표에서 각각 독립된 `SimulationContext`로 관리되는 메모리 기반 편집 환경이다. 실시간 데이터를 변경하지 않고 가상으로 학기 구성을 시뮬레이션할 수 있어, 학기 전환이나 반 재배치 같은 큰 변경 사항을 안전하게 검증할 수 있다.

진입 시에는 `enterScenarioMode()`가 호출되어 `loadFromLiveInternal()`로 실시간 데이터를 메모리에 복사한다. 구체적으로 `classes` 컬렉션(과목 필터링)과 `students/{id}/enrollments` subcollection을 병렬로 로드하며, 고아 enrollment(학생이 삭제된 경우)는 자동으로 필터링된다. 로드된 데이터는 `scenarioClasses`(classId → ScenarioClass)와 `scenarioEnrollments`(className → studentId → ScenarioEnrollment) 두 개의 맵으로 저장된다. UI는 즉시 시뮬레이션 모드로 전환되며 상단 헤더가 주황색으로 바뀌고 "SIMULATION" 배지가 펄스 애니메이션으로 표시된다. 자동으로 edit 모드로 전환되는 것도 특징이다.

편집 작업은 모두 메모리에서 이루어진다. `addStudentToClass`, `removeStudentFromClass`, `moveStudent`, `addScenarioClass`, `deleteScenarioClass`, `renameScenarioClass`, `updateScenarioClass` 등의 함수가 제공된다. 각 작업은 `scenarioClasses`와 `scenarioEnrollments`의 스냅샷을 `HistoryEntry`로 저장한다. 히스토리는 최대 20단계까지 유지되며, 각 엔트리는 고유 ID, 액션 설명(예: "홍길동: LE1 → LE2 이동"), 타임스탬프, 바로가기 대상 수업을 포함한다.

**Undo/Redo**는 Ctrl+Z와 Ctrl+Y로 작동한다. Undo는 `historyIndex`를 감소시키면서 해당 시점의 스냅샷을 복원한다. 첫 Undo 시 현재 상태를 `liveStateBackup`에 저장해두어 나중에 Redo로 복원할 수 있게 한다. Redo는 `historyIndex`를 증가시키면서 다음 스냅샷 또는 `liveStateBackup`으로 복원한다. 이 로직은 매우 정교하게 설계되어 있어, 중간 지점에서 새로운 액션을 수행하면 그 이후의 히스토리는 자동으로 삭제된다.

**반 이름 변경(레벨업)** 기능은 `renameScenarioClass`로 수행한다. 변경하려는 새 이름이 이미 존재하는 수업과 충돌하면 경고를 표시하고 변경을 거부한다. 성공 시에는 `scenarioClasses`의 className을 업데이트하고, `scenarioEnrollments`의 key도 새 이름으로 이동시킨다. 모든 enrollment의 className 필드도 함께 갱신된다. 이는 "LE1 → LE2 레벨업" 같은 학기말 정기 작업에 유용하다.

**충돌 감지**(`detectConflicts`)는 시뮬레이션 편집 중 실시간 데이터가 변경되었는지 확인한다. 반영 시도 시 자동으로 호출되며, 실시간에 새로 추가된 수업(시나리오에 없음)과 삭제된 수업(시나리오에만 있음)을 찾아낸다. 충돌이 있으면 사용자에게 3가지 선택지를 제시한다.

**발행 모드**는 "덮어쓰기/병합/취소" 중 선택할 수 있다. 덮어쓰기는 시나리오 데이터로 실시간을 완전히 대체하며, 실시간에만 있는 수업은 삭제된다. 병합은 실시간에 새로 추가된 수업을 유지하면서 시나리오 변경 사항만 반영하며, 시나리오에만 있던 수업은 반영하지 않는다. 취소는 반영을 취소한다.

**자동 백업**은 반영 직전에 항상 수행된다. 현재 실시간 데이터 전체를 `math_scenarios/backup_{timestamp}` 또는 `english_simulation_scenarios/backup_{timestamp}` 문서로 저장한다. 사용자에게는 백업 ID가 알림으로 안내되어, 필요 시 이 백업을 로드하여 복구할 수 있다.

**반영 과정**은 매우 정교하게 설계되어 있다. 먼저 `classes` 컬렉션을 업데이트하는데, `merge: true` 옵션으로 기존 필드(isActive, createdAt 등)를 보존한다. 그다음 enrollments를 처리하는데, 전체 삭제 후 재생성하는 방식이 아니라 "변경된 부분만 업데이트"하는 스마트한 방식이다. 구체적으로는 1) 실시간에 있지만 시나리오에는 없는 학생(제거된 학생)의 enrollment에 endDate를 설정하고, 2) 반이 바뀐 학생은 기존 enrollment에 endDate를 설정하고 새 enrollment를 생성하며, 3) 반 이름이 변경된 경우(레벨업)는 기존 doc을 삭제하고 새 doc을 생성하되 `startDate`를 유지한다. 이를 통해 반이동 이력이 자연스럽게 추적된다.

수학 시뮬레이션은 최근 영어와 동일한 수준으로 대폭 확장되었다. 이전에는 기본적인 학생 이동과 시나리오 저장/로드만 지원했지만, 현재는 Undo/Redo, 수업 추가/삭제/레벨업, 충돌 감지, 발행 모드 선택을 모두 지원한다. 다만 영어에만 있는 시나리오 비교(`ScenarioCompareModal`), 예약 적용, 커스텀 뷰 그룹 기능은 아직 수학에 구현되지 않았다.

중요한 점은 **시뮬레이션 모드가 엑셀(강사)뷰에서도 작동**한다는 것이다. 초기에는 통합뷰(`MathClassTab`)에서만 시나리오 데이터를 사용했지만, 최근 `classesWithEnrollments`를 수정하여 시뮬레이션 모드일 때 `simulation.getClassStudents()`로부터 학생 목록을 구성하도록 변경했다. 이제 엑셀뷰에서도 드래그 이동이 시나리오 데이터에 반영되고 화면에도 즉시 표시된다.

---

## 5. 외부 시스템 연동

### 5.1 메이크에듀 연동

메이크에듀(MakeEdu)는 학원 관리 SaaS로, 학원이 수강료 수납과 학생 관리에 사용하는 외부 시스템이다. 에이와 인재원 시스템은 메이크에듀로부터 필요한 데이터를 자동 동기화한다.

**학생 목록 크롤링**은 `/student/studentList.do` URL을 대상으로 한다. Puppeteer 헤드리스 브라우저로 로그인하며, 페이지당 500건씩 최대 20페이지를 순회하여 학생 이름, 학교, 학년을 추출한다. 로그인 방식은 DOM을 직접 조작하여 `input[name="membId"]`와 `input[name="password"]`에 값을 채운 후 로그인 버튼을 클릭하는 방식이다. 이는 일반 fetch 기반 로그인이 봇 탐지에 걸려 NO_REJECT 응답을 받는 문제를 회피하기 위함이다.

**셔틀 학생 동기화**는 최근 개편되었다. 이전에는 학생 목록 페이지의 "기타수납" 컬럼에서 "셔틀" 키워드를 찾는 방식이었지만, 지금은 **상세수납 페이지(`/pay/payUnionDeList.do`)**에서 수업명이 "셔틀", "스쿨버스", "통학버스" 중 하나를 포함하는 수납 항목의 학생명을 추출하는 방식으로 바뀌었다. 이 방식이 더 정확하고 유연하다.

월별 로직은 특별한 주의를 기울여 설계되었다. 매월 1일부터 10일까지는 새 달의 수납이 아직 시작되지 않았거나 일부 학생만 결제한 시점이므로, **전월과 당월을 모두 조회**하여 중복을 제거한 뒤 셔틀 학생 리스트를 구성한다. 11일부터는 당월 수납이 대부분 완료되었다고 판단하여 당월만 조회한다. 이를 위해 Puppeteer가 상세수납 페이지의 `#fromYm` 입력 필드 값을 전월 `YYYYMM` 형식으로 변경하고, 검색 버튼을 클릭하여 범위를 확장한다.

크롤링 과정은 다음과 같다. 먼저 Puppeteer로 메이크에듀 메인 페이지에 접속하여 로그인한다. 로그인 후 상세수납 페이지로 이동하고, `#listSize`를 500으로 설정한다. 필요하면 `#fromYm`을 전월로 변경하고 검색 버튼을 클릭한다. 그다음 모든 페이지를 순회하면서 각 행에서 학생명(`a.dl_pop`), 청구월(`a.btnPayYmChg`), 수업종류, 수업명(`a.btnPayName`)을 추출한다. 추출된 데이터를 필터링하여 셔틀 관련 수업명을 가진 행만 남기고, 학생명의 중복을 제거한다. 마지막으로 `shuttle_students` 컬렉션을 전체 재작성한다(기존 삭제 후 새 배치로 저장).

함수 설정은 메모리 2GB, 타임아웃 540초, 리전 `asia-northeast3`이다. 실행 시간은 약 85초이며, 클라이언트 측 `httpsCallable`의 타임아웃이 기본 70초이므로 별도로 300초로 연장 설정했다.

### 5.2 Google Calendar 동기화

`useGoogleCalendarSync` 훅을 통해 연간 일정과 Google Calendar를 양방향으로 동기화한다. 이벤트의 생성, 수정, 삭제가 모두 반영되며, `GCalSyncSettings`로 동기화 대상 캘린더와 옵션을 설정할 수 있다. 학원 직원이 자신의 개인 Google Calendar에서 일정을 추가해도 시스템에 자동 반영되는 장점이 있다.

### 5.3 Edutrix 연동

Edutrix(`edutrix.vercel.app`)는 수업 보고서를 작성하는 외부 시스템이다. 사이드바 맨 아래에 외부 링크로 노출되어 있으며, 클릭 시 Edutrix로 이동한다. Supabase에 `reports`(수학), `en_reports`(영어), `hs_reports`(고등수학) 테이블로 데이터가 저장되며, 에이와 인재원 시스템에서는 `useEdutrixSync` 훅을 통해 이 데이터를 조회한다. 시간표의 학생 툴팁에 최근 진도가 표시되고, 주간 지각/결석 학생 필터도 이 데이터를 기반으로 작동한다.

### 5.4 FCM 푸시 알림

`usePushNotification` 훅으로 Firebase Cloud Messaging을 사용한 푸시 알림을 구현한다. 학부모에게 출결 알림이나 공지사항을 실시간으로 전송할 수 있다.

### 5.5 SMS 및 알림톡

템플릿 기반으로 수납 알림, 출결 알림, 공지사항을 자동 발송한다. `useNotifications` 훅이 템플릿을 관리하고 실제 발송은 외부 SMS 게이트웨이와 연동된다.

### 5.6 공유 링크 (Embed Mode)

`components/Embed/EmbedRouter.tsx`에서 관리되는 임베드 모드는 로그인 없이 특정 데이터를 공개 공유할 수 있게 해준다. 토큰 기반 인증(`useEmbedTokens`)으로 보안을 유지하며, 시간표나 출석부 같은 화면을 학부모에게 공유할 때 유용하다.

---

## 6. AI 자동화 흐름

에이와 인재원 시스템은 Claude API와 AssemblyAI를 활용하여 상담과 회의 녹음으로부터 자동으로 보고서를 생성하는 AI 자동화 시스템을 갖추고 있다.

**녹음 시작 단계**에서는 웹 MediaRecorder API를 사용하여 브라우저에서 직접 녹음한다. `useConsultationRecording`(상담용) 또는 `useMeetingRecording`(회의용) 훅이 녹음 상태를 관리하며, 녹음이 완료되면 Blob이 Firebase Storage에 업로드된다.

**Cloud Function 호출** 단계에서는 `analyzeConsultation` 또는 `analyzeMeeting` 함수가 실행된다. 업로드된 파일의 Signed URL을 생성하고, 이를 AssemblyAI API에 전송한다.

**음성인식 단계**에서 AssemblyAI는 한국어 음성을 텍스트로 변환하고 화자를 자동으로 구분한다(Speaker A, B, C 등). 타임스탬프도 함께 생성되며, 결과는 전체 transcript 텍스트로 반환된다.

**Claude API 보고서 생성 단계**에서는 Anthropic의 Claude Sonnet 모델에 transcript를 전송하여 구조화된 보고서를 생성한다. 상담의 경우 학생/학부모의 요구사항, 상담 포인트, 액션 아이템이 추출되고, 회의의 경우 주요 논의 내용, 결정 사항, 담당자가 정리된다. 프롬프트는 학원 상담/회의의 특성에 맞춰 최적화되어 있다.

**저장 단계**에서는 생성된 보고서가 `consultation_reports` 또는 `meeting_reports` 컬렉션에 저장된다. UI에서는 이 보고서를 조회하고 필요 시 직접 수정할 수 있다.

---

## 7. 개발중 / 미완성 기능 목록

이 섹션은 현재 시스템에서 완전히 완성되지 않은 부분을 투명하게 기록한다.

**시간표 수학** 영역에서는 엑셀(강사) 기본뷰는 정상 동작하며 주력 뷰로 사용된다. 엑셀(요일), 강의실뷰, 통합뷰는 "개발중" 카테고리로 드롭다운에 분류되어 있으며 동작은 하지만 완성도는 낮다. 시뮬레이션은 최근 대폭 확장되어 Undo/Redo, 수업 CRUD, 충돌 감지, 발행 모드가 모두 구현되었지만, 아직 dev 사이트에만 배포되었고 prod 배포는 대기 중이다.

**시간표 고등수학** 영역에서는 엑셀(요일) 기본뷰만 정상 동작하며 나머지는 개발중이다.

**시간표 영어** 영역에서는 엑셀 기본뷰가 정상 동작하며, 통합뷰/강사/강의실은 개발중이다. 영어 시뮬레이션은 완성도가 가장 높아서 시나리오 비교, 예약 적용, 커스텀 뷰 그룹까지 지원한다.

**수학 시뮬레이션**에는 영어에만 있는 세 가지 기능이 아직 구현되지 않았다. 첫째, 시나리오 비교(`ScenarioCompareModal`)는 여러 시나리오를 나란히 비교하는 기능이다. 둘째, 예약 적용(`scheduledApplyDate/Status`)은 특정 날짜에 자동으로 반영되는 기능이다. 셋째, 커스텀 뷰 그룹(`scenarioViewSettings`)은 시나리오별로 독립된 뷰 설정을 저장하는 기능이다.

**학부모 포털** 탭은 초기 단계이며 링크 발급만 동작한다. 메시지 송수신은 아직 미완성이다.

**매출 분석** 탭은 기본 차트만 구현되어 있고 고급 분석(예측, 세그먼트 분석)은 미구현이다.

**마케팅** 탭은 구조만 존재하고 캠페인 관리 기능은 미검증이다.

**시간표 배포** 탭은 수동 생성은 가능하지만 자동 배포 기능은 미검증이다.

**계약 관리** 탭은 구조만 존재하고 세부 기능은 미검증이다.

**Firebase Functions** 측면에서는 ClassNote 날짜 버그 수정 코드가 완료되었지만 아직 배포되지 않았다.

**디버그 로그** 관련으로는 취소선 문제를 추적하기 위해 `TimetableManager`와 `ClassCard`에 `console.warn` 디버그 로그가 임시로 남아있다. 문제 해결이 확인된 후 제거될 예정이다.

---

## 8. 최근 주요 개선 이력 (2026-04)

2026년 4월에는 여러 가지 중요한 개선 작업이 이루어졌다.

**04-15**에는 사이트명을 "인재원 Eywa"에서 "에이와 인재원"으로 변경했다. `index.html`의 title과 OG 메타태그, `public/manifest.json`의 name과 short_name이 모두 업데이트되었다.

**04-14**에는 수학 시뮬레이션을 영어와 동일한 수준으로 확장하는 대규모 작업이 수행되었다. Math SimulationContext를 전면 재작성하여 Undo/Redo(최대 20단계), 수업 추가/삭제, 반 이름 변경(레벨업), 충돌 감지, 발행 모드(덮어쓰기/병합/취소), 자동 백업, 반영 시 enrollment 이동 이력 추적을 모두 구현했다. TimetableHeader와 TimetableManager에 Undo/Redo UI와 Ctrl+Z/Y 단축키를 연결했다. 이 변경 사항은 dev 사이트에 배포되어 테스트 중이다.

시뮬레이션과 엑셀(강사)뷰의 데이터 연동도 같은 날 수정되었다. 기존에는 시뮬레이션 데이터가 통합뷰(`MathClassTab`)에서만 표시되었는데, `classesWithEnrollments`를 수정하여 시뮬레이션 모드일 때 `simulation.getClassStudents()`로부터 학생 목록을 구성하도록 변경했다. 이제 엑셀뷰에서도 시뮬레이션 이동이 화면에 즉시 반영된다.

셔틀버스 크롤링 로직이 학생 목록 페이지에서 상세수납 페이지로 전환되었다. 월별 로직(1-10일 전월 포함, 11일 이후 당월만)도 함께 구현되었다.

시간표 뷰 선택이 클릭 순환 버튼에서 드롭다운으로 변경되었다. 기본뷰와 "개발중" 카테고리로 분리하여 사용자가 주력 뷰와 실험적인 뷰를 명확히 구분할 수 있게 했다. 라벨도 "엑셀(강사)" 같은 구체적 이름에서 "기본뷰"로 변경하여 각 과목의 기본 뷰임을 강조했다. 드롭다운은 `createPortal`로 body에 렌더링되어 overflow 문제를 해결했다.

과목 전환 시 기본뷰 자동 설정 로직이 추가되었다. 수학 선택 시 엑셀(강사), 고등수학 선택 시 엑셀(요일), 영어 선택 시 엑셀로 자동 진입한다.

교재 관리의 가격 변동 이력 기능이 개선되었다. 테이블에 "수정일" 컬럼이 추가되고, 클릭 시 fixed 위치의 팝업으로 이력이 표시된다. 최근 2건만 기본 표시되고 "이전 이력 N건 더보기" 버튼으로 확장할 수 있다. `priceHistory` 배열에 누적 저장되며 레거시 데이터와도 호환된다.

**04-13**에는 여러 가지 학생 관리 개선이 이루어졌다. 학생 기본정보 탭에 "등하원 정보" 섹션이 추가되었다(등원/하원 시간, 특이사항 태그). 시간표의 학생 툴팁에도 등하원 정보가 표시된다.

드래그 이동 시 취소선 표시가 제대로 작동하도록 수정되었다. React.memo 비교 함수에 `pendingMoveFromMap`과 `pendingMovedStudentIds`를 추가했으며, CSS 클래스만으로는 해결되지 않아 인라인 스타일로 강제 적용하는 방식을 채택했다.

병합 셀(합반)의 대기생과 퇴원생 누적 버그가 수정되었다. 단일 셀에는 30일 필터가 있었지만 병합 셀에는 빠져있어 모든 학생이 계속 누적되는 문제가 있었다. 동일한 30일 제한 로직을 병합 셀과 부분등원에도 적용했다.

재원생 통계 dedup 로직이 개선되었다. 기존에는 "먼저 발견된 반 기준"이라 반이동 학생이 이전 반(종료됨)에서 먼저 처리되면 새 반(활성)에서도 무시되어 누락되는 경우가 있었다. 활성 상태를 우선 처리하는 로직으로 변경했다. 또한 기준일도 `currentWeekStart`(항상 월요일)에서 `getWeekReferenceDate`(이번주는 오늘, 과거주는 일요일, 미래주는 월요일)로 변경하여 정확성을 높였다.

영어 시간표에 셔틀 필터, 학교별 필터, 학년별 필터가 추가되었다. 학년은 초→중→고 순서로, 같은 학교급 내에서는 학년 순으로 정렬된다.

MakeEdu 로그인이 fetch 방식에서 Puppeteer 방식으로 전환되었다. 기존 fetch 방식은 MakeEdu의 봇 탐지에 걸려 NO_REJECT 응답을 받는 문제가 있었다.

---

## 9. 성능 최적화 기법

시스템은 여러 가지 성능 최적화 기법을 적용하여 초기 로딩과 런타임 성능을 개선했다.

**번들 최적화** 측면에서는 탭별 컴포넌트를 `React.lazy()`로 감싸 동적 import로 로드한다. Vite 설정에서 `manualChunks`를 지정하여 vendor, firebase, react-dom, charts, pdf-generation, xlsx 같은 큰 의존성을 별도 chunk로 분리했다. 특히 EnglishTimetable의 lazy 로드로 초기 번들이 약 150KB 감소했다. 다만 일부 chunk는 500KB를 초과하는데, firebase는 674KB로 가장 크다.

**데이터 캐싱** 측면에서는 React Query를 30분 staleTime으로 설정하여 같은 데이터의 반복 조회를 방지한다. `useMemo`로 필터링과 정렬 결과를 캐싱하며, `useStudentDragDrop` 같이 stale closure가 발생할 수 있는 곳에서는 ref를 사용해 최신 상태를 동기화한다.

**렌더 최적화** 측면에서는 `React.memo`를 `ClassCard` 같은 자주 리렌더링되는 컴포넌트에 적용하고 커스텀 비교 함수를 지정하여 불필요한 리렌더를 차단한다. 드롭다운과 팝업은 `createPortal`로 body에 직접 렌더링하여 테이블의 `overflow` 속성에 가려지는 문제를 회피한다. 드래그 이동은 Optimistic UI를 적용하여 Firestore 저장 전에 먼저 화면에 반영한다.

**버전 관리** 측면에서는 `version.json` 파일을 5분 간격으로 폴링하여 새 버전이 배포되면 자동으로 페이지를 새로고침한다. `VersionUpdateToast` 컴포넌트가 사용자에게 업데이트 알림을 표시한다.

**접근성** 측면에서는 SkipLink(메인 콘텐츠로 건너뛰기), ErrorBoundary(에러 격리), FocusTrap(모달 포커스 관리), 키보드 네비게이션 등을 지원한다.

**배치 처리** 측면에서는 Firestore의 batch 제한인 500건을 고려하여 모든 대량 작업을 500건 단위로 청크 분할한다. Pending Event Move는 사용자가 여러 번 이동한 것을 모아뒀다가 한 번에 반영하는 배치 처리 방식을 사용한다.

---

## 10. 배포 전략

시스템은 dev와 prod 두 사이트로 분리 운영되며, 신중한 배포 전략을 따른다.

**개발 단계**에서는 로컬에서 `npm run dev`로 개발 서버를 실행한다. 변경 사항이 완성되면 `npm run build`로 빌드한 후 `firebase deploy --only hosting:dev`로 dev 사이트에만 배포한다. dev 사이트에서 충분히 테스트한 후 `firebase deploy --only hosting:prod` 또는 `firebase deploy --only hosting`(두 사이트 모두)으로 prod에 배포한다.

중요한 점은 **dev와 prod가 동일한 Firestore DB를 공유**한다는 것이다. 프론트엔드 코드만 분리된 테스트/운영 버전이며, 데이터는 완전히 통합되어 있다. 따라서 dev에서 데이터를 변경하면 prod에도 영향이 간다. 이 때문에 파괴적인 변경은 신중하게 테스트해야 한다.

Cloud Functions 배포는 `firebase deploy --only functions:함수명`으로 개별 함수만 배포할 수 있다. 이는 배포 시간을 단축하고 실수로 다른 함수를 재배포하는 것을 방지한다.

`version.json` 파일은 매 배포 시 업데이트되어, 사용자의 브라우저가 구버전을 감지하면 자동으로 새로고침한다.

---

## 11. 마치며

에이와 인재원 학원 관리 시스템은 수년간의 지속적인 개선을 거쳐 학원 운영의 거의 모든 영역을 아우르는 통합 플랫폼으로 성장했다. 33개의 메뉴, 100개 이상의 권한, 40개 이상의 Firestore 컬렉션, 100개가 넘는 커스텀 훅으로 구성된 이 시스템은 엔터프라이즈급 규모이며, React Query와 Context API를 조합한 상태 관리, Firebase를 전면 활용한 백엔드, Claude와 AssemblyAI를 활용한 AI 자동화, Puppeteer 기반 메이크에듀 크롤링 등 현대적인 기술 스택을 폭넓게 활용하고 있다.

현재 가장 활발히 개선되는 영역은 시간표(시뮬레이션, 드래그 앤 드롭, 뷰 구조), 학생 통계(dedup 로직과 기준일 정확도), 외부 연동(메이크에듀 크롤링 전략)이다. 앞으로의 주요 개선 방향으로는 수학 시뮬레이션의 시나리오 비교와 예약 적용 기능 추가, 개발중인 뷰(강의실/통합뷰)의 완성도 개선, 학부모 포털과 시간표 배포의 자동화, 매출 분석 차트의 고도화 등이 있다.

시스템을 효과적으로 활용하려면 권한 체계를 이해하고, 각 탭의 기능을 숙지하며, 특히 시간표와 학생 관리의 복잡한 기능을 단계적으로 탐색하는 것이 좋다. 시뮬레이션 모드는 큰 변경 사항을 안전하게 검증할 수 있는 강력한 도구이므로 학기 전환이나 반 재배치 시 적극 활용할 것을 권장한다. 메이크에듀 동기화는 정기적으로 실행하여 학생 데이터를 최신 상태로 유지해야 한다.

본 보고서는 2026년 4월 14일 기준으로 작성되었으며, 시스템이 지속적으로 발전하는 만큼 주기적으로 업데이트될 필요가 있다. 궁금한 점이나 추가 설명이 필요한 영역이 있으면 언제든 문의하시기 바란다.

---

**문서 종료**

작성: 2026-04-14
검토 완료
