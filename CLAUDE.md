# 인재원 학원 관리 시스템 (IJW Calendar)

Firebase 기반 학원 통합 관리 플랫폼 - 시간표, 출석, 상담, 수납, 학생 관리 올인원 솔루션

## 기술 스택

| Category | Technology | Version |
|----------|-----------|---------|
| UI | React | 19.2 |
| Language | TypeScript | 5.8 |
| Build | Vite | 6.2 |
| Styling | TailwindCSS | 3.4 |
| Backend | Firebase (Firestore, Auth, Storage) | 12.7 |
| State | React Query (@tanstack/react-query) | 5.90 |
| AI | Google Gemini (@google/genai) | 1.34 |
| Chart | Recharts | 3.6 |
| DnD | @dnd-kit | 6.3 |
| Date | date-fns | 4.1 |
| Icon | lucide-react | 0.562 |
| Excel | xlsx | 0.18 |
| PDF | jspdf + html2canvas | 3.0 / 1.4 |
| OCR | tesseract.js | 7.0 |
| Test | Vitest + @testing-library/react | 4.0 / 16.3 |
| External | Supabase (Edutrix 연동) | 2.99 |

## 프로젝트 구조

```
ijw-calander/
├── components/          # React 컴포넌트 (47개 도메인 그룹)
│   ├── Analytics/       # 통계 분석
│   ├── Attendance/      # 출석 관리
│   ├── Auth/            # 로그인/인증
│   ├── Billing/         # 수납 관리
│   ├── Calendar/        # 연간 일정
│   ├── Chatbot/         # AI 어시스턴트
│   ├── ClassManagement/ # 수업 관리
│   ├── Classroom/       # 강의실
│   ├── ClassroomAssignment/ # 강의실 배정
│   ├── Common/          # 공통 UI (Badge, Button, Modal, Table, ErrorBoundary 등)
│   ├── ConsultationRecording/ # 상담 녹음
│   ├── Contracts/       # 계약 관리
│   ├── DailyAttendance/ # 일일 출결
│   ├── Dashboard/       # 대시보드
│   ├── Embed/           # 임베드 모드
│   ├── Exams/           # 시험 관리
│   ├── Gantt/           # 간트 차트
│   ├── Grades/          # 성적 관리
│   ├── Header/          # 헤더
│   ├── Help/            # 도움말
│   ├── Homework/        # 숙제 관리
│   ├── Layout/          # AppHeader, TabContent, ModalManager
│   ├── Logs/            # 시스템 로그
│   ├── Marketing/       # 마케팅
│   ├── MeetingMinutes/  # 회의록 (AI 분석)
│   ├── Navigation/      # 사이드바
│   ├── Notices/         # 공지사항
│   ├── Notifications/   # 알림 센터
│   ├── ParentPortal/    # 학부모 포털
│   ├── PaymentReport/   # 수납 현황
│   ├── Payroll/         # 급여 관리
│   ├── RegistrationConsultation/ # 등록 상담
│   ├── Reports/         # 학습 보고서
│   ├── Resources/       # 자료실
│   ├── RoleManagement/  # 역할 관리
│   ├── Settings/        # 설정
│   ├── Shuttle/         # 셔틀 관리
│   ├── Staff/           # 직원 관리
│   ├── StudentConsultation/ # 학생 상담
│   ├── StudentManagement/   # 학생 관리
│   ├── TaskMemo/        # 업무 메모
│   ├── Textbooks/       # 교재 관리
│   ├── Timetable/       # 시간표 (Math/, English/, Generic/, Shuttle/, shared/)
│   ├── TimetableDistribution/ # 시간표 배포
│   ├── TuitionCalculator/    # 수강료 계산기
│   └── WithdrawalManagement/ # 퇴원 관리
├── hooks/               # 커스텀 훅 (87개)
├── utils/               # 유틸리티 함수 (27개)
├── types/               # TypeScript 타입 정의 (22개)
├── contexts/            # React Context (HeaderCollapseContext)
├── scripts/             # 데이터 마이그레이션 스크립트 (19개)
├── App.tsx              # 메인 앱 컴포넌트
├── index.tsx            # 엔트리 포인트
├── firebaseConfig.ts    # Firebase 초기화 (진단 포함)
├── queryClient.ts       # React Query 설정 (staleTime 5min)
├── converters.ts        # Firestore 컨버터 (한글 필드)
├── constants.ts         # 앱 상수
└── vite.config.ts       # Vite 빌드 설정 (13개 청크 분리)
```

## 탭 시스템 (33개 탭)

```
AppTab =
  // 홈
  | 'dashboard'
  // 일정 그룹
  | 'calendar' | 'gantt'
  // 수업 그룹
  | 'timetable' | 'attendance' | 'daily-attendance' | 'classes'
  | 'classroom' | 'classroom-assignment' | 'homework' | 'exams' | 'textbooks'
  // 학생 그룹
  | 'students' | 'consultation' | 'student-consultations'
  | 'grades' | 'withdrawal' | 'contracts' | 'reports'
  // 관리 그룹
  | 'payment' | 'tuition-calculator' | 'staff' | 'billing'
  | 'resources' | 'role-management' | 'analytics' | 'payroll'
  // 소통 그룹
  | 'notices' | 'parent-portal' | 'sms-notifications'
  // 마케팅 그룹
  | 'marketing' | 'shuttle' | 'timetable-distribution'
  // AI/지원
  | 'meeting-minutes' | 'logs' | 'help'
```

## 주요 훅 카테고리

### 인증/권한
`useAuth`, `usePermissions`, `useTabPermissions`, `useRoleHelpers`

### 데이터 조회 (React Query)
`useStudents`, `useClasses`, `useStaff`, `useAttendance`, `useConsultations`, `useEnrollments`, `useFirebaseQueries` (departments, teachers, holidays, classKeywords, systemConfig, staffWithAccounts)

### 데이터 변경 (Mutations)
`useClassMutations`, `useConsultationMutations`, `useEventCrud`, `useEnglishClassUpdater`

### 도메인 훅
- 출석: `useAttendance`, `useDailyAttendance`, `useBatchAttendanceUpdate`, `useVisibleAttendanceStudents`
- 시간표: `useTimetableLog`, `useSubjectClassStudents`
- 성적: `useStudentGrades`, `useGradeProfile`, `useGradePromotion`
- 상담: `useConsultations`, `useConsultationDrafts`, `useConsultationStats`, `useStudentConsultations`
- 수강료: `useTuitionCourses`, `useTuitionSessions`, `useTuitionInvoices`, `useTuitionDiscounts`, `useTuitionExtras`, `useTuitionHolidays`
- 간트: `useGanttProjects`, `useGanttCategories`, `useGanttDepartments`, `useGanttTemplates`
- 수납: `useBilling`, `useStudentBilling`, `usePayroll`
- 녹음: `useMeetingRecording`, `useConsultationRecording`, `useRegistrationRecording`
- 기타: `useHomework`, `useExams`, `useExamSeries`, `useMarketing`, `useShuttle`, `useShuttleStudents`, `useTextbooks`, `useNotices`, `useNotifications`, `useContracts`, `useResources`, `useParentPortal`

### UI 상태
`useAppState` (useCalendarState, useEventModalState, useModalState, useTimetableState, useStudentFilterState, useGradesFilterState, useDarkMode, usePendingEventMoves), `useTabHistory`

### 유틸리티
`useForm`, `useFocusTrap`, `useEscapeClose`, `useGlobalSearch`, `useExcelImport`, `useVersionCheck`, `useDraggable`, `useStudentFilters`, `useWithdrawalFilters`, `useWithdrawalStats`

### 외부 연동
`useChatbot` (Gemini AI), `useEdutrixSync` (Supabase), `useEmbedData`, `useEmbedTokens`

## 핵심 아키텍처 패턴

### 데이터 흐름
```
Firestore → React Query 훅 (캐시) → 컴포넌트 → useAppState (크로스 컴포넌트 상태)
```

### React Query 설정 (queryClient.ts)
- staleTime: 5분 (기본)
- gcTime: 30분
- refetchOnWindowFocus: true
- retry: 1

### Firestore 컨버터
- 한글 필드명 ↔ 영문 필드명 양방향 변환
- 예: `제목` → `title`, `부서ID` → `departmentId`

### 코드 스플리팅 (Vite)
13개 수동 청크: react, react-dom, firebase, lucide, charts, date-fns, dnd-kit, pdf-generation, ocr, markdown, xlsx, google-ai, react-query, common-components, vendor

### 권한 시스템 (RBAC)
역할 계층: `master` > `admin` > `manager` > `math_lead`/`english_lead` > `math_teacher`/`english_teacher` > `user`

**권한 흐름:**
```
DEFAULT_ROLE_PERMISSIONS (types/auth.ts) → settings/rolePermissions (Firestore) → 역할관리 탭 (UI)
                                                    ↕
                                         usePermissions (클라이언트 체크)
                                         firestore.rules hasPermission() (서버 체크)
```

**자동 동기화:** `usePermissions`가 앱 로드 시 `DEFAULT_ROLE_PERMISSIONS`와 DB를 병합하여 누락된 권한 키를 자동 채움 → Firestore 규칙 호환 보장

**Firestore 보안 규칙 (`firestore.rules`):**
- 40+ 컬렉션에 명시적 규칙 정의
- `hasPermission(permissionId)` → `settings/rolePermissions` 문서에서 역할별 권한 조회
- create와 edit 권한을 분리 (예: `textbooks.create` vs `textbooks.edit`)
- catch-all: 명시적 규칙이 없는 컬렉션은 master/admin만 write 가능

### Lazy Loading
React.lazy() + Suspense + ErrorBoundary 패턴

### 개인정보 보호
AES 암호화 (`utils/encryption.ts`) - 학생/학부모 개인정보

### Storage 파일 생명주기
- 녹음 파일(상담/회의록/등록상담): 120일 후 자동 삭제 (Cloud Functions `cleanupExpiredRecordings`)
- 만료 임박 파일 UI 경고 표시 (30일 이내)
- 경로 패턴: `recordings/{type}/{docId}/{filename}`

### Enrollment 데이터 동기화
- 수업 수정(schedule/teacher 변경) 시 해당 수업의 모든 enrollment 문서 자동 동기화
- `useClassMutations`의 `updateClass`에서 enrollment batch update 수행
- enrollment doc ID = `{classId}` (레거시 `{studentId}_{subject}` 형식 제거 완료)

### 강사 관리
- 강사 순서: `@dnd-kit` 드래그앤드롭으로 시간표 표시 순서 변경 (`teacherOrder` 필드)
- 강사 숨김: `isHidden` 토글로 시간표에서 강사 임시 숨김/표시

## Firebase 설정

- Project ID: `ijw-calander`
- Database ID: `restore20260319`
- Hosting 타겟: prod (`ijw-calander`), dev (`ijw-calander-dev`)
- Multi-tab persistence cache (임베드 모드에서는 비활성화)
- Cloud Functions: `cleanupExpiredRecordings` (Storage 녹음 파일 120일 자동삭제, 매일 실행)

## 빌드 & 배포

```bash
npm run dev          # 개발 서버 (localhost:3001)
npm run build        # 프로덕션 빌드
npm run preview      # 빌드 미리보기
npm run test         # Vitest 테스트
npm run test:ui      # UI 모드 테스트
npm run test:coverage # 커버리지 리포트
npm run lint         # ESLint 검사
npm run lint:fix     # ESLint 자동 수정

# 배포
npm run build && npx firebase deploy --only hosting
```

## 환경 변수

### 필수
```
VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID
VITE_ENCRYPTION_KEY (32자 이상)
VITE_MASTER_EMAILS
```

### 선택
```
VITE_GEMINI_API_KEY (AI 기능)
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (Edutrix 연동)
VITE_OLD_FIREBASE_* (레거시 마이그레이션)
```

## 개발 규칙

- 한국어 UI, 코드 주석은 한국어
- 커밋 메시지: `feat/fix/docs/style/refactor/test/chore: 한국어 설명`
- 프로덕션 빌드 시 console.log/debug/info 자동 제거
- TypeScript strict: false (유연성)
- Path alias: `@` = 프로젝트 루트

## 🚨 커밋·배포 워크플로우 (절대 준수 — 누락 금지)

> **이 워크플로우는 어떤 경우에도 단축·생략 금지.**
> "빌드만", "배포만", "커밋 생략하고 배포만" 같은 요청을 받더라도 — 반드시 **전체 6단계를 순서대로 모두 수행**할 것.
> 사용자가 "배포까지 진행" 또는 "배포해줘"라고 말하면 = **1~6단계 전부 수행하라는 의미**다.
> 다른 디바이스/세션에서 푸시된 최신 커밋과 충돌하지 않도록 origin 동기화가 반드시 선행되어야 함.

### 표준 6단계 (한 단계라도 생략 금지)

```
1. fetch  →  2. merge  →  3. commit  →  4. push  →  5. build  →  6. deploy
```

#### 1단계: 최신 origin 확인 (필수)
```bash
git fetch origin
git log --oneline -5 HEAD          # 로컬 HEAD
git log --oneline -5 origin/main   # origin 최신
```
→ 로컬이 origin보다 뒤처져 있으면 **반드시** 2단계로.

#### 2단계: 로컬이 뒤처져 있으면 머지 (필수)
- **로컬 변경분이 commit 안 됐다면**:
  ```bash
  git stash push --include-untracked -m "WIP: <설명>"
  git pull origin main
  git stash pop   # 충돌 해결
  ```
- **로컬에 이미 commit 했다면**:
  ```bash
  git pull --rebase origin main   # 충돌 해결
  ```

#### 3단계: 커밋 (필수)
- 변경분을 명시적으로 `git add <파일>` (※ `git add -A`/`git add .` 금지 — 캐시 파일 .env 등 실수 방지)
- 한국어 메시지 + Co-Authored-By 태그
- **amend 금지** — 항상 새 커밋
```bash
git commit -m "$(cat <<'EOF'
feat(timetable): <한국어 설명>

- 변경 내용 1
- 변경 내용 2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### 4단계: 푸시 (필수)
```bash
git push origin main
```

#### 5단계: 빌드 (필수)
```bash
npm run build
```
→ 빌드 실패 시 **6단계 진행 금지** — 에러 해결 후 재빌드.

#### 6단계: 배포 (변경 범위에 따라 선택 조합)
- **Hosting만 변경**: `npx firebase deploy --only hosting`
- **Functions 변경**: `npx firebase deploy --only "functions:fnName1,functions:fnName2,..."` (이름 명시)
- **Firestore rules 변경**: `npx firebase deploy --only firestore:rules`
- **여러 항목 동시 배포**: `npx firebase deploy --only "functions:fnName,hosting,firestore:rules"`

### ❌ 자주 하는 실수 (반드시 피할 것)

| 실수 | 결과 | 올바른 방법 |
|------|------|-----------|
| commit/push 생략하고 deploy만 | production에는 반영되지만 GitHub origin이 stale → 다음 작업 시 충돌 | 6단계 모두 수행 |
| fetch 없이 바로 commit/push | 원격에 새 커밋 있으면 push 거부 | 1단계부터 시작 |
| `git add -A` 사용 | `.env`, 캐시, lock 파일 실수 commit | 명시적 파일 추가 |
| 빌드 실패한 상태로 deploy | production 다운/구버전 잔존 | 빌드 성공 후 deploy |
| `--amend` 또는 `--force` | 원격 히스토리 망가짐, 다른 디바이스 동기화 깨짐 | 새 커밋, force push 금지 |
| functions 변경 후 functions deploy 누락 | 클라이언트만 새 코드, 서버는 옛 코드 → 부정합 | 변경 범위 따라 deploy 옵션 명시 |

### 검증 체크리스트 (배포 후 필수)

- [ ] `git log origin/main` — 새 커밋이 origin에 반영됨
- [ ] GitHub 웹에서 commits 페이지 확인 — 최신 커밋 보임
- [ ] production URL에서 변경사항 확인 (시크릿 모드 권장, Service Worker 캐시 우회)
- [ ] Functions 변경 시 `npx firebase functions:log` 로 새 함수 실행 로그 확인

## Skills

커스텀 검증 및 유지보수 스킬은 `.claude/skills/`에 정의되어 있습니다.

| Skill | Purpose |
|-------|---------|
| `verify-implementation` | 프로젝트의 모든 verify 스킬을 순차 실행하여 통합 검증 보고서를 생성합니다 |
| `manage-skills` | 세션 변경사항을 분석하고, 검증 스킬을 생성/업데이트하며, CLAUDE.md를 관리합니다 |
| `verify-timetable` | 시간표 도메인(Math/shared)의 핵심 패턴과 규칙을 검증합니다 |
| `verify-lazy-loading` | 탭/모달/서브매니저의 React.lazy + Suspense + ErrorBoundary 패턴을 검증합니다 |
| `verify-test-coverage` | hooks/utils의 테스트 파일 존재 여부를 검증합니다 |
| `verify-firebase-mutations` | Firebase mutation 훅의 invalidateQueries/에러처리 패턴을 검증합니다 |
| `verify-schedule-tabs` | 일정 그룹(연간일정/간트차트) 탭의 컴포넌트 구조와 핵심 기능을 검증합니다 |
| `verify-class-tabs` | 수업 그룹(시간표/출석부/출결/수업/강의실/강의실배정/숙제/시험/교재) 탭의 핵심 기능을 검증합니다 |
| `verify-student-tabs` | 학생 그룹(학생관리/등록상담/학생상담/성적관리/퇴원관리/계약관리/성적표) 탭의 핵심 기능을 검증합니다 |
| `verify-admin-tabs` | 관리 그룹(수강료계산/수강료현황/직원관리/수납관리/자료실/역할관리/통계분석/급여관리) 탭의 핵심 기능을 검증합니다 |
| `verify-comm-tabs` | 소통 그룹(공지사항/학부모포털/알림센터) 탭의 핵심 기능을 검증합니다 |
| `verify-marketing-tabs` | 마케팅 그룹(마케팅/셔틀관리) 탭의 핵심 기능을 검증합니다 |
| `verify-permissions` | 역할별 탭 접근권한, 버튼 노출, 권한 체크 로직을 검증합니다 |
| `verify-responsive` | 모바일/태블릿/데스크톱 반응형 TailwindCSS 패턴 일관성을 검증합니다 |
| `verify-error-boundaries` | ErrorBoundary + fallback UI + 에러 복구 패턴을 검증합니다 |
| `verify-query-patterns` | React Query 캐시키/enabled/staleTime 일관성과 쿼리 패턴을 검증합니다 |
| `verify-bundle-size` | 코드 스플리팅 효과와 번들 크기를 검증합니다 |
| `verify-tuition-tabs` | 수강료 계산기 탭의 컴포넌트 구조, 데이터 동기화, 청구서 CRUD를 검증합니다 |
| `generate-tab-component` | 새 탭 추가 시 보일러플레이트(컴포넌트/lazy import/권한/메타데이터)를 자동 생성합니다 |
| `generate-hook-test` | 훅 테스트 템플릿을 프로젝트 표준 패턴에 맞춰 자동 생성합니다 |
| `generate-import-modal` | Excel 가져오기 모달을 useExcelImport 훅 기반으로 자동 생성합니다 |
