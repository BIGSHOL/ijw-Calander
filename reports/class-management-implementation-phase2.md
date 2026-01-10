# 수업 관리 시스템 Phase 2 구현 완료 보고서

**작성일**: 2026-01-10
**Phase**: 2 - CRUD Operations & Student Management
**상태**: ✅ 완료

---

## 📋 목표 달성 현황

### ✅ 완료된 항목

1. **useClassDetail Hook** - 수업별 학생 목록 조회
2. **useClassMutations Hook** - 수업 CRUD 작업
3. **AddClassModal** - 새 수업 추가 모달
4. **EditClassModal** - 수업 정보 수정 모달
5. **ClassStudentList** - 수업별 학생 목록 컴포넌트
6. **ClassDetailModal 업데이트** - 실제 학생 데이터 표시
7. **ClassManagementTab 업데이트** - AddClassModal 연동
8. **AssignClassModal** - 과목별 수업 필터링 (이미 구현됨)

---

## 🛠️ 구현 상세

### 1. useClassDetail Hook (`hooks/useClassDetail.ts`)

**기능**:
- 수업명과 과목을 기반으로 수업 상세 정보 조회
- 해당 수업에 등록된 학생 목록 조회
- React Query 기반 캐싱 및 자동 재검증

**주요 로직**:
```typescript
// collectionGroup으로 모든 enrollments 조회
// subject + className 필터 적용
// 학생 ID 수집 후 students 컬렉션에서 정보 조회
// ClassDetail 객체 반환 (학생 목록 포함)
```

**반환 데이터**:
- `className`: 수업명
- `teacher`: 강사명
- `subject`: 과목 (math/english)
- `schedule`: 스케줄 배열
- `studentCount`: 학생 수
- `students`: ClassStudent[] (id, name, grade, status, enrollmentDate)

**캐싱 전략**:
- staleTime: 5분
- gcTime: 15분
- enabled 조건: className과 subject 존재 시만 실행

---

### 2. useClassMutations Hook (`hooks/useClassMutations.ts`)

**구현된 Mutation**:

#### 2.1. useCreateClass
- **기능**: 새 수업 생성 (선택된 학생들에게 enrollment 추가)
- **파라미터**: CreateClassData
  - className, teacher, subject, schedule, studentIds
- **로직**: 각 학생의 enrollments 서브컬렉션에 문서 추가
- **캐시 무효화**: ['classes'], ['students'], ['classDetail']

#### 2.2. useUpdateClass
- **기능**: 수업 정보 수정 (모든 학생의 enrollment 업데이트)
- **파라미터**: UpdateClassData
  - originalClassName, originalSubject, newClassName, newTeacher, newSchedule
- **로직**: collectionGroup으로 모든 해당 enrollments 조회 후 일괄 업데이트
- **캐시 무효화**: ['classes'], ['students'], ['classDetail']

#### 2.3. useDeleteClass
- **기능**: 수업 삭제 (모든 학생의 enrollment 삭제)
- **파라미터**: DeleteClassData
  - className, subject
- **로직**: collectionGroup으로 모든 해당 enrollments 조회 후 일괄 삭제
- **캐시 무효화**: ['classes'], ['students'], ['classDetail']

#### 2.4. useManageClassStudents
- **기능**: 수업에 학생 추가/제거
- **파라미터**: ManageClassStudentsData
  - className, teacher, subject, schedule, addStudentIds, removeStudentIds
- **로직**:
  - 추가: 각 학생에게 enrollment 추가
  - 제거: 해당 학생의 enrollment 삭제
- **캐시 무효화**: ['classes'], ['students'], ['classDetail']

---

### 3. AddClassModal (`components/ClassManagement/AddClassModal.tsx`)

**UI 구성**:
- 헤더: 곤색 배경 (#081429), Plus 아이콘
- 본문:
  - 수업 정보 입력 섹션
    - 수업명 (필수)
    - 과목 선택 (math/english, 필수)
    - 강사명 (필수, User 아이콘)
    - 스케줄 (선택, Calendar 아이콘, 쉼표 구분)
  - 학생 선택 섹션
    - 전체 선택/해제 버튼
    - 체크박스 리스트 (학생별 이름, 학년, 상태 표시)
    - 선택된 학생 수 표시
- 푸터:
  - 취소 버튼 (곤색 테두리)
  - 저장 버튼 (노란색 배경 #fdb813)

**유효성 검사**:
- 수업명 필수
- 강사명 필수
- 최소 1명 이상 학생 선택 필수

**기능**:
- useStudents Hook으로 활성 학생 목록 조회
- 학생 선택/해제 토글
- 전체 선택/해제
- useCreateClass Mutation으로 수업 생성

---

### 4. EditClassModal (`components/ClassManagement/EditClassModal.tsx`)

**UI 구성**:
- AddClassModal과 유사하지만:
  - 기존 데이터 pre-fill
  - 과목 필드는 읽기 전용 (수정 불가)
  - 학생 선택 섹션 없음 (ClassStudentList에서 관리)
  - 정보 박스: 수업 수정 시 모든 학생에게 영향 안내

**기능**:
- useUpdateClass Mutation으로 수업 수정
- 수업 정보만 수정 (학생 관리는 ClassDetailModal에서)

---

### 5. ClassStudentList (`components/ClassManagement/ClassStudentList.tsx`)

**UI 구성**:
- 학생별 카드 형태 리스트
- 각 카드:
  - 학생 이름 (클릭 가능, ExternalLink 아이콘)
  - 상태 뱃지 (재원/대기/퇴원)
  - 학년, 등록일 표시
  - 제거 버튼 (UserMinus 아이콘)

**기능**:
- 학생 클릭 시 `onStudentClick` 콜백 실행 (학생 관리 탭으로 이동)
- 학생 제거 시 확인 메시지 표시
- useManageClassStudents Mutation으로 학생 제거
- 제거 중 로딩 상태 표시 (AlertCircle 회전 애니메이션)

**상태별 색상**:
- active: 초록색 (bg-green-100)
- on_hold: 노란색 (bg-yellow-100)
- withdrawn: 회색 (bg-gray-100)

---

### 6. ClassDetailModal 업데이트

**변경 사항**:
- useClassDetail Hook 통합
- ClassStudentList 컴포넌트 표시
- EditClassModal 연동 (편집 버튼 클릭 시)
- useDeleteClass Mutation으로 수업 삭제
- 삭제 시 확인 메시지: 학생 수 표시 및 되돌릴 수 없음 경고

**로딩 상태**:
- 학생 목록 로딩 중: "학생 목록을 불러오는 중..." 표시
- 로딩 실패 시: "학생 정보를 불러올 수 없습니다" 표시

**삭제 기능**:
- 삭제 중 모든 버튼 비활성화
- 삭제 성공 시 모달 자동 닫기
- 삭제 실패 시 에러 메시지 alert

---

### 7. ClassManagementTab 업데이트

**변경 사항**:
- AddClassModal import 및 상태 추가
- "새 수업 추가" 버튼 클릭 시 AddClassModal 열기
- 기본 과목 설정: 현재 필터의 subject 전달 (all이면 math)

**통합 포인트**:
```typescript
{showAddModal && (
  <AddClassModal
    onClose={() => setShowAddModal(false)}
    defaultSubject={filters.subject === 'all' ? 'math' : filters.subject}
  />
)}
```

---

### 8. AssignClassModal - 과목별 수업 필터링

**확인 사항**:
- 이미 Phase 1에서 구현 완료
- `useClasses('math')` 및 `useClasses('english')`로 과목별 조회
- 과목 탭 전환 시 해당 과목의 수업만 표시
- 이미 배정된 수업 필터링

**동작 확인**:
- 수학 탭: 수학 수업만 표시
- 영어 탭: 영어 수업만 표시
- 이미 배정된 수업은 목록에서 제외

---

## 🎨 브랜드 컬러 적용

### 색상 시스템

- **곤색 (#081429)**: 헤더, 테두리, 제목, 버튼 텍스트
- **노란색 (#fdb813)**: 저장 버튼, 강조 텍스트, 선택 상태
- **회색 (#373d41)**: 보조 텍스트, 레이블

### 적용 위치

1. **모달 헤더**: bg-[#081429], text-white
2. **저장/확인 버튼**: bg-[#fdb813], hover:bg-[#e5a60f], text-[#081429]
3. **취소 버튼**: border-[#081429], text-[#081429], hover:bg-[#081429], hover:text-white
4. **입력 필드**: border-[#081429], focus:ring-[#fdb813]
5. **제목/레이블**: text-[#081429]
6. **보조 텍스트**: text-[#373d41]
7. **강조 텍스트**: text-[#fdb813]

---

## 🔄 데이터 흐름

### 수업 생성 플로우
```
사용자 → AddClassModal → useCreateClass
  ↓
students/{studentId}/enrollments/{enrollmentId} 생성
  ↓
React Query 캐시 무효화
  ↓
useClasses 자동 재조회
  ↓
ClassManagementTab UI 업데이트
```

### 수업 수정 플로우
```
사용자 → ClassDetailModal → EditClassModal → useUpdateClass
  ↓
collectionGroup 쿼리로 모든 enrollments 조회
  ↓
일괄 updateDoc
  ↓
React Query 캐시 무효화
  ↓
UI 자동 업데이트
```

### 수업 삭제 플로우
```
사용자 → ClassDetailModal → useDeleteClass
  ↓
collectionGroup 쿼리로 모든 enrollments 조회
  ↓
일괄 deleteDoc
  ↓
React Query 캐시 무효화
  ↓
모달 닫기 및 UI 업데이트
```

### 학생 제거 플로우
```
사용자 → ClassStudentList → useManageClassStudents
  ↓
students/{studentId}/enrollments 쿼리
  ↓
해당 enrollment deleteDoc
  ↓
React Query 캐시 무효화
  ↓
ClassStudentList 자동 업데이트
```

---

## ✅ 테스트 체크리스트

### 수업 생성
- [x] 새 수업 추가 버튼 클릭 시 AddClassModal 열림
- [x] 필수 필드 검증 (수업명, 강사명, 학생 선택)
- [x] 과목 선택 (math/english)
- [x] 스케줄 쉼표 구분 파싱
- [x] 학생 선택/해제 기능
- [x] 전체 선택/해제 기능
- [x] 저장 시 useClasses 자동 재조회
- [x] 저장 후 모달 자동 닫기

### 수업 수정
- [x] ClassDetailModal에서 편집 버튼 클릭 시 EditClassModal 열림
- [x] 기존 데이터 pre-fill
- [x] 과목 필드 읽기 전용
- [x] 수업명, 강사명, 스케줄 수정 가능
- [x] 저장 시 모든 학생의 enrollments 업데이트
- [x] 저장 후 UI 자동 업데이트

### 수업 삭제
- [x] 삭제 버튼 클릭 시 확인 메시지 표시
- [x] 학생 수 및 경고 문구 표시
- [x] 삭제 시 모든 enrollments 삭제
- [x] 삭제 중 버튼 비활성화
- [x] 삭제 후 모달 자동 닫기

### 학생 목록 표시
- [x] useClassDetail로 학생 목록 조회
- [x] 학생별 정보 표시 (이름, 학년, 상태, 등록일)
- [x] 상태별 색상 뱃지
- [x] 학생 클릭 시 onStudentClick 콜백 실행 (향후 학생 관리 탭 연동)

### 학생 제거
- [x] 제거 버튼 클릭 시 확인 메시지
- [x] 제거 시 해당 enrollment 삭제
- [x] 제거 중 로딩 상태 표시
- [x] 제거 후 UI 자동 업데이트

### 과목별 필터링 (AssignClassModal)
- [x] 수학 탭: 수학 수업만 표시
- [x] 영어 탭: 영어 수업만 표시
- [x] 이미 배정된 수업 제외
- [x] 과목 전환 시 선택 초기화

---

## 🚀 실시간 동기화

### React Query 캐시 무효화 전략

모든 Mutation 성공 시 다음 캐시 무효화:
```typescript
queryClient.invalidateQueries({ queryKey: ['classes'] });
queryClient.invalidateQueries({ queryKey: ['students'] });
queryClient.invalidateQueries({ queryKey: ['classDetail'] });
```

**효과**:
- 수업 목록 자동 재조회
- 학생 목록 자동 재조회
- 수업 상세 정보 자동 재조회
- 사용자에게 즉각적인 피드백

---

## 🔐 에러 처리

### 에러 메시지

1. **AddClassModal**:
   - "수업명을 입력해주세요."
   - "강사명을 입력해주세요."
   - "최소 1명 이상의 학생을 선택해주세요."
   - "수업 생성에 실패했습니다. 다시 시도해주세요."

2. **EditClassModal**:
   - "수업명을 입력해주세요."
   - "강사명을 입력해주세요."
   - "수업 수정에 실패했습니다. 다시 시도해주세요."

3. **ClassDetailModal**:
   - "수업 삭제에 실패했습니다. 다시 시도해주세요."

4. **ClassStudentList**:
   - "학생 제외에 실패했습니다. 다시 시도해주세요."

### 에러 로깅

모든 에러는 console.error로 로깅:
```typescript
console.error('[ComponentName] Error description:', err);
```

---

## 📦 생성된 파일

### 새로 생성된 파일

1. `hooks/useClassDetail.ts` - 수업 상세 정보 조회 Hook
2. `hooks/useClassMutations.ts` - 수업 CRUD Mutations Hook
3. `components/ClassManagement/AddClassModal.tsx` - 수업 추가 모달
4. `components/ClassManagement/EditClassModal.tsx` - 수업 편집 모달
5. `components/ClassManagement/ClassStudentList.tsx` - 학생 목록 컴포넌트

### 수정된 파일

1. `components/ClassManagement/ClassDetailModal.tsx` - 실제 학생 데이터 표시
2. `components/ClassManagement/ClassManagementTab.tsx` - AddClassModal 통합

### 확인된 파일 (이미 구현됨)

1. `components/StudentManagement/AssignClassModal.tsx` - 과목별 필터링 이미 구현

---

## 🎯 Phase 2 목표 달성도

| 항목 | 상태 | 비고 |
|-----|------|------|
| useClassDetail Hook | ✅ 완료 | 학생 목록 조회 기능 |
| useClassMutations Hook | ✅ 완료 | Create, Update, Delete, ManageStudents |
| AddClassModal | ✅ 완료 | 브랜드 컬러 적용 |
| EditClassModal | ✅ 완료 | 브랜드 컬러 적용 |
| ClassStudentList | ✅ 완료 | 학생 제거 기능 포함 |
| ClassDetailModal 업데이트 | ✅ 완료 | 실제 학생 데이터 표시 |
| ClassManagementTab 업데이트 | ✅ 완료 | AddClassModal 통합 |
| 과목별 수업 필터링 | ✅ 완료 | AssignClassModal 이미 구현 |
| 실시간 동기화 | ✅ 완료 | React Query 캐시 무효화 |
| 에러 처리 | ✅ 완료 | 명확한 에러 메시지 |
| 브랜드 컬러 적용 | ✅ 완료 | 곤색, 노란색, 회색 |

**전체 달성률: 100%**

---

## 🔮 다음 단계: Phase 3

Phase 3에서 구현될 기능:
1. 수업 통계 (출석률, 월별 수업 횟수 등)
2. 수업 시간표 연동
3. 학생 성적 관리
4. 수업 일정 관리
5. 수업 노트 기능

---

## 📝 참고 사항

### Firebase 구조

```
students/{studentId}
  └── enrollments/{enrollmentId}
      ├── subject: 'math' | 'english'
      ├── className: string
      ├── teacherId: string
      ├── schedule: string[]
      └── createdAt: timestamp
```

### React Query 캐시 키

```typescript
['classes', subject?]        // 수업 목록
['students', includeWithdrawn?] // 학생 목록
['classDetail', className, subject] // 수업 상세
```

### 성능 최적화

1. **useClasses**: 과목별 필터링으로 불필요한 데이터 조회 방지
2. **useClassDetail**: enabled 조건으로 불필요한 쿼리 방지
3. **React Query 캐싱**: 5분 캐싱으로 중복 요청 방지
4. **collectionGroup**: 한 번의 쿼리로 모든 enrollments 조회

---

## ✨ 구현 하이라이트

1. **완전한 CRUD 구현**: 수업 생성, 수정, 삭제, 학생 관리
2. **과목별 수업 분리**: 같은 이름이라도 과목이 다르면 별개로 관리
3. **실시간 동기화**: React Query 캐시 무효화로 즉각적인 UI 업데이트
4. **직관적인 UI**: 브랜드 컬러 적용 및 명확한 피드백
5. **에러 처리**: 모든 작업에 대한 에러 처리 및 사용자 피드백
6. **성능 최적화**: 캐싱 및 조건부 쿼리 실행

---

**Phase 2 구현 완료: 2026-01-10**
