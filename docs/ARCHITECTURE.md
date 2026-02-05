# 아키텍처 문서

## 목차

- [시스템 개요](#시스템-개요)
- [아키텍처 다이어그램](#아키텍처-다이어그램)
- [데이터 모델](#데이터-모델)
- [주요 컴포넌트 관계](#주요-컴포넌트-관계)
- [데이터 흐름](#데이터-흐름)
- [상태 관리 전략](#상태-관리-전략)
- [성능 최적화](#성능-최적화)
- [보안 설계](#보안-설계)

---

## 시스템 개요

인재원 학원 관리 시스템은 **React + Firebase** 기반의 **SPA (Single Page Application)**로 구현되었습니다.

### 아키텍처 특징

- **Client-Side Rendering (CSR)**: Vite + React 기반 빠른 로딩
- **Real-time Sync**: Firestore 실시간 리스너로 즉각 반영
- **Offline-First**: Firestore 로컬 캐시로 오프라인 지원
- **Modular Design**: 기능별 독립 모듈로 유지보수 용이

---

## 아키텍처 다이어그램

### 전체 시스템 구조

```
┌─────────────────────────────────────────────────────────┐
│                     Web Browser                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │              React Application                    │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │  │
│  │  │  Auth    │  │  State   │  │  Router  │       │  │
│  │  │  Context │  │  Hooks   │  │  (App)   │       │  │
│  │  └──────────┘  └──────────┘  └──────────┘       │  │
│  │         │              │              │          │  │
│  │  ┌──────▼──────────────▼──────────────▼──────┐  │  │
│  │  │         Component Tree                    │  │  │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐        │  │  │
│  │  │  │Calendar│ │Timetable│ │Students│  ...  │  │  │
│  │  │  └────────┘ └────────┘ └────────┘        │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  │         │                                       │  │
│  │  ┌──────▼─────────────────────────────────┐    │  │
│  │  │       React Query (Data Cache)        │    │  │
│  │  └──────────────────────────────────────┬┘    │  │
│  └─────────────────────────────────────────│─────┘  │
│                                             │        │
└─────────────────────────────────────────────┼────────┘
                                              │
                        ┌─────────────────────▼─────┐
                        │    Firebase Services      │
                        │  ┌──────────────────────┐ │
                        │  │  Authentication      │ │
                        │  └──────────────────────┘ │
                        │  ┌──────────────────────┐ │
                        │  │  Firestore Database  │ │
                        │  │  (Multi-tab Cache)   │ │
                        │  └──────────────────────┘ │
                        │  ┌──────────────────────┐ │
                        │  │  Storage (Future)    │ │
                        │  └──────────────────────┘ │
                        └──────────────────────────┘
```

### 컴포넌트 계층 구조

```
App
├── RoleSimulationProvider (권한 시뮬레이션)
├── ErrorBoundary (에러 처리)
├── HeaderCollapseProvider (헤더 접기/펼치기)
│
├── Sidebar (네비게이션)
│
├── Header
│   ├── Breadcrumb (경로 표시)
│   ├── CalendarFilterBar (캘린더 필터)
│   ├── TimetableNavBar (시간표 네비게이션)
│   ├── AttendanceNavBar (출석 네비게이션)
│   ├── StudentsNavBar (학생 필터)
│   ├── ProfileDropdown (프로필 메뉴)
│   └── MemoDropdown (메모/메신저)
│
└── Main (탭별 컨텐츠)
    ├── DashboardTab (대시보드)
    ├── CalendarBoard (연간 일정)
    ├── TimetableManager (시간표)
    │   ├── MathClassTab
    │   └── EnglishClassTab
    ├── AttendanceManager (출석)
    ├── StudentManagementTab (학생 관리)
    ├── ConsultationManager (등록 상담)
    ├── BillingManager (수납 관리)
    ├── GradesManager (성적 관리)
    ├── StaffManager (강사 관리)
    ├── ClassroomTab (교실 배정)
    └── GanttManager (간트 차트)
```

---

## 데이터 모델

### Firestore 컬렉션 구조

```
restore260202 (Database)
├── students (학생)
│   ├── {studentId}
│   │   ├── name: string
│   │   ├── status: 'active' | 'withdrawn' | 'prospect'
│   │   ├── grade: string
│   │   ├── phone: string (encrypted)
│   │   ├── attendanceNumber: number
│   │   ├── createdAt: string
│   │   └── enrollments (서브컬렉션)
│   │       └── {enrollmentId}
│   │           ├── subject: 'math' | 'english'
│   │           ├── className: string
│   │           ├── staffId: string
│   │           └── startDate: string
│
├── classes (반)
│   └── {classId}
│       ├── className: string
│       ├── subject: 'math' | 'english' | 'science' | 'korean'
│       ├── teacher: string (mainTeacher)
│       ├── slotTeachers: Record<string, string>
│       ├── slotRooms: Record<string, string>
│       ├── schedule: Array<{day, periodId}>
│       ├── isActive: boolean
│       └── students (서브컬렉션)
│           └── {studentId}
│               ├── name: string
│               └── attendanceNumber: number
│
├── staff (강사/직원)
│   └── {staffId}
│       ├── name: string
│       ├── englishName: string
│       ├── email: string
│       ├── uid: string (Firebase Auth UID)
│       ├── systemRole: 'master' | 'admin' | 'teacher' | ...
│       ├── jobTitle: string
│       ├── approvalStatus: 'approved' | 'pending'
│       ├── departmentPermissions: Record<string, 'view'>
│       └── favoriteDepartments: string[]
│
├── staffIndex (UID → StaffID 매핑)
│   └── {uid}
│       ├── staffId: string
│       ├── systemRole: string
│       └── updatedAt: string
│
├── attendance_records (출석 기록)
│   └── {year}-{month}
│       └── {staffId}
│           └── {studentId}
│               ├── dates: string[] (출석한 날짜)
│               └── subject: 'math' | 'english'
│
├── attendance_config (급여 설정)
│   └── {staffId}
│       ├── type: 'hourly' | 'monthly'
│       ├── hourlyRate: number
│       ├── monthlyBase: number
│       └── ...
│
├── student_consultations (학생 상담 기록)
│   └── {consultationId}
│       ├── studentId: string
│       ├── date: string
│       ├── content: string
│       ├── status: 'pending' | 'completed'
│       └── createdBy: string
│
├── registration_consultations (등록 상담)
│   └── {consultationId}
│       ├── prospectName: string
│       ├── phone: string (encrypted)
│       ├── status: 'pending' | 'registered' | 'rejected'
│       ├── registeredStudentId?: string
│       └── consultationDate: string
│
├── events (일정)
│   └── {eventId}
│       ├── 제목: string
│       ├── 시작일: string
│       ├── 종료일: string
│       ├── departmentId: string
│       ├── departmentIds: string[] (다중 부서)
│       └── authorId: string
│
├── departments (부서)
│   └── {deptId}
│       ├── name: string
│       ├── category: string
│       └── color: string
│
├── systemConfig (시스템 설정)
│   └── config
│       ├── masterEmails: string[]
│       ├── categories: string[]
│       └── eventLookbackYears: number
│
├── gantt_projects (간트 프로젝트)
│   └── {projectId}
│       ├── title: string
│       ├── startDate: string
│       ├── endDate: string
│       └── departmentId: string
│
└── billing_records (수납 기록)
    └── {billingId}
        ├── studentId: string
        ├── amount: number
        ├── dueDate: string
        └── status: 'paid' | 'pending'
```

### 주요 데이터 타입

#### Student (학생)

```typescript
interface UnifiedStudent {
  id: string;
  name: string;
  status: 'active' | 'withdrawn' | 'prospect';
  grade?: string;
  phone?: string; // 암호화됨
  attendanceNumber?: number;
  enrollments?: Enrollment[];
  createdAt: string;
  updatedAt: string;
}
```

#### Enrollment (수강 이력)

```typescript
interface Enrollment {
  id: string;
  subject: 'math' | 'english' | 'science' | 'korean';
  className: string;
  staffId: string;
  startDate: string;
  endDate?: string;
}
```

#### StaffMember (강사/직원)

```typescript
interface StaffMember {
  id: string;
  name: string;
  englishName?: string;
  email: string;
  uid?: string;
  systemRole: 'master' | 'admin' | 'manager' | 'math_lead' | 'english_lead' | 'math_teacher' | 'english_teacher' | 'user';
  jobTitle?: string;
  approvalStatus: 'approved' | 'pending' | 'rejected';
  departmentPermissions?: Record<string, 'view'>;
  favoriteDepartments?: string[];
}
```

#### ClassInfo (반)

```typescript
interface ClassInfo {
  id: string;
  className: string;
  subject: 'math' | 'english' | 'science' | 'korean' | 'other';
  teacher: string; // mainTeacher
  slotTeachers?: Record<string, string>; // {day-period: staffId}
  slotRooms?: Record<string, string>; // {day-period: roomName}
  schedule?: string[]; // ["월 1교시", "수 2교시"]
  studentCount?: number;
  isActive: boolean;
}
```

---

## 주요 컴포넌트 관계

### 인증 흐름

```
LoginModal
    │
    ▼
Firebase Auth (signInWithEmailAndPassword)
    │
    ▼
onAuthStateChanged (useAuth.ts)
    │
    ├─► staff 컬렉션 조회 (uid로)
    │   │
    │   ├─► 문서 있음 → UserProfile 생성
    │   │
    │   └─► 문서 없음
    │       │
    │       ├─► email로 재조회
    │       │   │
    │       │   ├─► 있음 → uid 링크
    │       │   │
    │       │   └─► 없음 → 신규 생성
    │       │
    │       └─► staffIndex 생성/업데이트
    │
    └─► setUserProfile → App 전역 사용
```

### 권한 체크 흐름

```
UserProfile (effectiveProfile)
    │
    ▼
usePermissions(effectiveProfile)
    │
    ├─► hasPermission(permissionKey)
    │   │
    │   ├─► master/admin → true
    │   │
    │   ├─► role-based permissions 체크
    │   │
    │   └─► custom permissions 체크
    │
    └─► useTabPermissions(effectiveProfile)
        │
        └─► canAccessTab(tabName)
            │
            ├─► master/admin → true
            │
            ├─► TAB_META[tabName].requiredPermissions 체크
            │
            └─► allowAll 탭 → true
```

### 데이터 조회 흐름 (React Query)

```
Component
    │
    ▼
useStudents(includeWithdrawn, enabled)
    │
    ▼
React Query (useQuery)
    │
    ├─► Cache Hit → 캐시 반환
    │
    └─► Cache Miss
        │
        ▼
    Firestore getDocs(collection(db, 'students'))
        │
        ▼
    fetchAllEnrollmentsOptimized (collectionGroup 최적화)
        │
        ▼
    students 배열 반환
        │
        ▼
    React Query 캐시 (5분 staleTime)
```

---

## 데이터 흐름

### 학생 등록 플로우

```
1. 등록 상담 기록 생성
   registration_consultations 컬렉션에 저장
   status: 'pending'

2. 상담 진행 → 등록 결정

3. "재원생 전환" 버튼 클릭
   │
   ├─► students 컬렉션에 학생 문서 생성
   │   status: 'active'
   │
   ├─► enrollments 서브컬렉션에 수강 이력 추가
   │   subject, className, staffId 등
   │
   ├─► classes/{classId}/students/{studentId} 추가
   │   (반에 학생 배정)
   │
   └─► registration_consultations 업데이트
       status: 'registered'
       registeredStudentId: {studentId}
```

### 출석 체크 플로우

```
1. AttendanceManager 진입
   │
   ├─► useAttendance(subject, staffId, year, month)
   │   Firestore에서 출석 기록 조회
   │
   └─► 학생 목록 표시 (해당 강사의 수업 학생만)

2. 출석 체크박스 클릭
   │
   ▼
handleAttendanceToggle
   │
   ├─► Optimistic Update (UI 즉시 반영)
   │
   └─► Firestore 업데이트
       attendance_records/{year-month}/{staffId}/{studentId}
       dates 배열에 날짜 추가/제거

3. 급여 계산
   │
   ├─► 시급제: 출석 횟수 × 시급
   │
   └─► 월급제: 기본급 + (추가 출석 × 시급)
```

### 시간표 반 이동 플로우

```
1. 시간표에서 학생 선택
   │
   ▼
2. "반 이동" 버튼 클릭
   │
   ├─► 시뮬레이션 모드 진입
   │   UI에만 이동 반영 (Firestore 미수정)
   │
   └─► 확정 버튼 클릭
       │
       ├─► 기존 enrollment 종료 (endDate 설정)
       │
       ├─► 새 enrollment 생성 (새 className)
       │
       ├─► 기존 class/students에서 제거
       │
       └─► 새 class/students에 추가
```

---

## 상태 관리 전략

### 로컬 상태 (useState)

- UI 상태 (모달 열림/닫힘, 필터 값 등)
- 폼 입력 값

### 전역 상태 (Context)

- **RoleSimulationProvider**: 권한 시뮬레이션 상태
- **HeaderCollapseProvider**: 헤더 접기/펼치기 상태

### 서버 상태 (React Query)

- Firestore 데이터 (students, classes, staff, etc.)
- **장점**:
  - 자동 캐싱 (staleTime 5분)
  - 백그라운드 재요청 (refetchOnWindowFocus 비활성화)
  - 낙관적 업데이트 (Optimistic Update)
  - 중복 요청 방지

### 파생 상태 (useMemo)

- 필터링된 데이터
- 통계 계산
- 정렬된 목록

```typescript
const activeStudents = useMemo(() =>
  students.filter(s => s.status === 'active'),
  [students]
);
```

---

## 성능 최적화

### 1. React Query 도입

- **N+1 문제 해결**: collectionGroup으로 한 번에 조회
- **캐싱**: 5분 staleTime으로 불필요한 재요청 방지
- **비용 절감**: Firebase 읽기 비용 90% 절감

### 2. Lazy Loading

- 탭별 컴포넌트 지연 로딩 (React.lazy)
- 모달 지연 로딩
- 번들 크기 30-50KB 감소

```typescript
const TimetableManager = lazy(() => import('./components/Timetable/TimetableManager'));
```

### 3. 메모이제이션

- useMemo로 비용이 큰 계산 캐싱
- useCallback으로 함수 재생성 방지
- React.memo로 불필요한 리렌더링 차단

### 4. Firestore 최적화

- **Persistent Cache**: 로컬 캐시로 오프라인 지원
- **복합 인덱스**: 쿼리 성능 향상
- **where 조건 최소화**: 불필요한 필터 제거

### 5. 이미지/비디오 최적화

- 로딩 화면에 비디오 사용 (LoadingPage2.mp4)
- 이미지 lazy loading

---

## 보안 설계

### 1. 인증 (Authentication)

- Firebase Authentication 사용
- 이메일/비밀번호 인증
- 세션 자동 관리

### 2. 개인정보 암호화

- **crypto-js** AES 암호화
- 전화번호, 주소 등 민감 정보 암호화
- 암호화 키는 환경 변수로 관리 (VITE_ENCRYPTION_KEY)

```typescript
import CryptoJS from 'crypto-js';

const encryptedPhone = CryptoJS.AES.encrypt(
  phone,
  import.meta.env.VITE_ENCRYPTION_KEY
).toString();
```

### 3. Firestore 보안 규칙

```javascript
// 예시 (실제 구현 필요)
match /students/{studentId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null &&
               get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.systemRole in ['master', 'admin'];
}
```

### 4. 권한 기반 접근 제어 (RBAC)

- 역할별 권한 정의
- 컴포넌트 레벨 권한 체크
- API 호출 전 권한 검증

### 5. 환경 변수 보호

- `.env.local` 파일 Git 제외 (.gitignore)
- 민감 정보 절대 하드코딩 금지
- 프로덕션 환경에서 안전한 방식으로 주입

---

## 확장성 고려사항

### 1. 다국어 지원 (i18n)

- react-i18next 도입 예정
- 언어별 번역 파일 분리

### 2. 테마 시스템

- 다크 모드 지원 (useDarkMode 훅 이미 존재)
- Tailwind CSS 테마 변수 활용

### 3. 모바일 반응형

- Tailwind CSS breakpoints 활용
- 터치 이벤트 최적화

### 4. 오프라인 모드 강화

- Service Worker 도입
- IndexedDB 활용

### 5. 분석/모니터링

- Google Analytics 통합
- Sentry 에러 추적

---

## 참고 자료

- [React Query 공식 문서](https://tanstack.com/query/latest)
- [Firebase Firestore 문서](https://firebase.google.com/docs/firestore)
- [Tailwind CSS 문서](https://tailwindcss.com/docs)
