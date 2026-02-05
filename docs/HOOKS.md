# 커스텀 훅 가이드

## 목차

- [개요](#개요)
- [데이터 훅](#데이터-훅)
- [상태 관리 훅](#상태-관리-훅)
- [유틸리티 훅](#유틸리티-훅)
- [권한 관련 훅](#권한-관련-훅)
- [성능 최적화 팁](#성능-최적화-팁)

---

## 개요

이 프로젝트는 **커스텀 훅 기반 아키텍처**를 채택하여 로직 재사용성과 테스트 용이성을 높였습니다.

### 훅 분류

1. **데이터 훅**: Firebase 데이터 CRUD (React Query 기반)
2. **상태 관리 훅**: 전역 상태 관리 (useState/Context)
3. **유틸리티 훅**: 재사용 가능한 로직
4. **권한 관련 훅**: RBAC 권한 체크

---

## 데이터 훅

### useStudents

학생 데이터를 조회하고 관리하는 훅입니다.

#### 파일 위치
`hooks/useStudents.ts`

#### 사용법

```typescript
import { useStudents } from './hooks/useStudents';

function StudentList() {
  const {
    students,           // 학생 목록
    loading,            // 로딩 상태
    error,              // 에러 메시지
    addStudent,         // 학생 추가
    updateStudent,      // 학생 수정
    deleteStudent,      // 학생 삭제
    refreshStudents,    // 수동 새로고침
  } = useStudents(
    false,  // includeWithdrawn: 퇴원생 포함 여부
    true    // enabled: 쿼리 활성화 여부
  );

  return (
    <div>
      {loading && <p>로딩 중...</p>}
      {error && <p>에러: {error}</p>}
      {students.map(student => (
        <div key={student.id}>{student.name}</div>
      ))}
    </div>
  );
}
```

#### 주요 기능

- **enrollments 자동 조회**: collectionGroup으로 최적화
- **캐싱**: 5분 staleTime으로 불필요한 재요청 방지
- **낙관적 업데이트**: UI 즉시 반영

#### 파라미터

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| includeWithdrawn | boolean | false | 퇴원생 포함 여부 |
| enabled | boolean | true | 쿼리 활성화 여부 |

#### 반환값

| 속성 | 타입 | 설명 |
|------|------|------|
| students | UnifiedStudent[] | 학생 목록 |
| loading | boolean | 로딩 상태 |
| error | string \| null | 에러 메시지 |
| addStudent | (data) => Promise | 학생 추가 |
| updateStudent | (id, updates) => Promise | 학생 수정 |
| deleteStudent | (id, hardDelete) => Promise | 학생 삭제 |
| refreshStudents | () => Promise | 수동 새로고침 |

---

### useClasses

반(수업) 데이터를 조회하는 훅입니다.

#### 파일 위치
`hooks/useClasses.ts`

#### 사용법

```typescript
import { useClasses } from './hooks/useClasses';

function ClassList() {
  const { data: classes, isLoading, error } = useClasses('math', true);

  if (isLoading) return <p>로딩 중...</p>;
  if (error) return <p>에러 발생</p>;

  return (
    <div>
      {classes?.map(cls => (
        <div key={cls.id}>
          {cls.className} - {cls.studentCount}명
        </div>
      ))}
    </div>
  );
}
```

#### 파라미터

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| subject | 'math' \| 'english' \| boolean | - | 과목 필터 (선택) |
| enabled | boolean | true | 쿼리 활성화 여부 |

#### 반환값 (React Query)

| 속성 | 타입 | 설명 |
|------|------|------|
| data | ClassInfo[] | 반 목록 |
| isLoading | boolean | 로딩 상태 |
| error | Error \| null | 에러 객체 |
| refetch | () => Promise | 수동 새로고침 |

---

### useAttendance

출석 데이터를 관리하는 훅입니다.

#### 파일 위치
`hooks/useAttendance.ts`

#### 사용법

```typescript
import { useAttendance } from './hooks/useAttendance';

function AttendanceManager() {
  const {
    attendanceStudents,   // 출석 대상 학생 목록
    loading,
    toggleAttendance,     // 출석 토글
    batchUpdate,          // 일괄 업데이트
  } = useAttendance('math', 'teacher123', 2024, 3);

  const handleCheckbox = (studentId: string, date: string) => {
    toggleAttendance.mutate({ studentId, date });
  };

  return (
    <div>
      {attendanceStudents.map(student => (
        <div key={student.id}>
          <input
            type="checkbox"
            checked={student.attendanceDates.includes('2024-03-15')}
            onChange={() => handleCheckbox(student.id, '2024-03-15')}
          />
          {student.name}
        </div>
      ))}
    </div>
  );
}
```

#### 파라미터

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| subject | 'math' \| 'english' | 과목 |
| staffId | string \| undefined | 강사 ID |
| year | number | 연도 |
| month | number | 월 (1-12) |

#### 주요 기능

- **실시간 동기화**: Firestore 리스너로 자동 갱신
- **낙관적 업데이트**: 체크박스 즉시 반영
- **급여 자동 계산**: 출석 횟수 기반 급여 산출

---

### useAuth

사용자 인증 상태를 관리하는 훅입니다.

#### 파일 위치
`hooks/useAuth.ts`

#### 사용법

```typescript
import { useAuth } from './hooks/useAuth';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { data: systemConfig } = useSystemConfig(!!currentUser);

  const {
    userProfile,        // 사용자 프로필
    authLoading,        // 인증 로딩
    handleLogout,       // 로그아웃
  } = useAuth({
    setCurrentUser,
    systemConfig,
    onShowLogin: () => setIsLoginModalOpen(true),
  });

  return (
    <div>
      {authLoading ? <LoadingScreen /> : <MainApp />}
    </div>
  );
}
```

#### 주요 기능

- **실시간 프로필 동기화**: onSnapshot으로 staff 컬렉션 감시
- **자동 uid 링크**: email 매칭 시 uid 자동 연결
- **staffIndex 관리**: UID → StaffID 매핑 테이블 유지

---

### useConsultations

상담 기록을 관리하는 훅입니다.

#### 파일 위치
`hooks/useConsultations.ts`

#### 사용법

```typescript
import { useConsultations } from './hooks/useConsultations';

function ConsultationList() {
  const {
    consultations,
    loading,
    addConsultation,
    updateConsultation,
    deleteConsultation,
  } = useConsultations();

  const handleAdd = async () => {
    await addConsultation({
      prospectName: '홍길동',
      phone: '010-1234-5678',
      status: 'pending',
      consultationDate: '2024-03-15',
    });
  };

  return (
    <div>
      <button onClick={handleAdd}>상담 추가</button>
      {consultations.map(c => (
        <div key={c.id}>{c.prospectName} - {c.status}</div>
      ))}
    </div>
  );
}
```

---

## 상태 관리 훅

### useAppState

앱 전역 상태를 관리하는 훅 모음입니다.

#### 파일 위치
`hooks/useAppState.ts`

#### 포함된 훅

- **useCalendarState**: 캘린더 필터/뷰 상태
- **useEventModalState**: 이벤트 모달 상태
- **useModalState**: 각종 모달 열림/닫힘
- **useTimetableState**: 시간표 과목/뷰타입
- **useStudentFilterState**: 학생 필터 상태
- **useDarkMode**: 다크 모드 토글

#### 사용법

```typescript
import { useCalendarState, useDarkMode } from './hooks/useAppState';

function App() {
  const { viewMode, setViewMode, hiddenDeptIds, setHiddenDeptIds } = useCalendarState();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
        <option value="monthly">월별</option>
        <option value="yearly">연별</option>
      </select>
    </div>
  );
}
```

---

### useForm

폼 상태를 관리하는 훅입니다.

#### 파일 위치
`hooks/useForm.ts`

#### 사용법

```typescript
import { useForm } from './hooks/useForm';

function StudentForm() {
  const { values, errors, handleChange, handleSubmit, resetForm } = useForm(
    { name: '', grade: '' },  // 초기값
    (values) => {             // 검증 함수
      const errors: any = {};
      if (!values.name) errors.name = '이름을 입력하세요';
      return errors;
    },
    async (values) => {       // 제출 핸들러
      await addStudent(values);
    }
  );

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="name"
        value={values.name}
        onChange={handleChange}
      />
      {errors.name && <span>{errors.name}</span>}
      <button type="submit">저장</button>
    </form>
  );
}
```

---

## 유틸리티 훅

### useGlobalSearch

전역 검색 기능을 제공하는 훅입니다.

#### 파일 위치
`hooks/useGlobalSearch.ts`

#### 사용법

```typescript
import { useGlobalSearch } from './hooks/useGlobalSearch';

function Header() {
  const { handleGlobalSearch, handleSearchSelect } = useGlobalSearch({
    globalStudents,
    events,
    departments,
    allClasses,
    teachers,
    setAppMode,
    setStudentFilters,
    setEditingEvent,
    setIsEventModalOpen,
    setIsGlobalSearchOpen,
  });

  return (
    <GlobalSearch
      isOpen={isGlobalSearchOpen}
      onClose={() => setIsGlobalSearchOpen(false)}
      onSearch={handleGlobalSearch}
      onSelect={handleSearchSelect}
    />
  );
}
```

#### 검색 대상

- 학생 (이름)
- 일정 (제목)
- 반 (반명)
- 부서 (부서명)
- 강사 (이름)

---

### useFocusTrap

모달 내부에 포커스를 가두는 훅입니다 (접근성).

#### 파일 위치
`hooks/useFocusTrap.ts`

#### 사용법

```typescript
import { useFocusTrap } from './hooks/useFocusTrap';

function Modal({ isOpen, onClose }) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  return (
    <div ref={modalRef} role="dialog" aria-modal="true">
      <button onClick={onClose}>닫기</button>
      <input type="text" placeholder="이름" />
    </div>
  );
}
```

---

### useEnrollments

학생의 수강 이력을 관리하는 훅입니다.

#### 파일 위치
`hooks/useEnrollments.ts`

#### 사용법

```typescript
import { useEnrollments } from './hooks/useEnrollments';

function StudentDetail({ studentId }) {
  const {
    enrollments,
    addEnrollment,
    updateEnrollment,
    endEnrollment,
  } = useEnrollments(studentId);

  const handleAddClass = async () => {
    await addEnrollment({
      subject: 'math',
      className: 'M1',
      staffId: 'teacher123',
      startDate: '2024-03-01',
    });
  };

  return (
    <div>
      <button onClick={handleAddClass}>수업 추가</button>
      {enrollments.map(e => (
        <div key={e.id}>{e.className} ({e.subject})</div>
      ))}
    </div>
  );
}
```

---

## 권한 관련 훅

### usePermissions

사용자 권한을 체크하는 훅입니다.

#### 파일 위치
`hooks/usePermissions.ts`

#### 사용법

```typescript
import { usePermissions } from './hooks/usePermissions';

function StudentManagement({ userProfile }) {
  const { hasPermission, rolePermissions } = usePermissions(userProfile);

  const canEdit = hasPermission('students.edit');
  const canDelete = hasPermission('students.delete');
  const canExport = hasPermission('students.export');

  return (
    <div>
      {canEdit && <button>수정</button>}
      {canDelete && <button>삭제</button>}
      {canExport && <button>엑셀 내보내기</button>}
    </div>
  );
}
```

#### 권한 키 목록

| 권한 키 | 설명 |
|---------|------|
| students.view | 학생 조회 |
| students.edit | 학생 수정 |
| students.delete | 학생 삭제 |
| students.export | 엑셀 내보내기 |
| timetable.math.view | 수학 시간표 조회 |
| timetable.math.edit | 수학 시간표 편집 |
| timetable.english.view | 영어 시간표 조회 |
| timetable.english.edit | 영어 시간표 편집 |
| attendance.manage_math | 수학 출석 관리 |
| attendance.manage_english | 영어 출석 관리 |
| events.create | 일정 생성 |
| events.manage_own | 본인 일정 관리 |
| events.manage_others | 타인 일정 관리 |
| settings.access | 설정 접근 |
| departments.manage | 부서 관리 |

---

### useTabPermissions

탭 접근 권한을 체크하는 훅입니다.

#### 파일 위치
`hooks/useTabPermissions.ts`

#### 사용법

```typescript
import { useTabPermissions } from './hooks/useTabPermissions';

function App({ userProfile }) {
  const { canAccessTab, accessibleTabs, isLoading } = useTabPermissions(userProfile);

  useEffect(() => {
    if (!canAccessTab('students')) {
      setAppMode('dashboard'); // 권한 없으면 대시보드로 리다이렉트
    }
  }, [canAccessTab]);

  return (
    <div>
      {accessibleTabs.map(tab => (
        <button key={tab} onClick={() => setAppMode(tab)}>
          {tab}
        </button>
      ))}
    </div>
  );
}
```

---

## 성능 최적화 팁

### 1. 조건부 쿼리 활성화

```typescript
// 탭이 활성화될 때만 데이터 로드
const { data: students } = useStudents(
  false,
  appMode === 'students'  // enabled 파라미터
);
```

### 2. 메모이제이션 활용

```typescript
const filteredStudents = useMemo(() =>
  students.filter(s => s.status === 'active'),
  [students]
);
```

### 3. 디바운싱 검색

```typescript
import { useState, useEffect } from 'react';

function SearchInput() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // debouncedSearch로 쿼리 실행
}
```

### 4. 캐시 무효화 (invalidateQueries)

```typescript
import { useQueryClient } from '@tanstack/react-query';

function MyComponent() {
  const queryClient = useQueryClient();

  const handleUpdate = async () => {
    await updateStudent(id, data);
    queryClient.invalidateQueries({ queryKey: ['students'] });
  };
}
```

### 5. Suspense 경계 설정

```typescript
<Suspense fallback={<LoadingSpinner />}>
  <StudentManagementTab />
</Suspense>
```

---

## 주의사항

### 1. 훅 호출 순서

- 훅은 항상 컴포넌트 최상단에서 호출
- 조건문 안에서 훅 호출 금지

```typescript
// ❌ 잘못된 예
if (condition) {
  const { data } = useStudents();
}

// ✅ 올바른 예
const { data } = useStudents(false, condition);
```

### 2. 의존성 배열 관리

- useEffect/useMemo/useCallback의 deps 배열 누락 주의
- ESLint의 exhaustive-deps 규칙 준수

### 3. 메모리 누수 방지

- useEffect에서 cleanup 함수 작성
- 이벤트 리스너 해제
- 타이머 정리

```typescript
useEffect(() => {
  const unsubscribe = onSnapshot(query, callback);
  return () => unsubscribe(); // cleanup
}, []);
```

### 4. 무한 루프 주의

- setState를 useEffect 안에서 조건 없이 호출 금지

```typescript
// ❌ 무한 루프
useEffect(() => {
  setCount(count + 1); // deps에 count 있으면 무한 루프
}, [count]);

// ✅ 올바른 예
useEffect(() => {
  setCount(c => c + 1); // 함수형 업데이트
}, []); // 빈 배열
```

---

## 참고 자료

- [React Hooks 공식 문서](https://react.dev/reference/react)
- [React Query 공식 문서](https://tanstack.com/query/latest/docs/react/overview)
- [커스텀 훅 작성 가이드](https://react.dev/learn/reusing-logic-with-custom-hooks)
