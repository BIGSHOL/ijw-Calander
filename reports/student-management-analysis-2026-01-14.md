# 학생 관리 시스템 분석 보고서

**날짜**: 2026-01-14
**작성자**: Claude Code
**목적**: 학생 관리 탭과 연동되는 네비게이션 시스템 분석 및 개선 사항 정리

---

## 1. 개요

본 보고서는 인재원 캘린더 시스템의 학생 관리(StudentManagement) 모듈과 연관된 네비게이션 탭들의 구조, 데이터 흐름, 그리고 수행된 개선 사항을 문서화합니다.

---

## 2. 네비게이션 시스템 구조

### 2.1 탭 그룹 구성

시스템은 **4개 그룹, 13개 탭**으로 구성되어 있습니다.

| 그룹 | 아이콘 | 포함 탭 | Order |
|------|--------|---------|-------|
| 일정 | 📅 | calendar, gantt | 1 |
| 수업 | 📚 | timetable, attendance, daily-attendance, classes | 2 |
| 학생 | 👥 | students, consultation, student-consultations, grades | 3 |
| 관리 | ⚙️ | payment, staff, billing | 4 |

### 2.2 탭 메타 정보 (types.ts)

```typescript
TAB_META = {
  // 학생 그룹
  students: { label: '학생 관리', icon: '👥', description: '학생 정보 관리' },
  consultation: { label: '입학 상담', icon: '📞', description: '신규 상담 기록' },
  'student-consultations': { label: '상담 관리', icon: '💬', description: '재원생 상담' },
  grades: { label: '성적 관리', icon: '📊', description: '시험 성적 관리' },

  // 수업 그룹 (학생 데이터 연동)
  timetable: { label: '시간표', icon: '🗓️' },
  attendance: { label: '출석부', icon: '✅' },
  'daily-attendance': { label: '출결 관리', icon: '📋' },
  classes: { label: '수업 관리', icon: '📖' },
}
```

---

## 3. 학생 관리와 연동되는 탭

### 3.1 직접 연동 (👥 학생 그룹)

| 탭 ID | 기능 | 컴포넌트 | 데이터 연동 |
|-------|------|----------|------------|
| `students` | 학생 관리 | StudentManagementTab | UnifiedStudent 전체 |
| `consultation` | 입학 상담 | ConsultationManager | ConsultationRecord |
| `student-consultations` | 상담 관리 | ConsultationManagementTab | Consultation |
| `grades` | 성적 관리 | GradesManager | StudentScore |

### 3.2 간접 연동 (📚 수업 그룹)

| 탭 ID | 학생 관련 데이터 | 연동 방식 |
|-------|-----------------|----------|
| `timetable` | Enrollment[] | 학생 수강 정보 표시 |
| `attendance` | AttendanceRecord | 학생별 출결 기록 |
| `daily-attendance` | DailyAttendanceRecord | 일별 출결 상태 |
| `classes` | UnifiedClass.students | 반별 학생 목록 |

### 3.3 데이터 흐름도

```
┌─────────────────────────────────────────────────────────────┐
│                    StudentManagementTab                      │
│                      (students 탭)                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ BasicInfoTab│  │ CoursesTab  │  │  GradesTab  │         │
│  │             │  │             │  │             │         │
│  │ UnifiedStudent│ │ Enrollment[]│ │StudentScore[]│        │
│  │ 기본 정보    │  │ 수강 정보   │  │ 성적 정보   │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  ConsultationsTab                    │   │
│  │                   Consultation[]                     │   │
│  │                    상담 기록                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         │                │                │
         ▼                ▼                ▼
    ┌─────────┐    ┌─────────────┐   ┌──────────┐
    │timetable│    │   classes   │   │  grades  │
    │ 시간표  │    │  수업 관리  │   │ 성적관리 │
    └─────────┘    └─────────────┘   └──────────┘
         │
         ▼
    ┌──────────────────────────┐
    │  attendance 관련 탭들    │
    │  (출석부, 출결관리)      │
    └──────────────────────────┘
```

---

## 4. 컴포넌트 파일 구조

### 4.1 StudentManagement 디렉토리

```
components/StudentManagement/
├── StudentManagementTab.tsx     # 메인 컨테이너 (반응형 개선 완료)
├── StudentList.tsx              # 좌측 학생 목록 패널
├── StudentDetail.tsx            # 우측 상세 정보 패널
├── AddStudentModal.tsx          # 학생 추가 모달
├── AssignClassModal.tsx         # 반 배치 모달
└── tabs/
    ├── BasicInfoTab.tsx         # 기본 정보 탭
    ├── CoursesTab.tsx           # 수강 정보 탭
    ├── GradesTab.tsx            # 성적 탭
    └── ConsultationsTab.tsx     # 상담 기록 탭
```

### 4.2 연관 컴포넌트 디렉토리

```
components/
├── Consultation/                # 입학 상담 (consultation 탭)
│   ├── ConsultationManager.tsx
│   ├── ConsultationDashboard.tsx
│   ├── ConsultationForm.tsx
│   └── ConsultationTable.tsx
│
├── ConsultationManagement/      # 상담 관리 (student-consultations 탭)
│   ├── ConsultationManagementTab.tsx
│   ├── ConsultationList.tsx
│   └── ConsultationDetailModal.tsx
│
├── Grades/                      # 성적 관리 (grades 탭)
│   └── GradesManager.tsx
│
├── ClassManagement/             # 수업 관리 (classes 탭)
│   ├── ClassManagementTab.tsx
│   └── ClassStudentList.tsx
│
├── DailyAttendance/             # 출결 관리 (daily-attendance 탭)
│   ├── DailyAttendanceManager.tsx
│   └── AttendanceCalendar.tsx
│
└── Attendance/                  # 출석부 (attendance 탭)
    └── AttendanceManager.tsx
```

---

## 5. 권한 시스템

### 5.1 역할별 학생 관련 탭 접근 권한

| 역할 | students | consultation | student-consultations | grades | classes |
|------|----------|--------------|----------------------|--------|---------|
| master | ✅ | ✅ | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| manager | ✅ | ✅ | ✅ | ✅ | ✅ |
| math_lead | ✅ | ❌ | ✅ | ✅ | ✅ |
| english_lead | ✅ | ❌ | ✅ | ✅ | ✅ |
| math_teacher | ❌ | ❌ | ❌ | ❌ | ❌ |
| english_teacher | ❌ | ❌ | ❌ | ❌ | ❌ |
| user | ❌ | ❌ | ❌ | ❌ | ❌ |
| viewer | ❌ | ❌ | ❌ | ❌ | ❌ |
| guest | ❌ | ❌ | ❌ | ❌ | ❌ |

### 5.2 권한 검증 Hook

```typescript
// hooks/useTabPermissions.ts
const { canAccessTab, accessibleTabs } = useTabPermissions(userProfile);

// 사용 예시
if (canAccessTab('students')) {
  // 학생 관리 탭 접근 허용
}
```

---

## 6. 데이터 타입

### 6.1 UnifiedStudent (핵심 데이터 타입)

```typescript
interface UnifiedStudent {
  // 기본 정보
  id: string;                    // UUID
  name: string;                  // 이름
  englishName?: string;          // 영어 이름
  school?: string;               // 학교
  grade?: string;                // 학년

  // 수강 정보
  enrollments: Enrollment[];     // 과목별 수강 정보

  // 상태 관리
  status: 'active' | 'on_hold' | 'withdrawn';
  startDate: string;             // 등록일 (YYYY-MM-DD)
  endDate?: string;              // 퇴원일
  isOldWithdrawn?: boolean;      // 90일 이상 경과 (과거 퇴원생)

  // 메타데이터
  createdAt: string;
  updatedAt: string;
}
```

### 6.2 Enrollment (수강 정보)

```typescript
interface Enrollment {
  subject: 'math' | 'english';   // 과목
  classId: string;               // 수업 ID
  className: string;             // 수업명
  teacherId: string;             // 강사 ID
  days: string[];                // 요일 ['월', '수', '금']
}
```

### 6.3 StudentFilters (필터 상태)

```typescript
interface StudentFilters {
  searchQuery: string;           // 검색어
  grade: string;                 // 학년 필터 ('all' | '초1' | ... | '고3')
  status: 'all' | 'active' | 'on_hold' | 'withdrawn';
  subject: string;               // 과목 필터 ('all' | 'math' | 'english')
}
```

---

## 7. 수행된 개선 사항

### 7.1 StudentManagementTab 반응형 개선

**이전 문제점** (반응형 감사 보고서 점수: 40/100)
- 고정 너비 레이아웃 (`w-[28%] min-w-[280px]`)
- 768px 미만에서 좌우 패널이 압축됨
- 모바일 사용성 저하

**개선 내용**

1. **레이아웃 변경**
```tsx
// 이전
<div className="flex h-full bg-gray-50">

// 개선 후
<div className="flex flex-col md:flex-row h-full bg-gray-50">
```

2. **좌측 패널 (학생 목록)**
```tsx
<div className={`
  w-full md:w-[28%] md:min-w-[280px] md:max-w-[350px]
  border-r border-gray-300 bg-white flex flex-col
  ${selectedStudent ? 'hidden md:flex' : 'flex'}
`}>
```
- 모바일: 전체 너비
- 학생 선택 시 모바일에서 숨김

3. **우측 패널 (학생 상세)**
```tsx
<div className={`
  flex-1 bg-white flex flex-col
  ${selectedStudent ? 'flex' : 'hidden md:flex'}
`}>
```
- 학생 미선택 시 모바일에서 숨김
- 선택 시 전체 화면으로 표시

4. **모바일 전용 뒤로가기 버튼**
```tsx
<div className="md:hidden p-2 border-b border-gray-200 bg-[#081429]">
  <button onClick={() => setSelectedStudent(null)}>
    <ArrowLeft /> 목록으로
  </button>
</div>
```

**개선 후 예상 점수**: 85/100

---

## 8. 향후 개선 제안

### 8.1 높은 우선순위 (P1)

1. **탭 간 데이터 동기화 강화**
   - StudentDetail의 GradesTab ↔ grades 탭 실시간 동기화
   - ConsultationsTab ↔ student-consultations 탭 연동

2. **StudentList 페이지네이션 버튼 터치 영역**
   - 현재: `px-2 py-0.5` (약 24x20px)
   - 권장: `px-3 py-2` (최소 44x32px)

### 8.2 중간 우선순위 (P2)

1. **학생 상세 탭 반응형**
   - BasicInfoTab, CoursesTab 등 내부 폼 반응형 검토

2. **검색 UX 개선**
   - 모바일에서 검색 필터 접기/펼치기

### 8.3 낮은 우선순위 (P3)

1. **학생 카드 뷰**
   - 목록 뷰 외 카드 뷰 옵션 추가

2. **빠른 액션**
   - 학생 목록에서 바로 출결 체크, 상담 추가 등

---

## 9. 테스트 체크리스트

### 9.1 기능 테스트

- [ ] 학생 목록 로딩
- [ ] 학생 검색 (이름, 영어명, 학교)
- [ ] 필터링 (학년, 상태, 과목)
- [ ] 정렬 (이름, 학년, 등록일)
- [ ] 과거 퇴원생 자동 검색
- [ ] 학생 선택 → 상세 정보 표시
- [ ] 학생 추가 모달

### 9.2 반응형 테스트

- [ ] 데스크톱 (1920x1080): 좌우 분할 레이아웃
- [ ] 태블릿 (768x1024): 좌우 분할 유지
- [ ] 모바일 (375x667): 목록/상세 전환 방식
- [ ] 모바일에서 뒤로가기 버튼 동작

### 9.3 탭 연동 테스트

- [ ] students ↔ grades 탭 데이터 일치
- [ ] students ↔ classes 탭 수강 정보 일치
- [ ] students ↔ student-consultations 상담 기록 일치

---

## 10. 관련 파일 경로

### 네비게이션
- `components/Navigation/Sidebar.tsx`
- `components/Navigation/NavigationBar.tsx`
- `components/Navigation/TabGroupDropdown.tsx`

### 학생 관리
- `components/StudentManagement/StudentManagementTab.tsx` ✅ 개선 완료
- `components/StudentManagement/StudentList.tsx`
- `components/StudentManagement/StudentDetail.tsx`

### 타입 및 설정
- `types.ts` (TAB_GROUPS, TAB_META, UnifiedStudent)
- `App.tsx` (appMode, studentFilters)
- `hooks/useTabPermissions.ts`

---

**보고서 종료**
